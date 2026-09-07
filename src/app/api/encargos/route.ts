import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";

export async function POST(request: Request) {
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  const body = await request.json();

  const { data, error } = await supabase
    .from("encargos")
    .insert({
      ...body,
      valor: Number(body.valor),
      panaderia_id: ctx.panaderia.id,
      creado_por: ctx.profile.id,
      estado: "pendiente",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
