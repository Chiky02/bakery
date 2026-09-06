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

  const { total_final, medio_pago } = await request.json();

  const { data: cuenta } = await supabase
    .from("cuentas_mesa")
    .select("mesa_id")
    .eq("id", cuentaId)
    .single();

  const { error } = await supabase
    .from("cuentas_mesa")
    .update({
      estado: "cerrada",
      hora_cierre: new Date().toISOString(),
      total_final,
      medio_pago,
    })
    .eq("id", cuentaId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (cuenta?.mesa_id) {
    await supabase.from("mesas").update({ estado: "libre" }).eq("id", cuenta.mesa_id);
  }

  return NextResponse.json({ ok: true });
}
