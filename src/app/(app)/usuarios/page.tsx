"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Miembro, Profile, UserRole } from "@/types";
import { ROLE_LABELS } from "@/lib/permissions";
import { useBakeryId } from "@/lib/use-bakery-id";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function UsuariosPage() {
  const { panaderiaId } = useBakeryId();
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<UserRole>("mostrador");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!panaderiaId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("miembros")
      .select("*, profiles(id, nombre, activo)")
      .eq("panaderia_id", panaderiaId)
      .order("rol");
    setMiembros((data as Miembro[]) ?? []);
  }

  useEffect(() => {
    load();
  }, [panaderiaId]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setError("");
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, nombre, password, rol, panaderia_id: panaderiaId }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Error");
      return;
    }
    setMsg("Usuario creado y asignado a esta panadería");
    setEmail("");
    setNombre("");
    setPassword("");
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="text-sm text-stone-500">Equipo de esta panadería · roles y permisos</p>
      </div>

      <Card className="max-w-xl space-y-3">
        <CardTitle>Invitar / crear usuario</CardTitle>
        <form onSubmit={invite} className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
          <Input
            type="email"
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Contraseña temporal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
          <select
            className="rounded-lg border px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900"
            value={rol}
            onChange={(e) => setRol(e.target.value as UserRole)}
          >
            {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <Button type="submit" className="sm:col-span-2">
            Crear y asignar
          </Button>
        </form>
        {msg && <p className="text-sm text-emerald-600">{msg}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </Card>

      <Card>
        <CardTitle>Equipo ({miembros.length})</CardTitle>
        <ul className="mt-4 divide-y dark:divide-stone-800">
          {miembros.map((m) => {
            const p = m.profiles as Profile | undefined;
            return (
              <li key={m.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{p?.nombre ?? m.user_id.slice(0, 8)}</p>
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
      </Card>
    </div>
  );
}
