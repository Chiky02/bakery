import { NextResponse } from "next/server";
import { requireApiAnyPermiso } from "@/lib/api-context";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await requireApiAnyPermiso(["mesas", "cocina"]);
  if (result instanceof NextResponse) return result;
  const { supabase } = result;

  const body = await request.json();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.estado) updates.estado = body.estado;
  if ("sub_cuenta_id" in body) updates.sub_cuenta_id = body.sub_cuenta_id;
  if (typeof body.cantidad === "number") {
    if (body.cantidad <= 0) {
      updates.estado = "cancelado";
    } else {
      updates.cantidad = body.cantidad;
    }
  }

  const { data, error } = await supabase
    .from("items_cuenta")
    .update(updates)
    .eq("id", id)
    .select("*, productos(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await requireApiAnyPermiso(["mesas"]);
  if (result instanceof NextResponse) return result;
  const { supabase } = result;

  const { data, error } = await supabase
    .from("items_cuenta")
    .update({ estado: "cancelado", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, productos(*)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
