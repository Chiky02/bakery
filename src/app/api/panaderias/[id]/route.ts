import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiContext } from "@/lib/api-context";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx } = result;

  if (ctx.rol !== "dueno") {
    return NextResponse.json({ error: "Solo el dueño puede borrar" }, { status: 403 });
  }
  if (id !== ctx.panaderia.id && !ctx.memberships.some((m) => m.panaderia_id === id && m.rol === "dueno")) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const admin = getServiceClient();

  // Prefer RPC if exists
  const { error: rpcErr } = await admin.rpc("delete_panaderia_if_empty", { p_id: id });
  if (!rpcErr) {
    return NextResponse.json({ ok: true });
  }

  // Fallback manual
  const checks = await Promise.all([
    admin.from("productos").select("id", { count: "exact", head: true }).eq("panaderia_id", id),
    admin.from("mesas").select("id", { count: "exact", head: true }).eq("panaderia_id", id),
    admin.from("ventas_mostrador").select("id", { count: "exact", head: true }).eq("panaderia_id", id),
    admin.from("encargos").select("id", { count: "exact", head: true }).eq("panaderia_id", id),
    admin.from("cuentas_mesa").select("id", { count: "exact", head: true }).eq("panaderia_id", id),
  ]);
  if (checks.some((c) => (c.count ?? 0) > 0)) {
    return NextResponse.json(
      { error: "La panadería tiene datos; no se puede borrar. Ejecuta la migración 20260907020000 si falta la función." },
      { status: 400 },
    );
  }

  await admin.from("miembros").delete().eq("panaderia_id", id);
  await admin.from("profiles").update({ panaderia_activa_id: null }).eq("panaderia_activa_id", id);
  const { error } = await admin.from("panaderias").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
