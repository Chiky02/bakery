import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cuentaId: string }> },
) {
  const { cuentaId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { producto_id, origen = "mesero", cantidad = 1 } = body;
  const qty = Math.max(1, Number(cantidad) || 1);

  const { data: producto } = await supabase
    .from("productos")
    .select("precio, disponible, tipo")
    .eq("id", producto_id)
    .single();

  if (!producto?.disponible) {
    return NextResponse.json({ error: "Producto no disponible" }, { status: 400 });
  }
  if ((producto as { tipo?: string }).tipo === "materia_prima") {
    return NextResponse.json({ error: "Producto no disponible" }, { status: 400 });
  }

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
      estado: "pendiente",
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
  const supabase = await createClient();
  const { data } = await supabase
    .from("items_cuenta")
    .select("*, productos(*)")
    .eq("cuenta_mesa_id", cuentaId)
    .neq("estado", "cancelado");
  return NextResponse.json(data);
}
