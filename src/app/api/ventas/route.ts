import { NextResponse } from "next/server";
import { requireApiFeature } from "@/lib/api-context";
import { getTurnoAbiertoId, sinTurnoCajaResponse } from "@/lib/turno-caja";
import { resolvePagoDesglose } from "@/lib/pago-split";
import { z } from "zod";

const itemSchema = z.object({
  producto_id: z.string().uuid(),
  cantidad: z.number().positive(),
});

const schema = z.object({
  client_request_id: z.string().uuid().optional().nullable(),
  medio_pago: z.enum(["efectivo", "electronico", "mixto"]),
  monto_efectivo: z.number().int().min(0).optional().nullable(),
  monto_electronico: z.number().int().min(0).optional().nullable(),
  detalle: z.array(itemSchema).min(1),
});

export async function POST(request: Request) {
  const result = await requireApiFeature("mostrador");
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  try {
    const body = schema.parse(await request.json());
    const clientRequestId = body.client_request_id ?? null;

    if (clientRequestId) {
      const { data: existing } = await supabase
        .from("ventas_mostrador")
        .select("*")
        .eq("panaderia_id", ctx.panaderia.id)
        .eq("client_request_id", clientRequestId)
        .maybeSingle();
      if (existing) {
        return NextResponse.json(existing);
      }
    }

    const ids = body.detalle.map((d) => d.producto_id);
    const { data: productos } = await supabase
      .from("productos")
      .select("id, nombre, precio, disponible, tipo, stock, control_stock")
      .eq("panaderia_id", ctx.panaderia.id)
      .in("id", ids);

    const byId = new Map((productos ?? []).map((p) => [p.id, p]));
    const detalleRpc: { producto_id: string; cantidad: number }[] = [];
    let totalPreview = 0;

    for (const line of body.detalle) {
      const p = byId.get(line.producto_id);
      if (!p || !p.disponible || (p.tipo ?? "venta") === "materia_prima") {
        return NextResponse.json({ error: "Producto no disponible" }, { status: 400 });
      }
      const qty = Math.max(1, Math.floor(line.cantidad));
      if (p.control_stock && Number(p.stock ?? 0) < qty) {
        return NextResponse.json(
          { error: `Stock insuficiente para ${p.nombre}` },
          { status: 409 },
        );
      }
      totalPreview += Number(p.precio) * qty;
      detalleRpc.push({ producto_id: p.id, cantidad: qty });
    }

    const pago = resolvePagoDesglose(
      body.medio_pago,
      totalPreview,
      body.monto_efectivo,
      body.monto_electronico,
    );
    if (!pago.ok) {
      return NextResponse.json({ error: pago.error }, { status: 400 });
    }

    const turnoId = await getTurnoAbiertoId(supabase, ctx.panaderia.id);
    if (!turnoId) return sinTurnoCajaResponse();

    const { data: ventaId, error } = await supabase.rpc("registrar_venta_mostrador", {
      p_panaderia: ctx.panaderia.id,
      p_medio_pago: pago.value.medio_pago,
      p_detalle: detalleRpc,
      p_turno_id: turnoId,
      p_monto_efectivo: pago.value.monto_efectivo,
      p_monto_electronico: pago.value.monto_electronico,
    });

    if (error) {
      if (/registrar_venta_mostrador|function/i.test(error.message)) {
        return await legacyVenta(
          supabase,
          ctx,
          pago.value,
          detalleRpc,
          byId,
          turnoId,
          clientRequestId,
        );
      }
      if (/Stock insuficiente|No hay apertura/i.test(error.message)) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (clientRequestId && ventaId) {
      const { error: idErr } = await supabase
        .from("ventas_mostrador")
        .update({ client_request_id: clientRequestId })
        .eq("id", ventaId);
      // Si la columna aún no existe o hay carrera única, no tumbar la venta
      if (idErr && /duplicate|unique/i.test(idErr.message)) {
        const { data: raced } = await supabase
          .from("ventas_mostrador")
          .select("*")
          .eq("panaderia_id", ctx.panaderia.id)
          .eq("client_request_id", clientRequestId)
          .maybeSingle();
        if (raced) return NextResponse.json(raced);
      }
    }

    const { data: venta } = await supabase
      .from("ventas_mostrador")
      .select("*")
      .eq("id", ventaId)
      .single();

    return NextResponse.json(venta ?? { id: ventaId });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

async function legacyVenta(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  ctx: { panaderia: { id: string }; profile: { id: string } },
  pago: {
    medio_pago: "efectivo" | "electronico" | "mixto";
    monto_efectivo: number;
    monto_electronico: number;
  },
  detalleRpc: { producto_id: string; cantidad: number }[],
  byId: Map<
    string,
    { id: string; nombre: string; precio: number; control_stock?: boolean }
  >,
  turnoId: string,
  clientRequestId: string | null,
) {
  const detalle = detalleRpc.map((d) => {
    const p = byId.get(d.producto_id)!;
    return {
      producto_id: p.id,
      nombre: p.nombre,
      cantidad: d.cantidad,
      precio: Number(p.precio),
      subtotal: Number(p.precio) * d.cantidad,
    };
  });
  const total = detalle.reduce((s, d) => s + d.subtotal, 0);
  const insertPayload: Record<string, unknown> = {
    panaderia_id: ctx.panaderia.id,
    total,
    medio_pago: pago.medio_pago,
    detalle,
    registrado_por: ctx.profile.id,
    turno_id: turnoId,
    monto_efectivo: pago.monto_efectivo,
    monto_electronico: pago.monto_electronico,
  };
  if (clientRequestId) insertPayload.client_request_id = clientRequestId;

  let { data, error } = await supabase
    .from("ventas_mostrador")
    .insert(insertPayload)
    .select()
    .single();

  if (error && /monto_efectivo|monto_electronico|client_request_id/i.test(error.message)) {
    delete insertPayload.monto_efectivo;
    delete insertPayload.monto_electronico;
    if (/client_request_id/i.test(error.message)) {
      delete insertPayload.client_request_id;
    }
    ({ data, error } = await supabase
      .from("ventas_mostrador")
      .insert(insertPayload)
      .select()
      .single());
  }
  if (error && /duplicate|unique/i.test(error.message) && clientRequestId) {
    const { data: existing } = await supabase
      .from("ventas_mostrador")
      .select("*")
      .eq("panaderia_id", ctx.panaderia.id)
      .eq("client_request_id", clientRequestId)
      .maybeSingle();
    if (existing) return NextResponse.json(existing);
  }
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "No se registró la venta. Aplica npm run db:push" },
      { status: 400 },
    );
  }

  for (const line of detalle) {
    const p = byId.get(line.producto_id);
    if (!p?.control_stock) continue;
    const { error: stockErr } = await supabase.rpc("ajustar_stock", {
      p_producto: line.producto_id,
      p_cantidad: -line.cantidad,
      p_tipo: "venta",
      p_referencia: data.id,
      p_notas: "Venta mostrador",
    });
    if (stockErr) {
      await supabase.from("ventas_mostrador").update({ anulado: true }).eq("id", data.id);
      return NextResponse.json(
        { error: stockErr.message || "Stock insuficiente; venta no registrada" },
        { status: 409 },
      );
    }
  }

  return NextResponse.json(data);
}
