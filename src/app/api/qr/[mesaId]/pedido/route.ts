import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ mesaId: string }> },
) {
  const { mesaId } = await params;
  const supabase = getServiceClient();
  const { items } = await request.json();

  const { data: mesa } = await supabase
    .from("mesas")
    .select("*")
    .eq("id", mesaId)
    .single();

  if (!mesa?.qr_habilitado) {
    return NextResponse.json({ error: "QR deshabilitado" }, { status: 403 });
  }

  const { data: panaderia } = await supabase
    .from("panaderias")
    .select("*")
    .eq("id", mesa.panaderia_id)
    .single();

  if (!panaderia?.pedido_directo_habilitado) {
    return NextResponse.json({ error: "QR deshabilitado" }, { status: 403 });
  }

  let { data: cuenta } = await supabase
    .from("cuentas_mesa")
    .select("*")
    .eq("mesa_id", mesaId)
    .eq("estado", "abierta")
    .maybeSingle();

  if (!cuenta) {
    const { data: nueva } = await supabase
      .from("cuentas_mesa")
      .insert({
        mesa_id: mesaId,
        panaderia_id: mesa.panaderia_id,
        estado: "abierta",
      })
      .select()
      .single();
    cuenta = nueva;
    await supabase.from("mesas").update({ estado: "ocupada" }).eq("id", mesaId);
  }

  if (!cuenta) {
    return NextResponse.json({ error: "No se pudo abrir cuenta" }, { status: 500 });
  }

  const estadoInicial = panaderia.requiere_aprobacion_mesero
    ? "pendiente_confirmacion"
    : "pendiente";

  const inserts = [];
  for (const item of items) {
    const { data: producto } = await supabase
      .from("productos")
      .select("precio, disponible, panaderia_id")
      .eq("id", item.producto_id)
      .eq("panaderia_id", mesa.panaderia_id)
      .single();

    if (!producto?.disponible) continue;

    inserts.push({
      cuenta_mesa_id: cuenta.id,
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      precio_al_momento: producto.precio,
      origen: "cliente_qr",
      estado: estadoInicial,
    });
  }

  const { error } = await supabase.from("items_cuenta").insert(inserts);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.rpc("notify_panaderia", {
    p_panaderia: mesa.panaderia_id,
    p_tipo: "pedido_qr",
    p_titulo: `Pedido QR · ${mesa.nombre}`,
    p_cuerpo: `${inserts.length} ítem(s) nuevos`,
    p_roles: ["dueno", "admin", "mesero", "cocina"],
  });

  return NextResponse.json({ ok: true, cuenta_id: cuenta.id });
}
