import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { getServiceClient } from "@/lib/supabase/admin";
import { ROLE_LABELS } from "@/lib/permissions";
import type { UserRole } from "@/types";

export type EquipoMember = {
  id: string;
  user_id: string;
  panaderia_id: string;
  rol: UserRole;
  role_id: string | null;
  activo: boolean;
  nombre: string;
  profile_activo: boolean;
  role_nombre: string | null;
};

function canManagePanaderia(
  memberships: { panaderia_id: string; rol: string }[],
  panaderiaId: string,
) {
  return memberships.some(
    (m) =>
      m.panaderia_id === panaderiaId && (m.rol === "dueno" || m.rol === "admin"),
  );
}

/** Lista el equipo de una panadería (service role; evita embeds RLS rotos). */
export async function GET(request: Request) {
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx } = result;

  if (!ctx.plataformaAdmin) {
    if (!["dueno", "admin"].includes(ctx.rol)) {
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
    }
  }

  const url = new URL(request.url);
  const panaderiaId = url.searchParams.get("panaderia_id") || ctx.panaderia.id;

  if (!ctx.plataformaAdmin && !canManagePanaderia(ctx.memberships, panaderiaId)) {
    return NextResponse.json({ error: "Sin permiso en ese negocio" }, { status: 403 });
  }

  try {
    const admin = getServiceClient();
    const { data: miembros, error } = await admin
      .from("miembros")
      .select("id, user_id, panaderia_id, rol, role_id, activo")
      .eq("panaderia_id", panaderiaId)
      .order("rol");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const rows = miembros ?? [];
    const userIds = [...new Set(rows.map((m) => m.user_id))];
    const roleIds = [...new Set(rows.map((m) => m.role_id).filter(Boolean))] as string[];

    const [{ data: profiles }, { data: roles }] = await Promise.all([
      userIds.length
        ? admin.from("profiles").select("id, nombre, activo").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; nombre: string; activo: boolean }[] }),
      roleIds.length
        ? admin.from("roles").select("id, nombre").in("id", roleIds)
        : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
    ]);

    const profileById = new Map(
      ((profiles as { id: string; nombre: string; activo: boolean }[]) ?? []).map((p) => [
        p.id,
        p,
      ]),
    );
    const roleById = new Map(
      ((roles as { id: string; nombre: string }[]) ?? []).map((r) => [r.id, r.nombre]),
    );

    const members: EquipoMember[] = rows.map((m) => {
      const profile = profileById.get(m.user_id);
      const rol = m.rol as UserRole;
      return {
        id: m.id,
        user_id: m.user_id,
        panaderia_id: m.panaderia_id,
        rol,
        role_id: m.role_id,
        activo: m.activo,
        nombre: profile?.nombre?.trim() || "Sin nombre",
        profile_activo: profile?.activo ?? true,
        role_nombre: (m.role_id && roleById.get(m.role_id)) || ROLE_LABELS[rol] || rol,
      };
    });

    members.sort((a, b) => a.nombre.localeCompare(b.nombre));

    return NextResponse.json({ members, panaderia_id: panaderiaId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo cargar el equipo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
