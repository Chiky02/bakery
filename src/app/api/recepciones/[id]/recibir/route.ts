import { NextResponse } from "next/server";
import { requireApiAnyPermiso } from "@/lib/api-context";

/** Marca recepción como recibida e incrementa stock (idempotente vía RPC). */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await requireApiAnyPermiso(["recepciones_crear"]);
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  const { data: rec } = await supabase
    .from("recepciones")
    .select("id, estado")
    .eq("id", id)
    .eq("panaderia_id", ctx.panaderia.id)
    .maybeSingle();

  if (!rec) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  if (rec.estado === "recibida") {
    return NextResponse.json({ error: "Ya estaba recibida" }, { status: 400 });
  }

  const { error } = await supabase.rpc("recibir_recepcion", { p_recepcion: id });

  if (error) {
    if (/recibir_recepcion|function/i.test(error.message)) {
      // Fallback legacy con lock optimista
      const { data: claimed, error: claimErr } = await supabase
        .from("recepciones")
        .update({
          estado: "recibida",
          fecha_recepcion: new Date().toISOString().slice(0, 10),
          recibido_por: ctx.profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("panaderia_id", ctx.panaderia.id)
        .neq("estado", "recibida")
        .select("id")
        .maybeSingle();

      if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 400 });
      if (!claimed) {
        return NextResponse.json({ error: "Ya estaba recibida" }, { status: 400 });
      }

      const { data: full } = await supabase
        .from("recepciones")
        .select("*, recepcion_items(*)")
        .eq("id", id)
        .single();

      for (const line of full?.recepcion_items ?? []) {
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
            p_referencia: id,
            p_notas: line.descripcion,
          });
          await supabase
            .from("productos")
            .update({ control_stock: true })
            .eq("id", line.producto_id)
            .eq("panaderia_id", ctx.panaderia.id);
        }
      }
      return NextResponse.json({ ok: true });
    }
    if (/Ya estaba recibida/i.test(error.message)) {
      return NextResponse.json({ error: "Ya estaba recibida" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
