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

  const { error: updErr } = await supabase
    .from("ventas_mostrador")
    .update({ anulado: true })
    .eq("id", id)
    .eq("panaderia_id", ctx.panaderia.id);

  if (updErr) {
    if (/anulado/i.test(updErr.message)) {
      return NextResponse.json(
        { error: "Aplica la migración de ventas (npm run db:push)" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: updErr.message }, { status: 400 });
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
    await supabase.rpc("ajustar_stock", {
      p_producto: line.producto_id,
      p_cantidad: Number(line.cantidad),
      p_tipo: "ajuste",
      p_referencia: id,
      p_notas: "Anulación venta mostrador",
    });
  }

  return NextResponse.json({ ok: true });
}
