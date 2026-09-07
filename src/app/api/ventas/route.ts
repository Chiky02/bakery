import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";

export async function POST(request: Request) {
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  const body = await request.json();
  const { total, medio_pago, detalle } = body;

  const { data, error } = await supabase
    .from("ventas_mostrador")
    .insert({
      panaderia_id: ctx.panaderia.id,
      total,
      medio_pago,
      detalle,
      registrado_por: ctx.profile.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
