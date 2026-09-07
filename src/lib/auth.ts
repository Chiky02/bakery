import { createClient } from "@/lib/supabase/server";
import type { Miembro, Panaderia, Profile, RolCustom, SessionContext, UserRole } from "@/types";
import { ROLE_LABELS, defaultPermisosForRole } from "@/lib/permissions";
import { redirect } from "next/navigation";

export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, nombre, activo, panaderia_activa_id")
    .eq("id", user.id)
    .single();

  return data as Profile | null;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile || !profile.activo) redirect("/login");
  return profile;
}

function resolvePermisos(rol: UserRole, custom?: RolCustom | null): string[] {
  const fromDb = custom?.role_permisos?.map((p) => p.permiso) ?? [];
  if (fromDb.length > 0) return fromDb;
  return defaultPermisosForRole(rol);
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nombre, activo, panaderia_activa_id")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.activo) return null;

  const { data: memberships } = await supabase
    .from("miembros")
    .select("*, panaderias(*), roles(*, role_permisos(permiso))")
    .eq("user_id", user.id)
    .eq("activo", true);

  const list = (memberships as Miembro[]) ?? [];
  if (list.length === 0) return null;

  let active =
    list.find((m) => m.panaderia_id === profile.panaderia_activa_id) ?? list[0];

  if (profile.panaderia_activa_id !== active.panaderia_id) {
    await supabase
      .from("profiles")
      .update({ panaderia_activa_id: active.panaderia_id })
      .eq("id", profile.id);
  }

  const panaderia = active.panaderias as Panaderia;
  if (!panaderia) return null;

  const rol = active.rol as UserRole;
  const custom = (active.roles as RolCustom | null | undefined) ?? null;
  const roleLabel = custom?.nombre?.trim() || ROLE_LABELS[rol];
  const permisos = resolvePermisos(rol, custom);

  return {
    profile: profile as Profile,
    panaderia,
    rol,
    roleLabel,
    permisos,
    memberships: list,
  };
}

export async function requireBakeryContext(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) {
    const profile = await getSessionProfile();
    if (!profile) redirect("/login");
    redirect("/panaderias");
  }
  return ctx;
}
