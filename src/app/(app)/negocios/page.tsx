import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/admin";
import { ROLE_LABELS } from "@/lib/permissions";
import type { UserRole } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GestionarEquipoButton } from "./gestionar-equipo-button";
import Link from "next/link";

type MemberRow = {
  id: string;
  rol: UserRole;
  activo: boolean;
  panaderia_id: string;
  user_id: string;
  role_id: string | null;
  nombre: string;
  role_nombre: string | null;
};

type PanaderiaRow = {
  id: string;
  nombre: string;
  slug: string;
  activa: boolean;
  telefono?: string | null;
  direccion?: string | null;
};

export default async function NegociosPage() {
  const { memberships, panaderia: activa } = await requireFeature("negocios");
  const supabase = await createClient();

  const managedIds = memberships
    .filter((m) => m.rol === "dueno" || m.rol === "admin")
    .map((m) => m.panaderia_id);

  const panaderiaIds = managedIds.length > 0 ? managedIds : [activa.id];

  const { data: panaderias } = await supabase
    .from("panaderias")
    .select("id, nombre, slug, activa, telefono, direccion")
    .in("id", panaderiaIds)
    .order("nombre");

  const list = (panaderias as PanaderiaRow[] | null) ?? [];

  // Service role: evita embeds profiles/roles rotos por RLS
  const admin = getServiceClient();
  const { data: miembrosRaw } = await admin
    .from("miembros")
    .select("id, rol, activo, panaderia_id, user_id, role_id")
    .in("panaderia_id", panaderiaIds)
    .order("rol");

  const raw = miembrosRaw ?? [];
  const userIds = [...new Set(raw.map((m) => m.user_id))];
  const roleIds = [...new Set(raw.map((m) => m.role_id).filter(Boolean))] as string[];

  const [{ data: profiles }, { data: roles }] = await Promise.all([
    userIds.length
      ? admin.from("profiles").select("id, nombre").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
    roleIds.length
      ? admin.from("roles").select("id, nombre").in("id", roleIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
  ]);

  const profileById = new Map(
    ((profiles as { id: string; nombre: string }[]) ?? []).map((p) => [p.id, p.nombre]),
  );
  const roleById = new Map(
    ((roles as { id: string; nombre: string }[]) ?? []).map((r) => [r.id, r.nombre]),
  );

  const members: MemberRow[] = raw.map((m) => {
    const rol = m.rol as UserRole;
    return {
      id: m.id,
      rol,
      activo: m.activo,
      panaderia_id: m.panaderia_id,
      user_id: m.user_id,
      role_id: m.role_id,
      nombre: profileById.get(m.user_id)?.trim() || "Sin nombre",
      role_nombre: (m.role_id && roleById.get(m.role_id)) || ROLE_LABELS[rol] || rol,
    };
  });

  const byPanaderia = new Map<string, MemberRow[]>();
  for (const m of members) {
    const arr = byPanaderia.get(m.panaderia_id) ?? [];
    arr.push(m);
    byPanaderia.set(m.panaderia_id, arr);
  }

  const totalPersonas = members.length;
  const activos = members.filter((m) => m.activo).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Negocios</h1>
          <p className="text-sm text-stone-500">
            Locales a tu cargo y el equipo asignado a cada uno, con su rol
          </p>
        </div>
        <p className="text-sm text-stone-500">
          {list.length} negocio{list.length === 1 ? "" : "s"} · {activos}/{totalPersonas} personas
          activas
        </p>
      </div>

      {list.length === 0 ? (
        <Card>
          <p className="text-sm text-stone-500">No hay negocios para mostrar.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {list.map((p) => {
            const team = byPanaderia.get(p.id) ?? [];
            const teamActivos = team.filter((m) => m.activo).length;
            const isActiva = p.id === activa.id;

            return (
              <Card key={p.id} className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg">{p.nombre}</CardTitle>
                      <Badge color={p.activa ? "success" : "danger"}>
                        {p.activa ? "Activa" : "Inactiva"}
                      </Badge>
                      {isActiva && <Badge color="info">Sesión actual</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-stone-500">/{p.slug}</p>
                    {(p.direccion || p.telefono) && (
                      <p className="mt-1 text-sm text-stone-500">
                        {[p.direccion, p.telefono].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-stone-500">
                      {teamActivos}/{team.length} usuario{team.length === 1 ? "" : "s"}
                    </span>
                    <GestionarEquipoButton panaderiaId={p.id} isActiva={isActiva} />
                  </div>
                </div>

                {team.length === 0 ? (
                  <p className="text-sm text-stone-500">Sin usuarios asignados.</p>
                ) : (
                  <ul className="divide-y border-t border-stone-100">
                    {team.map((m) => {
                      const baseLabel = ROLE_LABELS[m.rol] ?? m.rol;
                      return (
                        <li
                          key={m.id}
                          className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-medium text-stone-900">{m.nombre}</p>
                            <p className="text-xs text-stone-500">
                              Nivel base: {baseLabel}
                              {m.role_nombre && m.role_nombre !== baseLabel
                                ? " · rol custom"
                                : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge color="info">{m.role_nombre ?? baseLabel}</Badge>
                            <Badge color={m.activo ? "success" : "danger"}>
                              {m.activo ? "Activo" : "Inactivo"}
                            </Badge>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-stone-400">
        Para invitar o cambiar roles del local, usa{" "}
        <Link href="/usuarios" className="underline hover:text-stone-600">
          Usuarios → Equipo
        </Link>
        . El alta de un negocio nuevo está en Configuración.
      </p>
    </div>
  );
}
