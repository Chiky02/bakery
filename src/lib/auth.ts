import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Miembro, Panaderia, Profile, RolCustom, SessionContext, UserRole } from "@/types";
import {
  ROLE_LABELS,
  canAccess,
  FEATURE_PERMISOS,
  resolveSessionPermisos,
} from "@/lib/permissions";
import { readImpersonation } from "@/lib/impersonate";
import { getServiceClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

/** Deduped per request: layout + page share the same Auth roundtrip. */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nombre, activo, panaderia_activa_id, plataforma_admin")
    .eq("id", user.id)
    .single();

  // Columna nueva aún no migrada: reintenta sin ella
  if (error?.message?.includes("plataforma_admin")) {
    const { data: fallback } = await supabase
      .from("profiles")
      .select("id, nombre, activo, panaderia_activa_id")
      .eq("id", user.id)
      .single();
    if (!fallback) return null;
    return { ...(fallback as Profile), plataforma_admin: false };
  }

  if (!data) return null;
  const row = data as Profile & { plataforma_admin?: boolean };
  return {
    id: row.id,
    nombre: row.nombre,
    activo: row.activo,
    panaderia_activa_id: row.panaderia_activa_id,
    plataforma_admin: !!row.plataforma_admin,
  };
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile || !profile.activo) redirect("/login");
  return profile;
}

export const getSessionContext = cache(async (): Promise<SessionContext | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  const [profile, membershipsRes] = await Promise.all([
    getSessionProfile(),
    supabase
      .from("miembros")
      .select("*, panaderias(*), roles(*, role_permisos(permiso))")
      .eq("user_id", user.id)
      .eq("activo", true),
  ]);

  if (!profile || !profile.activo) return null;

  const list = (membershipsRes.data as Miembro[]) ?? [];
  if (list.length === 0) return null;

  const isPlatformOperator = !!profile.plataforma_admin;
  const imp = isPlatformOperator ? await readImpersonation() : null;

  let active =
    list.find((m) => m.panaderia_id === profile.panaderia_activa_id) ?? list[0];

  let impersonating: UserRole | null = null;
  let impersonatingUser: SessionContext["impersonatingUser"] = null;
  let rol: UserRole = active.rol as UserRole;
  let custom = (active.roles as RolCustom | null | undefined) ?? null;
  let panaderia = active.panaderias as Panaderia;

  if (imp?.kind === "rol") {
    impersonating = imp.rol;
    rol = imp.rol;
    custom = null;
  } else if (imp?.kind === "user") {
    try {
      const admin = getServiceClient();
      const { data: targetMember } = await admin
        .from("miembros")
        .select("*, panaderias(*), roles(*, role_permisos(permiso))")
        .eq("user_id", imp.userId)
        .eq("panaderia_id", imp.panaderiaId)
        .eq("activo", true)
        .maybeSingle();

      if (targetMember) {
        const tm = targetMember as Miembro;
        active = tm;
        panaderia = tm.panaderias as Panaderia;
        rol = tm.rol as UserRole;
        custom = (tm.roles as RolCustom | null | undefined) ?? null;
        impersonating = rol;

        const { data: targetProfile } = await admin
          .from("profiles")
          .select("id, nombre")
          .eq("id", imp.userId)
          .maybeSingle();

        impersonatingUser = {
          id: imp.userId,
          nombre: targetProfile?.nombre?.trim() || "Usuario",
          panaderiaId: imp.panaderiaId,
        };
      }
    } catch {
      // Sin service role o membership inválido: ignorar impersonación
    }
  }

  const actingAsOther = !!impersonating || !!impersonatingUser;
  /** Efectivo: apagado durante simulación para que APIs/UI reflejen el rol. */
  const plataformaAdmin = isPlatformOperator && !actingAsOther;

  if (!impersonatingUser && profile.panaderia_activa_id !== active.panaderia_id) {
    await supabase
      .from("profiles")
      .update({ panaderia_activa_id: active.panaderia_id })
      .eq("id", profile.id);
    profile.panaderia_activa_id = active.panaderia_id;
  }

  if (!panaderia) return null;

  const roleLabel = impersonatingUser
    ? `Como: ${impersonatingUser.nombre} (${custom?.nombre?.trim() || ROLE_LABELS[rol]})`
    : impersonating
      ? `Simulando: ${ROLE_LABELS[impersonating]}`
      : isPlatformOperator
        ? "Admin plataforma"
        : custom?.nombre?.trim() || ROLE_LABELS[rol];

  const fromDb = custom?.role_permisos?.map((p) => p.permiso) ?? [];
  const permisos =
    impersonating || impersonatingUser
      ? resolveSessionPermisos(
          rol,
          impersonatingUser && fromDb.length > 0 ? fromDb : null,
          false,
        )
      : resolveSessionPermisos(rol, fromDb.length > 0 ? fromDb : null, plataformaAdmin);

  return {
    profile,
    panaderia,
    rol,
    roleLabel,
    permisos,
    memberships: list,
    plataformaAdmin,
    isPlatformOperator,
    impersonating: impersonatingUser ? null : impersonating,
    impersonatingUser,
  };
});

export async function requireBakeryContext(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) {
    const profile = await getSessionProfile();
    if (!profile) redirect("/login");
    redirect("/panaderias");
  }
  return ctx;
}

/** Bloquea página si el rol/permisos no incluyen el módulo. */
export async function requireFeature(featureKey: string): Promise<SessionContext> {
  const ctx = await requireBakeryContext();
  const feature = FEATURE_PERMISOS.find((f) => f.key === featureKey);
  const href = feature?.href ?? `/${featureKey}`;
  if (!canAccess(ctx.rol, href, ctx.permisos, { plataformaAdmin: ctx.plataformaAdmin })) {
    const fallback =
      FEATURE_PERMISOS.find((f) =>
        canAccess(ctx.rol, f.href, ctx.permisos, { plataformaAdmin: ctx.plataformaAdmin }),
      )?.href ?? "/panaderias";
    redirect(fallback);
  }
  return ctx;
}
