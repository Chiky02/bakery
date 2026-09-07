import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";

export async function POST(request: Request) {
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  const body = await request.json();
  const valor = Number(body.valor) || 0;
  const estado_pago = body.estado_pago ?? "pendiente";
  let abono = Number(body.abono) || 0;
  if (estado_pago === "pagado") abono = valor;
  if (estado_pago === "pendiente") abono = 0;

  const payload: Record<string, unknown> = {
    panaderia_id: ctx.panaderia.id,
    creado_por: ctx.profile.id,
    estado: "pendiente",
    descripcion: body.descripcion,
    cliente_nombre: body.cliente_nombre ?? null,
    cliente_telefono: body.cliente_telefono ?? null,
    fecha_entrega: body.fecha_entrega,
    valor,
    notas: body.notas ?? null,
    producto_id: body.producto_id || null,
    estado_pago,
    abono,
  };

  const { data, error } = await supabase.from("encargos").insert(payload).select().single();

  if (error) {
    // Columnas nuevas pueden no existir aún: reintentar sin ellas
    if (
      error.message.includes("estado_pago") ||
      error.message.includes("abono") ||
      error.message.includes("producto_id") ||
      error.message.includes("encargable")
    ) {
      const { data: fallback, error: err2 } = await supabase
        .from("encargos")
        .insert({
          panaderia_id: ctx.panaderia.id,
          creado_por: ctx.profile.id,
          estado: "pendiente",
          descripcion: body.descripcion,
          cliente_nombre: body.cliente_nombre ?? null,
          cliente_telefono: body.cliente_telefono ?? null,
          fecha_entrega: body.fecha_entrega,
          valor,
          notas: body.notas ?? null,
        })
        .select()
        .single();
      if (err2) return NextResponse.json({ error: err2.message }, { status: 400 });
      return NextResponse.json(fallback);
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(data);
}
