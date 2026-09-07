"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Miembro, Profile, UserRole } from "@/types";
import { ROLE_LABELS } from "@/lib/permissions";
import { useBakeryId } from "@/lib/use-bakery-id";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function UsuariosPage() {
  const { panaderiaId } = useBakeryId();
  const [miembros, setMiembros] = useState<Miembro[]>([]);

  useEffect(() => {
    if (!panaderiaId) return;
    const supabase = createClient();
    supabase
      .from("miembros")
      .select("*, profiles(id, nombre, activo)")
      .eq("panaderia_id", panaderiaId)
      .order("rol")
      .then(({ data }) => setMiembros((data as Miembro[]) ?? []));
  }, [panaderiaId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="text-sm text-stone-500">
          Equipo de esta panadería. Roles: dueño, admin, mostrador, mesero, cocina, caja
        </p>
      </div>

      <Card>
        <CardTitle>Equipo ({miembros.length})</CardTitle>
        <ul className="mt-4 divide-y dark:divide-stone-800">
          {miembros.map((m) => {
            const p = m.profiles as Profile | undefined;
            return (
              <li key={m.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{p?.nombre ?? m.user_id.slice(0, 8)}</p>
                  <p className="text-xs text-stone-500">{m.user_id.slice(0, 8)}...</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{ROLE_LABELS[m.rol as UserRole]}</Badge>
                  <Badge color={m.activo ? "success" : "danger"}>
                    {m.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-stone-400">
          Crea usuarios en Supabase Auth y asígnalos a esta panadería en la tabla miembros (o con
          seed).
        </p>
      </Card>
    </div>
  );
}
