import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { isUserRole } from "@/lib/permissions";
import { setImpersonation } from "@/lib/impersonate";
import { getServiceClient } from "@/lib/supabase/admin";

async function logAudit(input: {
  operadorId: string;
  modo: "rol" | "usuario" | "salida";
  objetivoUserId?: string | null;
  panaderiaId?: string | null;
  detalle?: string;
}) {
  try {
    const admin = getServiceClient();
    await admin.from("auditoria_soporte").insert({
      operador_id: input.operadorId,
      modo: input.modo,
      objetivo_user_id: input.objetivoUserId ?? null,
      panaderia_id: input.panaderiaId ?? null,
      detalle: input.detalle ?? null,
    });
  } catch {
    // No bloquear si la tabla aún no existe
  }
}

/**
 * Solo operador de plataforma.
 * POST { rol } | { user_id, panaderia_id } | { clear: true }
 */
export async function POST(req: Request) {
  const profile = await getSessionProfile();
  if (!profile?.plataforma_admin) {
    return NextResponse.json({ error: "Solo el administrador de la plataforma" }, { status: 403 });
  }

  let body: {
    rol?: string | null;
    user_id?: string;
    panaderia_id?: string;
    clear?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (body.clear || (body.rol === null && !body.user_id)) {
    await setImpersonation(null);
    await logAudit({
      operadorId: profile.id,
      modo: "salida",
      detalle: "Fin de simulación",
    });
    return NextResponse.json({ ok: true, impersonating: null });
  }

  if (body.user_id) {
    if (!body.panaderia_id) {
      return NextResponse.json({ error: "Falta panaderia_id" }, { status: 400 });
    }
    try {
      const admin = getServiceClient();
      const { data: member } = await admin
        .from("miembros")
        .select("id, activo, user_id")
        .eq("user_id", body.user_id)
        .eq("panaderia_id", body.panaderia_id)
        .maybeSingle();

      if (!member?.activo) {
        return NextResponse.json(
          { error: "El usuario no es miembro activo de ese negocio" },
          { status: 400 },
        );
      }

      if (body.user_id === profile.id) {
        return NextResponse.json(
          { error: "No puedes simular tu propia cuenta" },
          { status: 400 },
        );
      }

      await setImpersonation({
        kind: "user",
        userId: body.user_id,
        panaderiaId: body.panaderia_id,
      });

      // Alinear panadería activa del operador con el local del usuario
      await admin
        .from("profiles")
        .update({ panaderia_activa_id: body.panaderia_id })
        .eq("id", profile.id);

      await logAudit({
        operadorId: profile.id,
        modo: "usuario",
        objetivoUserId: body.user_id,
        panaderiaId: body.panaderia_id,
        detalle: "Simulación de vista de usuario del equipo",
      });

      return NextResponse.json({
        ok: true,
        impersonating: { kind: "user", user_id: body.user_id, panaderia_id: body.panaderia_id },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "No se pudo simular el usuario";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const raw = body.rol;
  if (typeof raw !== "string" || !isUserRole(raw)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  await setImpersonation({ kind: "rol", rol: raw });
  await logAudit({
    operadorId: profile.id,
    modo: "rol",
    detalle: `Simulación de rol ${raw}`,
  });
  return NextResponse.json({ ok: true, impersonating: { kind: "rol", rol: raw } });
}

export async function DELETE() {
  const profile = await getSessionProfile();
  if (!profile?.plataforma_admin) {
    return NextResponse.json({ error: "Solo el administrador de la plataforma" }, { status: 403 });
  }
  await setImpersonation(null);
  await logAudit({
    operadorId: profile.id,
    modo: "salida",
    detalle: "Fin de simulación",
  });
  return NextResponse.json({ ok: true, impersonating: null });
}
