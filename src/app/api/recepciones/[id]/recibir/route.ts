import { NextResponse } from "next/server";
import { requireApiFeature } from "@/lib/api-context";

/** Marca recepción como recibida e incrementa stock de productos ligados. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await requireApiFeature("recepciones");
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  const { data: rec } = await supabase
    .from("recepciones")
    .select("*, recepcion_items(*)")
    .eq("id", id)
    .eq("panaderia_id", ctx.panaderia.id)
    .maybeSingle();

  if (!rec) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if (rec.estado === "recibida") {
    return NextResponse.json({ error: "Ya estaba recibida" }, { status: 400 });
  }

  const lines = rec.recepcion_items ?? [];
  for (const line of lines) {
    const qty = Number(line.cantidad_pedida) || 0;
    await supabase
      .from("recepcion_items")
      .update({ cantidad_recibida: qty })
      .eq("id", line.id);

    if (line.producto_id && qty > 0) {
      await supabase.rpc("ajustar_stock", {
        p_producto: line.producto_id,
        p_cantidad: qty,
        p_tipo: "recepcion",
        p_referencia: rec.id,
        p_notas: line.descripcion,
      });
      // Activa control_stock si hay producto ligado
      await supabase
        .from("productos")
        .update({ control_stock: true })
        .eq("id", line.producto_id)
        .eq("panaderia_id", ctx.panaderia.id);
    }
  }

  const { error } = await supabase
    .from("recepciones")
    .update({
      estado: "recibida",
      fecha_recepcion: new Date().toISOString().slice(0, 10),
      recibido_por: ctx.profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
