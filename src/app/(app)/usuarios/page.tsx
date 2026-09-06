"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserRole } from "@/types";
import { ROLE_LABELS } from "@/lib/permissions";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Profile[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("*")
      .order("nombre")
      .then(({ data }) => setUsuarios((data as Profile[]) ?? []));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="text-sm text-stone-500">
          Roles: dueño, admin, mostrador, mesero, cocina, caja
        </p>
      </div>

      <Card>
        <CardTitle>Equipo ({usuarios.length})</CardTitle>
        <ul className="mt-4 divide-y">
          {usuarios.map((u) => (
            <li key={u.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{u.nombre}</p>
                <p className="text-xs text-stone-500">{u.id.slice(0, 8)}...</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{ROLE_LABELS[u.rol as UserRole]}</Badge>
                <Badge color={u.activo ? "success" : "danger"}>
                  {u.activo ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-stone-400">
          Para crear usuarios nuevos, usa el script de seed o el panel de Supabase Auth.
        </p>
      </Card>
    </div>
  );
}
