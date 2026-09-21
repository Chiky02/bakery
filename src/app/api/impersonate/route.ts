import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { isUserRole } from "@/lib/permissions";
import { setImpersonateRol } from "@/lib/impersonate";

/**
 * Solo operador de plataforma (profiles.plataforma_admin).
 * POST { rol } → simula; DELETE / POST { rol: null } → sale de simulación.
 */
export async function POST(req: Request) {
  const profile = await getSessionProfile();
  if (!profile?.plataforma_admin) {
    return NextResponse.json({ error: "Solo el administrador de la plataforma" }, { status: 403 });
  }

  let body: { rol?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const raw = body.rol;
  if (raw === null || raw === undefined || raw === "") {
    await setImpersonateRol(null);
    return NextResponse.json({ ok: true, impersonating: null });
  }

  if (typeof raw !== "string" || !isUserRole(raw)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  await setImpersonateRol(raw);
  return NextResponse.json({ ok: true, impersonating: raw });
}

export async function DELETE() {
  const profile = await getSessionProfile();
  if (!profile?.plataforma_admin) {
    return NextResponse.json({ error: "Solo el administrador de la plataforma" }, { status: 403 });
  }
  await setImpersonateRol(null);
  return NextResponse.json({ ok: true, impersonating: null });
}
