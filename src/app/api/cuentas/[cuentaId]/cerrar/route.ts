import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiContext } from "@/lib/api-context";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cuentaId: string }> },
) {
  const { cuentaId } = await params;
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  if (!["dueno", "admin", "mesero", "caja"].includes(ctx.rol)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { total_final, medio_pago } = body as {
    total_final?: number;
    medio_pago?: string;
  };

  const { data: cuenta, error: cErr } = await supabase
    .from("cuentas_mesa")
    .select("id, mesa_id, panaderia_id, estado")
    .eq("id", cuentaId)
    .eq("panaderia_id", ctx.panaderia.id)
    .single();

  if (cErr || !cuenta) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  if (cuenta.estado === "cerrada") {
    return NextResponse.json({ ok: true, already: true });
  }

  const { error } = await supabase
    .from("cuentas_mesa")
    .update({
      estado: "cerrada",
      hora_cierre: new Date().toISOString(),
      total_final: total_final ?? null,
      medio_pago: medio_pago ?? null,
    })
    .eq("id", cuentaId)
    .eq("panaderia_id", ctx.panaderia.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Cierra subcuentas abiertas asociadas
  await supabase
    .from("sub_cuentas")
    .update({ estado: "cerrada", total: total_final ?? null, medio_pago: medio_pago ?? null })
    .eq("cuenta_mesa_id", cuentaId)
    .eq("estado", "abierta");

  // Saca ítems de la cola de cocina
  await supabase
    .from("items_cuenta")
    .update({ estado: "entregado", updated_at: new Date().toISOString() })
    .eq("cuenta_mesa_id", cuentaId)
    .neq("estado", "cancelado");

  if (cuenta.mesa_id) {
    const { error: mErr } = await supabase
      .from("mesas")
      .update({ estado: "libre" })
      .eq("id", cuenta.mesa_id)
      .eq("panaderia_id", ctx.panaderia.id);
    if (mErr) {
      return NextResponse.json(
        { error: `Cuenta cerrada pero mesa no liberada: ${mErr.message}` },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
