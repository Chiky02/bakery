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

  const { etiqueta } = await request.json();

  const { data, error } = await supabase
    .from("sub_cuentas")
    .insert({ cuenta_mesa_id: cuentaId, etiqueta, estado: "abierta" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
