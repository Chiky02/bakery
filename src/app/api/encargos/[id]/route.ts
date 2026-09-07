import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  const body = await request.json();
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.estado !== undefined) patch.estado = body.estado;
  if (body.estado_pago !== undefined) patch.estado_pago = body.estado_pago;
  if (body.abono !== undefined) patch.abono = Number(body.abono) || 0;
  if (body.valor !== undefined) patch.valor = Number(body.valor) || 0;
  if (body.notas !== undefined) patch.notas = body.notas;

  const { data, error } = await supabase
    .from("encargos")
    .update(patch)
    .eq("id", id)
    .eq("panaderia_id", ctx.panaderia.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
