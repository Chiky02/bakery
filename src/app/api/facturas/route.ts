import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { canAccess } from "@/lib/permissions";
import { z } from "zod";

function canInvoice(ctx: { rol: Parameters<typeof canAccess>[0]; permisos: string[] }) {
  return (
    canAccess(ctx.rol, "/caja", ctx.permisos) ||
    canAccess(ctx.rol, "/mostrador", ctx.permisos) ||
    canAccess(ctx.rol, "/mesas", ctx.permisos) ||
    canAccess(ctx.rol, "/reportes", ctx.permisos) ||
    canAccess(ctx.rol, "/encargos", ctx.permisos) ||
    canAccess(ctx.rol, "/facturas", ctx.permisos)
  );
}

const schema = z.object({
  origen: z.enum(["mostrador", "mesa", "encargo", "manual"]),
  cliente_id: z.string().uuid().optional().nullable(),
  cliente_nombre: z.string().min(2).max(160),
  cliente_documento: z.string().max(40).optional().nullable(),
  cliente_email: z.string().email().optional().nullable().or(z.literal("")),
  cliente_direccion: z.string().max(240).optional().nullable(),
  cliente_telefono: z.string().max(40).optional().nullable(),
  medio_pago: z.enum(["efectivo", "electronico", "mixto"]).optional().nullable(),
  iva_porcentaje: z.number().min(0).max(100).optional().default(0),
  notas: z.string().max(500).optional().nullable(),
  venta_id: z.string().uuid().optional().nullable(),
  cuenta_mesa_id: z.string().uuid().optional().nullable(),
  encargo_id: z.string().uuid().optional().nullable(),
  detalle: z
    .array(
      z.object({
        producto_id: z.string().uuid().optional(),
        nombre: z.string().min(1),
        cantidad: z.number().positive(),
        precio: z.number().int().min(0),
      }),
    )
    .min(1),
});

export async function GET(request: Request) {
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;
  if (!canInvoice(ctx)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 40));
  const q = (url.searchParams.get("q") ?? "").trim();
  const origen = (url.searchParams.get("origen") ?? "").trim();
  const desde = url.searchParams.get("desde");
  const hasta = url.searchParams.get("hasta");

  let query = supabase
    .from("facturas")
    .select("*")
    .eq("panaderia_id", ctx.panaderia.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (origen) query = query.eq("origen", origen);
  if (desde) query = query.gte("created_at", desde);
  if (hasta) query = query.lte("created_at", hasta);
  if (q) {
    query = query.or(
      `numero.ilike.%${q}%,cliente_nombre.ilike.%${q}%,cliente_documento.ilike.%${q}%`,
    );
  }

  const { data } = await query;
  return NextResponse.json({ facturas: data ?? [] });
}

export async function POST(request: Request) {
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;
  if (!canInvoice(ctx)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    const body = schema.parse(await request.json());
    const lines = body.detalle.map((d) => ({
      producto_id: d.producto_id,
      nombre: d.nombre,
      cantidad: d.cantidad,
      precio: d.precio,
      subtotal: Math.round(d.precio * d.cantidad),
    }));
    const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
    const iva = Math.round(subtotal * ((body.iva_porcentaje ?? 0) / 100));
    const total = subtotal + iva;

    const rpcArgs: Record<string, unknown> = {
      p_panaderia: ctx.panaderia.id,
      p_origen: body.origen,
      p_cliente_nombre: body.cliente_nombre,
      p_cliente_documento: body.cliente_documento ?? null,
      p_cliente_email: body.cliente_email || null,
      p_cliente_direccion: body.cliente_direccion ?? null,
      p_cliente_telefono: body.cliente_telefono ?? null,
      p_subtotal: subtotal,
      p_iva: iva,
      p_total: total,
      p_medio_pago: body.medio_pago ?? null,
      p_detalle: lines,
      p_notas: body.notas ?? null,
      p_venta_id: body.venta_id ?? null,
      p_cuenta_id: body.cuenta_mesa_id ?? null,
      p_encargo_id: body.encargo_id ?? null,
    };
    if (body.cliente_id) rpcArgs.p_cliente_id = body.cliente_id;

    let { data: facturaId, error } = await supabase.rpc("emitir_factura", rpcArgs);

    // Si la migración aún no tiene p_cliente_id, reintentar sin él y actualizar luego
    if (error && body.cliente_id && /p_cliente_id|cliente_id/i.test(error.message)) {
      delete rpcArgs.p_cliente_id;
      const retry = await supabase.rpc("emitir_factura", rpcArgs);
      facturaId = retry.data;
      error = retry.error;
      if (!error && facturaId) {
        await supabase
          .from("facturas")
          .update({ cliente_id: body.cliente_id })
          .eq("id", facturaId);
      }
    } else if (!error && body.cliente_id && facturaId && !rpcArgs.p_cliente_id) {
      await supabase
        .from("facturas")
        .update({ cliente_id: body.cliente_id })
        .eq("id", facturaId);
    }

    if (error) {
      if (error.message.includes("emitir_factura") || error.message.includes("function")) {
        return NextResponse.json(
          {
            error:
              "Falta aplicar la migración de facturas (npm run db:push). Luego reintenta.",
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const { data: factura } = await supabase
      .from("facturas")
      .select("*")
      .eq("id", facturaId)
      .single();

    return NextResponse.json(factura);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
