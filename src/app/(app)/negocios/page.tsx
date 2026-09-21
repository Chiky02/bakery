import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABELS } from "@/lib/permissions";
import type { UserRole } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type MemberRow = {
  id: string;
  rol: UserRole;
  activo: boolean;
  panaderia_id: string;
  profiles: { nombre?: string } | null;
  roles: { nombre?: string; codigo?: string; rol_base?: UserRole } | null;
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

  const [{ data: panaderias }, { data: miembros }] = await Promise.all([
    supabase
      .from("panaderias")
      .select("id, nombre, slug, activa, telefono, direccion")
      .in("id", panaderiaIds)
      .order("nombre"),
    supabase
      .from("miembros")
      .select("id, rol, activo, panaderia_id, profiles(nombre), roles(nombre, codigo, rol_base)")
      .in("panaderia_id", panaderiaIds)
      .order("rol"),
  ]);

  const list = (panaderias as PanaderiaRow[] | null) ?? [];
  const members = (miembros as MemberRow[] | null) ?? [];

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
                    {isActiva && (
                      <Link
                        href="/usuarios"
                        className="rounded-lg border border-stone-200 px-3 py-1.5 font-medium text-stone-700 hover:bg-stone-50"
                      >
                        Gestionar equipo
                      </Link>
                    )}
                  </div>
                </div>

                {team.length === 0 ? (
                  <p className="text-sm text-stone-500">Sin usuarios asignados.</p>
                ) : (
                  <ul className="divide-y border-t border-stone-100">
                    {team.map((m) => {
                      const profile = m.profiles;
                      const custom = m.roles;
                      const roleName =
                        custom?.nombre?.trim() || ROLE_LABELS[m.rol] || m.rol;
                      const baseLabel = ROLE_LABELS[m.rol] ?? m.rol;

                      return (
                        <li
                          key={m.id}
                          className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="font-medium text-stone-900">
                              {profile?.nombre?.trim() || "Sin nombre"}
                            </p>
                            <p className="text-xs text-stone-500">
                              Nivel base: {baseLabel}
                              {custom?.nombre && custom.nombre !== baseLabel
                                ? ` · rol custom`
                                : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge color="info">{roleName}</Badge>
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
        Para invitar o cambiar roles del local en el que estás, usa{" "}
        <Link href="/usuarios" className="underline hover:text-stone-600">
          Usuarios
        </Link>
        . El alta de un negocio nuevo está en Configuración.
      </p>
    </div>
  );
}
