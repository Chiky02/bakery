import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: mesaId } = await params;
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  const { data: mesa } = await supabase
    .from("mesas")
    .select("id, panaderia_id")
    .eq("id", mesaId)
    .eq("panaderia_id", ctx.panaderia.id)
    .single();

  if (!mesa) return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });

  const { data: existing } = await supabase
    .from("cuentas_mesa")
    .select("*")
    .eq("mesa_id", mesaId)
    .eq("estado", "abierta")
    .maybeSingle();

  if (existing) return NextResponse.json(existing);

  const { data: cuenta, error } = await supabase
    .from("cuentas_mesa")
    .insert({
      mesa_id: mesaId,
      panaderia_id: ctx.panaderia.id,
      mesero_id: ctx.profile.id,
      estado: "abierta",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("mesas").update({ estado: "ocupada" }).eq("id", mesaId);

  return NextResponse.json(cuenta);
}
