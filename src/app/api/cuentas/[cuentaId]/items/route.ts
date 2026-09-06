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

  const { data: producto } = await supabase
    .from("productos")
    .select("precio, disponible")
    .eq("id", producto_id)
    .single();

  if (!producto?.disponible) {
    return NextResponse.json({ error: "Producto no disponible" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("items_cuenta")
    .insert({
      cuenta_mesa_id: cuentaId,
      producto_id,
      cantidad,
      precio_al_momento: producto.precio,
      origen,
      estado: "pendiente",
    })
    .select()
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
    .eq("cuenta_mesa_id", cuentaId);
  return NextResponse.json(data);
}
