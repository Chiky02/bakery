import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: mesaId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: existing } = await supabase
    .from("cuentas_mesa")
    .select("*")
    .eq("mesa_id", mesaId)
    .eq("estado", "abierta")
    .maybeSingle();

  if (existing) return NextResponse.json(existing);

  const { data: cuenta, error } = await supabase
    .from("cuentas_mesa")
    .insert({ mesa_id: mesaId, mesero_id: user.id, estado: "abierta" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("mesas").update({ estado: "ocupada" }).eq("id", mesaId);

  return NextResponse.json(cuenta);
}
