import { NextResponse } from "next/server";
import { requireApiAnyPermiso } from "@/lib/api-context";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cuentaId: string }> },
) {
  const { cuentaId } = await params;
  const result = await requireApiAnyPermiso(["mesas"]);
  if (result instanceof NextResponse) return result;
  const { supabase } = result;

  const body = await request.json();
  const { producto_id, origen = "mesero", cantidad = 1 } = body;
  const qty = Math.max(1, Number(cantidad) || 1);

  const { data: cuenta } = await supabase
    .from("cuentas_mesa")
    .select("panaderia_id")
    .eq("id", cuentaId)
    .maybeSingle();

  let { data: producto, error: prodErr } = await supabase
    .from("productos")
    .select("precio, disponible, tipo, pasa_cocina")
    .eq("id", producto_id)
    .single();
  if (prodErr && /pasa_cocina/i.test(prodErr.message)) {
    const again = await supabase
      .from("productos")
      .select("precio, disponible, tipo")
      .eq("id", producto_id)
      .single();
    producto = again.data ? { ...again.data, pasa_cocina: true } : null;
  }

  if (!producto?.disponible) {
    return NextResponse.json({ error: "Producto no disponible" }, { status: 400 });
  }
  if ((producto as { tipo?: string }).tipo === "materia_prima") {
    return NextResponse.json({ error: "Producto no disponible" }, { status: 400 });
  }

  let cocinaHabilitada = true;
  if (cuenta?.panaderia_id) {
    const { data: neg, error: negErr } = await supabase
      .from("panaderias")
      .select("cocina_habilitada")
      .eq("id", cuenta.panaderia_id)
      .maybeSingle();
    if (!negErr && neg) cocinaHabilitada = neg.cocina_habilitada !== false;
  }
  const pasaCocina = (producto as { pasa_cocina?: boolean }).pasa_cocina !== false;
  const estadoPedido = cocinaHabilitada && pasaCocina ? "pendiente" : "listo";

  const { data: existing } = await supabase
    .from("items_cuenta")
    .select("id, cantidad")
    .eq("cuenta_mesa_id", cuentaId)
    .eq("producto_id", producto_id)
    .in("estado", ["pendiente", "pendiente_confirmacion", "en_preparacion", "listo"])
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("items_cuenta")
      .update({
        cantidad: existing.cantidad + qty,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("*, productos(*)")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }

  const { data, error } = await supabase
    .from("items_cuenta")
    .insert({
      cuenta_mesa_id: cuentaId,
      producto_id,
      cantidad: qty,
      precio_al_momento: producto.precio,
      origen,
      estado: estadoPedido,
    })
    .select("*, productos(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cuentaId: string }> },
) {
  const { cuentaId } = await params;
  const result = await requireApiAnyPermiso(["mesas", "caja"]);
  if (result instanceof NextResponse) return result;
  const { supabase } = result;
  const { data } = await supabase
    .from("items_cuenta")
    .select("*, productos(*)")
    .eq("cuenta_mesa_id", cuentaId)
    .neq("estado", "cancelado");
  return NextResponse.json(data);
}
