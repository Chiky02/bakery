"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ROLE_LABELS } from "@/lib/permissions";
import { useBakery } from "@/lib/use-bakery-id";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { UserRole } from "@/types";

type GlobalMembership = {
  miembro_id: string;
  panaderia_id: string;
  panaderia_nombre: string;
  panaderia_slug: string;
  rol: UserRole;
  role_nombre: string | null;
  activo: boolean;
};

type GlobalAuthUser = {
  id: string;
  email: string;
  nombre: string;
  activo: boolean;
  created_at: string | null;
  last_sign_in_at: string | null;
  memberships: GlobalMembership[];
};

type NegocioFilter = "" | "con" | "sin";
type ActivoFilter = "" | "si" | "no";

const selectClass = "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";

export function CuentasAuthPanel() {
  const { profile } = useBakery();
  const [users, setUsers] = useState<GlobalAuthUser[]>([]);
  const [totals, setTotals] = useState({ cuentas: 0, sin_negocio: 0, inactivos: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [negocioFiltro, setNegocioFiltro] = useState<NegocioFilter>("");
  const [activoFiltro, setActivoFiltro] = useState<ActivoFilter>("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/usuarios/global");
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "No se pudieron cargar las cuentas");
      return;
    }
    setUsers((body.users as GlobalAuthUser[]) ?? []);
    setTotals(
      body.totals ?? {
        cuentas: 0,
        sin_negocio: 0,
        inactivos: 0,
      },
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (negocioFiltro === "sin" && u.memberships.length > 0) return false;
      if (negocioFiltro === "con" && u.memberships.length === 0) return false;
      if (activoFiltro === "si" && !u.activo) return false;
      if (activoFiltro === "no" && u.activo) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        u.nombre.toLowerCase().includes(q) ||
        u.memberships.some((m) => m.panaderia_nombre.toLowerCase().includes(q))
      );
    });
  }, [users, search, negocioFiltro, activoFiltro]);

  async function setActivo(userId: string, activo: boolean) {
    setBusyId(userId);
    setMsg("");
    setError("");
    const res = await fetch(`/api/usuarios/global/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo }),
    });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(body.error ?? "No se pudo actualizar");
      return;
    }
    setMsg(activo ? "Cuenta activada" : "Cuenta desactivada (ya no puede entrar)");
    await load();
  }

  async function borrarCuenta(user: GlobalAuthUser) {
    const ok = confirm(
      `¿Borrar definitivamente a ${user.email}?\nSe elimina de Auth y de todos los negocios. No se puede deshacer.`,
    );
    if (!ok) return;
    setBusyId(user.id);
    setMsg("");
    setError("");
    const res = await fetch(`/api/usuarios/global/${user.id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setError(body.error ?? "No se pudo borrar");
      return;
    }
    setMsg("Cuenta borrada");
    await load();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">
        Todas las cuentas de Auth: a qué negocio pertenecen, si quedaron sin asignar, y opción de
        desactivar o borrar.
      </p>

      <div className="flex flex-wrap gap-3 text-sm text-stone-500">
        <span>{totals.cuentas} cuentas</span>
        <span>·</span>
        <span>{totals.sin_negocio} sin negocio</span>
        <span>·</span>
        <span>{totals.inactivos} inactivas</span>
      </div>

      <Card className="space-y-3">
        <CardTitle>Filtros</CardTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            className="sm:col-span-2"
            placeholder="Buscar correo, nombre o negocio…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className={selectClass}
            value={negocioFiltro}
            onChange={(e) => setNegocioFiltro(e.target.value as NegocioFilter)}
            aria-label="Filtrar por negocio"
          >
            <option value="">Negocio: todos</option>
            <option value="con">Con negocio asignado</option>
            <option value="sin">Sin negocio (huérfanos)</option>
          </select>
          <select
            className={selectClass}
            value={activoFiltro}
            onChange={(e) => setActivoFiltro(e.target.value as ActivoFilter)}
            aria-label="Filtrar por estado"
          >
            <option value="">Estado: todos</option>
            <option value="si">Solo activas</option>
            <option value="no">Solo inactivas</option>
          </select>
        </div>
      </Card>

      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardTitle>
          Cuentas ({filtered.length}
          {filtered.length !== users.length ? ` de ${users.length}` : ""})
        </CardTitle>
        {loading ? (
          <p className="mt-4 text-sm text-stone-500">Cargando…</p>
        ) : (
          <ul className="mt-4 divide-y">
            {filtered.map((u) => {
              const isSelf = u.id === profile.id;
              return (
                <li
                  key={u.id}
                  className="flex flex-col gap-3 py-3 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{u.nombre}</p>
                      {isSelf && <Badge color="info">Tú</Badge>}
                      <Badge color={u.activo ? "success" : "danger"}>
                        {u.activo ? "Activa" : "Inactiva"}
                      </Badge>
                      {u.memberships.length === 0 && (
                        <Badge color="warning">Sin negocio</Badge>
                      )}
                    </div>
                    <p className="text-sm text-stone-600">{u.email || "Sin correo"}</p>
                    {u.memberships.length === 0 ? (
                      <p className="mt-1 text-xs text-amber-700">
                        Existe en Auth pero no está asignada a ninguna panadería
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {u.memberships.map((m) => (
                          <li key={m.miembro_id} className="text-xs text-stone-500">
                            <span className="font-medium text-stone-700">
                              {m.panaderia_nombre}
                            </span>
                            {" · "}
                            {m.role_nombre ?? ROLE_LABELS[m.rol as UserRole] ?? m.rol}
                            {!m.activo ? " · membresía inactiva" : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isSelf || busyId === u.id}
                      onClick={() => setActivo(u.id, !u.activo)}
                    >
                      {u.activo ? "Desactivar" : "Activar"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      disabled={isSelf || busyId === u.id}
                      onClick={() => borrarCuenta(u)}
                    >
                      Borrar
                    </Button>
                  </div>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="py-4 text-sm text-stone-500">Ninguna cuenta coincide.</li>
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}
