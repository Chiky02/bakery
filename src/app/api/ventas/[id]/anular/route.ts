import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { canAccess } from "@/lib/permissions";

/** Anula una venta de mostrador y revierte stock controlado. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  const allowed =
    canAccess(ctx.rol, "/caja", ctx.permisos) ||
    canAccess(ctx.rol, "/mostrador", ctx.permisos) ||
    canAccess(ctx.rol, "/reportes", ctx.permisos);
  if (!allowed) {
    return NextResponse.json({ error: "Sin permiso para anular" }, { status: 403 });
  }

  const { data: venta, error } = await supabase
    .from("ventas_mostrador")
    .select("*")
    .eq("id", id)
    .eq("panaderia_id", ctx.panaderia.id)
    .maybeSingle();

  if (error || !venta) {
    return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
  }
  if (venta.anulado) {
    return NextResponse.json({ ok: true, already: true });
  }

  const { data: updated, error: updErr } = await supabase
    .from("ventas_mostrador")
    .update({ anulado: true })
    .eq("id", id)
    .eq("panaderia_id", ctx.panaderia.id)
    .eq("anulado", false)
    .select("id, anulado")
    .maybeSingle();

  if (updErr) {
    if (/anulado|policy|permission/i.test(updErr.message)) {
      return NextResponse.json(
        {
          error:
            "No se pudo anular (permisos/migración). Ejecuta npm run db:push e intenta de nuevo.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: updErr.message }, { status: 400 });
  }

  if (!updated?.anulado) {
    return NextResponse.json(
      { error: "No se marcó la venta como anulada. Revisa permisos RLS (db:push)." },
      { status: 403 },
    );
  }

  // Nota en factura vinculada (no la borramos: documento ya emitido)
  if (venta.factura_id) {
    await supabase
      .from("facturas")
      .update({
        notas: "VENTA ANULADA — documento comercial anulado operativamente.",
      })
      .eq("id", venta.factura_id)
      .eq("panaderia_id", ctx.panaderia.id);
  }

  const detalle = (venta.detalle ?? []) as {
    producto_id?: string;
    cantidad?: number;
  }[];

  for (const line of detalle) {
    if (!line.producto_id || !line.cantidad) continue;
    const { data: prod } = await supabase
      .from("productos")
      .select("control_stock")
      .eq("id", line.producto_id)
      .maybeSingle();
    if (!prod?.control_stock) continue;
    const { error: stockErr } = await supabase.rpc("ajustar_stock", {
      p_producto: line.producto_id,
      p_cantidad: Number(line.cantidad),
      p_tipo: "anulacion",
      p_referencia: id,
      p_notas: "Anulación venta mostrador",
    });
    if (stockErr) {
      return NextResponse.json(
        {
          error: `Venta anulada pero falló revertir stock: ${stockErr.message}`,
        },
        { status: 409 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
