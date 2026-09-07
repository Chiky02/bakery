"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Miembro, Profile, RolCustom, UserRole } from "@/types";
import {
  FEATURE_PERMISOS,
  ROLE_LABELS,
  defaultPermisosForRole,
  slugify,
} from "@/lib/permissions";
import { useBakeryId } from "@/lib/use-bakery-id";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Tab = "equipo" | "roles";

type RoleForm = {
  id?: string;
  nombre: string;
  descripcion: string;
  rol_base: UserRole;
  permisos: string[];
  activo: boolean;
};

const emptyForm = (): RoleForm => ({
  nombre: "",
  descripcion: "",
  rol_base: "mostrador",
  permisos: defaultPermisosForRole("mostrador"),
  activo: true,
});

export default function UsuariosPage() {
  const { panaderiaId } = useBakeryId();
  const [tab, setTab] = useState<Tab>("equipo");
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [roles, setRoles] = useState<RolCustom[]>([]);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [roleForm, setRoleForm] = useState<RoleForm>(emptyForm());
  const [editing, setEditing] = useState(false);
  const [roleMsg, setRoleMsg] = useState("");
  const [roleErr, setRoleErr] = useState("");
  const [savingRole, setSavingRole] = useState(false);

  const loadRoles = useCallback(async () => {
    const res = await fetch("/api/roles");
    const body = await res.json();
    if (!res.ok) return;
    const list = (body.roles as RolCustom[]) ?? [];
    setRoles(list);
    setRoleId((current) => {
      if (current && list.some((r) => r.id === current)) return current;
      const def = list.find((r) => r.codigo === "mostrador" && r.activo) ?? list.find((r) => r.activo);
      return def?.id ?? "";
    });
  }, []);

  const loadMiembros = useCallback(async () => {
    if (!panaderiaId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("miembros")
      .select("*, profiles(id, nombre, activo), roles(id, nombre, codigo, activo)")
      .eq("panaderia_id", panaderiaId)
      .order("rol");
    setMiembros((data as Miembro[]) ?? []);
  }, [panaderiaId]);

  useEffect(() => {
    loadRoles();
    loadMiembros();
  }, [loadRoles, loadMiembros]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setError("");
    const selected = roles.find((r) => r.id === roleId);
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        nombre,
        password,
        rol: selected?.rol_base ?? "mostrador",
        role_id: roleId || undefined,
        panaderia_id: panaderiaId,
      }),
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
    loadMiembros();
  }

  async function updateMember(id: string, patch: { role_id?: string; activo?: boolean }) {
    const res = await fetch(`/api/usuarios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo actualizar");
      return;
    }
    setError("");
    loadMiembros();
  }

  function startCreateRole() {
    setEditing(true);
    setRoleForm(emptyForm());
    setRoleMsg("");
    setRoleErr("");
  }

  function startEditRole(r: RolCustom) {
    setEditing(true);
    setRoleForm({
      id: r.id,
      nombre: r.nombre,
      descripcion: r.descripcion ?? "",
      rol_base: r.rol_base,
      permisos: r.role_permisos?.map((p) => p.permiso) ?? defaultPermisosForRole(r.rol_base),
      activo: r.activo,
    });
    setRoleMsg("");
    setRoleErr("");
  }

  function togglePermiso(key: string) {
    setRoleForm((prev) => ({
      ...prev,
      permisos: prev.permisos.includes(key)
        ? prev.permisos.filter((p) => p !== key)
        : [...prev.permisos, key],
    }));
  }

  async function saveRole(e: React.FormEvent) {
    e.preventDefault();
    setSavingRole(true);
    setRoleMsg("");
    setRoleErr("");

    const payload = {
      nombre: roleForm.nombre,
      descripcion: roleForm.descripcion || null,
      rol_base: roleForm.rol_base,
      permisos: roleForm.permisos,
      activo: roleForm.activo,
      codigo: slugify(roleForm.nombre),
    };

    const res = await fetch(roleForm.id ? `/api/roles/${roleForm.id}` : "/api/roles", {
      method: roleForm.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    setSavingRole(false);
    if (!res.ok) {
      setRoleErr(body.error ?? "No se pudo guardar");
      return;
    }
    setRoleMsg(roleForm.id ? "Rol actualizado" : "Rol creado");
    setEditing(false);
    setRoleForm(emptyForm());
    loadRoles();
  }

  async function deleteRole(id: string) {
    if (!confirm("¿Eliminar este rol?")) return;
    const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setRoleErr(body.error ?? "No se pudo eliminar");
      return;
    }
    setRoleMsg("Rol eliminado");
    loadRoles();
  }

  const activeRoles = roles.filter((r) => r.activo);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="text-sm text-stone-500">
          Equipo del local y roles con funcionalidades del panel
        </p>
      </div>

      <div className="flex gap-2 border-b border-stone-200 pb-px">
        {(
          [
            { id: "equipo" as const, label: "Equipo" },
            { id: "roles" as const, label: "Roles" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? "border-b-2 border-orange-600 px-3 py-2 text-sm font-semibold text-orange-900"
                : "px-3 py-2 text-sm font-medium text-stone-500 hover:text-stone-800"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "equipo" && (
        <>
          <Card className="w-full space-y-3">
            <CardTitle>Invitar / crear usuario</CardTitle>
            <form onSubmit={invite} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                className="rounded-lg border px-3 py-2 text-sm"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                required
              >
                {activeRoles.length === 0 && <option value="">Cargando roles…</option>}
                {activeRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
              <Button type="submit" className="sm:col-span-2 lg:col-span-4">
                Crear y asignar
              </Button>
            </form>
            {msg && <p className="text-sm text-emerald-600">{msg}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </Card>

          <Card>
            <CardTitle>Equipo ({miembros.length})</CardTitle>
            <ul className="mt-4 divide-y">
              {miembros.map((m) => {
                const p = m.profiles as Profile | undefined;
                const role = m.roles as RolCustom | undefined;
                return (
                  <li
                    key={m.id}
                    className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">{p?.nombre ?? m.user_id.slice(0, 8)}</p>
                      <p className="text-xs text-stone-500">
                        Base RLS: {ROLE_LABELS[m.rol as UserRole]}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm"
                        value={m.role_id ?? ""}
                        onChange={(e) => updateMember(m.id, { role_id: e.target.value })}
                      >
                        {!m.role_id && <option value="">Sin rol custom</option>}
                        {roles.map((r) => (
                          <option key={r.id} value={r.id} disabled={!r.activo && r.id !== m.role_id}>
                            {r.nombre}
                            {!r.activo ? " (inactivo)" : ""}
                          </option>
                        ))}
                      </select>
                      <Badge>{role?.nombre ?? ROLE_LABELS[m.rol as UserRole]}</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => updateMember(m.id, { activo: !m.activo })}
                      >
                        {m.activo ? "Desactivar" : "Activar"}
                      </Button>
                      <Badge color={m.activo ? "success" : "danger"}>
                        {m.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}

      {tab === "roles" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-600">
              Crea roles y marca qué módulos del menú puede ver cada uno. El “nivel base” define
              permisos de escritura en la base de datos.
            </p>
            <Button type="button" onClick={startCreateRole}>
              Nuevo rol
            </Button>
          </div>

          {editing && (
            <Card className="space-y-4">
              <CardTitle>{roleForm.id ? "Editar rol" : "Nuevo rol"}</CardTitle>
              <form onSubmit={saveRole} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Nombre</label>
                    <Input
                      className="mt-1"
                      value={roleForm.nombre}
                      onChange={(e) => setRoleForm({ ...roleForm, nombre: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Nivel base (seguridad)</label>
                    <select
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      value={roleForm.rol_base}
                      disabled={!!roles.find((r) => r.id === roleForm.id)?.es_sistema}
                      onChange={(e) => {
                        const base = e.target.value as UserRole;
                        setRoleForm({
                          ...roleForm,
                          rol_base: base,
                          permisos: defaultPermisosForRole(base),
                        });
                      }}
                    >
                      {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-sm font-medium">Descripción</label>
                    <Input
                      className="mt-1"
                      value={roleForm.descripcion}
                      onChange={(e) => setRoleForm({ ...roleForm, descripcion: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium">Funcionalidades del menú</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {FEATURE_PERMISOS.map((f) => (
                      <label
                        key={f.key}
                        className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={roleForm.permisos.includes(f.key)}
                          onChange={() => togglePermiso(f.key)}
                        />
                        {f.label}
                      </label>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={roleForm.activo}
                    onChange={(e) => setRoleForm({ ...roleForm, activo: e.target.checked })}
                  />
                  Rol activo (asignable a usuarios)
                </label>

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={savingRole || roleForm.permisos.length === 0}>
                    {savingRole ? "Guardando…" : "Guardar rol"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditing(false);
                      setRoleForm(emptyForm());
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
              {roleErr && <p className="text-sm text-red-600">{roleErr}</p>}
            </Card>
          )}

          {roleMsg && <p className="text-sm text-emerald-600">{roleMsg}</p>}
          {roleErr && !editing && <p className="text-sm text-red-600">{roleErr}</p>}

          <Card>
            <CardTitle>Roles ({roles.length})</CardTitle>
            <ul className="mt-4 divide-y">
              {roles.map((r) => {
                const perms = r.role_permisos?.map((p) => p.permiso) ?? [];
                return (
                  <li
                    key={r.id}
                    className="flex flex-col gap-3 py-3 lg:flex-row lg:items-start lg:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{r.nombre}</p>
                        {r.es_sistema && <Badge>Sistema</Badge>}
                        <Badge color={r.activo ? "success" : "danger"}>
                          {r.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                      {r.descripcion && (
                        <p className="mt-1 text-sm text-stone-500">{r.descripcion}</p>
                      )}
                      <p className="mt-1 text-xs text-stone-500">
                        Base: {ROLE_LABELS[r.rol_base]} · {perms.length} módulos
                      </p>
                      <p className="mt-1 text-xs text-stone-400">
                        {FEATURE_PERMISOS.filter((f) => perms.includes(f.key))
                          .map((f) => f.label)
                          .join(" · ") || "Sin módulos"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="ghost" onClick={() => startEditRole(r)}>
                        Editar
                      </Button>
                      {!r.es_sistema && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteRole(r.id)}
                        >
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
