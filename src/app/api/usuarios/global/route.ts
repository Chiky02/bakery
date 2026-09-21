import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { requireApiContext } from "@/lib/api-context";
import { getServiceClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types";

export type GlobalMembership = {
  miembro_id: string;
  panaderia_id: string;
  panaderia_nombre: string;
  panaderia_slug: string;
  rol: UserRole;
  role_nombre: string | null;
  activo: boolean;
};

export type GlobalAuthUser = {
  id: string;
  email: string;
  nombre: string;
  activo: boolean;
  created_at: string | null;
  last_sign_in_at: string | null;
  memberships: GlobalMembership[];
};

async function listAllAuthUsers(admin: ReturnType<typeof getServiceClient>): Promise<User[]> {
  const users: User[] = [];
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
    if (page > 50) break;
  }
  return users;
}

export async function GET() {
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx } = result;

  if (!["dueno", "admin"].includes(ctx.rol)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    const admin = getServiceClient();
    const authUsers = await listAllAuthUsers(admin);
    const ids = authUsers.map((u) => u.id);

    const [{ data: profiles }, { data: miembros }] = await Promise.all([
      ids.length
        ? admin.from("profiles").select("id, nombre, activo").in("id", ids)
        : Promise.resolve({ data: [] as { id: string; nombre: string; activo: boolean }[] }),
      ids.length
        ? admin
            .from("miembros")
            .select(
              "id, user_id, panaderia_id, rol, activo, panaderias(nombre, slug), roles(nombre)",
            )
            .in("user_id", ids)
        : Promise.resolve({ data: [] as unknown[] }),
    ]);

    const profileById = new Map(
      ((profiles as { id: string; nombre: string; activo: boolean }[]) ?? []).map((p) => [
        p.id,
        p,
      ]),
    );

    const membershipsByUser = new Map<string, GlobalMembership[]>();
    for (const m of (miembros as Array<{
      id: string;
      user_id: string;
      panaderia_id: string;
      rol: UserRole;
      activo: boolean;
      panaderias: { nombre?: string; slug?: string } | null;
      roles: { nombre?: string } | null;
    }>) ?? []) {
      const list = membershipsByUser.get(m.user_id) ?? [];
      list.push({
        miembro_id: m.id,
        panaderia_id: m.panaderia_id,
        panaderia_nombre: m.panaderias?.nombre ?? "Negocio",
        panaderia_slug: m.panaderias?.slug ?? "",
        rol: m.rol,
        role_nombre: m.roles?.nombre ?? null,
        activo: m.activo,
      });
      membershipsByUser.set(m.user_id, list);
    }

    const users: GlobalAuthUser[] = authUsers
      .map((u) => {
        const profile = profileById.get(u.id);
        const memberships = membershipsByUser.get(u.id) ?? [];
        memberships.sort((a, b) => a.panaderia_nombre.localeCompare(b.panaderia_nombre));
        return {
          id: u.id,
          email: u.email ?? "",
          nombre:
            profile?.nombre?.trim() ||
            (u.user_metadata?.nombre as string | undefined)?.trim() ||
            u.email?.split("@")[0] ||
            "Sin nombre",
          activo: profile?.activo ?? true,
          created_at: u.created_at ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
          memberships,
        };
      })
      .sort((a, b) => a.email.localeCompare(b.email));

    return NextResponse.json({
      users,
      totals: {
        cuentas: users.length,
        sin_negocio: users.filter((u) => u.memberships.length === 0).length,
        inactivos: users.filter((u) => !u.activo).length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudieron listar cuentas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
