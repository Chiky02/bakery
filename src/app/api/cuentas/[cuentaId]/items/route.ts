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
  const { producto_id, origen = "mesero", cantidad = 1, client_request_id, estado: estadoCliente } =
    body;
  const qty = Math.max(1, Number(cantidad) || 1);
  const requestId =
    typeof client_request_id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      client_request_id,
    )
      ? client_request_id
      : null;

  if (requestId) {
    const { data: dup, error: dupErr } = await supabase
      .from("items_cuenta")
      .select("*, productos(*)")
      .eq("client_request_id", requestId)
      .maybeSingle();
    if (!dupErr && dup) return NextResponse.json(dup);
  }

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
  const estadosSync = ["pendiente", "en_preparacion", "listo"] as const;
  const estadoFinal =
    requestId && estadosSync.includes(estadoCliente) ? estadoCliente : estadoPedido;

  const { data: existing } = requestId
    ? { data: null }
    : await supabase
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

  const insertRow: Record<string, unknown> = {
    cuenta_mesa_id: cuentaId,
    producto_id,
    cantidad: qty,
    precio_al_momento: producto.precio,
    origen,
    estado: estadoFinal,
  };
  if (requestId) insertRow.client_request_id = requestId;

  let { data, error } = await supabase
    .from("items_cuenta")
    .insert(insertRow)
    .select("*, productos(*)")
    .single();

  if (error && requestId && /client_request_id|column|schema cache|Could not find/i.test(error.message)) {
    delete insertRow.client_request_id;
    const again = await supabase.from("items_cuenta").insert(insertRow).select("*, productos(*)").single();
    data = again.data;
    error = again.error;
  }

  if (error && requestId && /duplicate|unique|23505/i.test(error.message)) {
    const { data: dup } = await supabase
      .from("items_cuenta")
      .select("*, productos(*)")
      .eq("client_request_id", requestId)
      .maybeSingle();
    if (dup) return NextResponse.json(dup);
  }

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
