import { NextResponse } from "next/server";
import { requireApiFeature } from "@/lib/api-context";
import { z } from "zod";

const itemSchema = z.object({
  producto_id: z.string().uuid(),
  cantidad: z.number().positive(),
});

const schema = z.object({
  medio_pago: z.enum(["efectivo", "electronico", "mixto"]),
  detalle: z.array(itemSchema).min(1),
});

export async function POST(request: Request) {
  const result = await requireApiFeature("mostrador");
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  try {
    const body = schema.parse(await request.json());

    const ids = body.detalle.map((d) => d.producto_id);
    const { data: productos } = await supabase
      .from("productos")
      .select("id, nombre, precio, disponible, tipo, stock, control_stock")
      .eq("panaderia_id", ctx.panaderia.id)
      .in("id", ids);

    const byId = new Map((productos ?? []).map((p) => [p.id, p]));
    const detalle: {
      producto_id: string;
      nombre: string;
      cantidad: number;
      precio: number;
      subtotal: number;
    }[] = [];

    for (const line of body.detalle) {
      const p = byId.get(line.producto_id);
      if (!p || !p.disponible || (p.tipo ?? "venta") === "materia_prima") {
        return NextResponse.json(
          { error: `Producto no disponible` },
          { status: 400 },
        );
      }
      const qty = Math.max(1, Math.floor(line.cantidad));
      const precio = Number(p.precio);
      detalle.push({
        producto_id: p.id,
        nombre: p.nombre,
        cantidad: qty,
        precio,
        subtotal: precio * qty,
      });
    }

    const total = detalle.reduce((s, d) => s + d.subtotal, 0);

    const { data: turno } = await supabase
      .from("turnos_caja")
      .select("id")
      .eq("panaderia_id", ctx.panaderia.id)
      .eq("estado", "abierto")
      .maybeSingle();

    const { data, error } = await supabase
      .from("ventas_mostrador")
      .insert({
        panaderia_id: ctx.panaderia.id,
        total,
        medio_pago: body.medio_pago,
        detalle,
        registrado_por: ctx.profile.id,
        turno_id: turno?.id ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // Descontar stock (best-effort; no bloquea la venta si falla RPC antigua)
    for (const line of detalle) {
      const p = byId.get(line.producto_id);
      if (p?.control_stock) {
        await supabase.rpc("ajustar_stock", {
          p_producto: line.producto_id,
          p_cantidad: -line.cantidad,
          p_tipo: "venta",
          p_referencia: data.id,
          p_notas: "Venta mostrador",
        });
      }
    }

    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
