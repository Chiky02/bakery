"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBakeryId } from "@/lib/use-bakery-id";
import type { Cliente } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const empty = (): Omit<Cliente, "id" | "panaderia_id"> => ({
  nombre: "",
  documento: "",
  telefono: "",
  email: "",
  direccion: "",
  notas: "",
  activo: true,
});

export function ClientesClient({ initial }: { initial: Cliente[] }) {
  const { panaderiaId } = useBakeryId();
  const [list, setList] = useState(initial);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(empty());
  const [editId, setEditId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return list.filter((c) => c.activo !== false);
    return list.filter((c) => {
      if (c.activo === false) return false;
      return (
        c.nombre.toLowerCase().includes(term) ||
        (c.documento ?? "").toLowerCase().includes(term) ||
        (c.telefono ?? "").includes(term)
      );
    });
  }, [list, q]);

  async function reload() {
    if (!panaderiaId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .eq("panaderia_id", panaderiaId)
      .order("nombre");
    setList((data as Cliente[]) ?? []);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!panaderiaId || !form.nombre.trim()) return;
    const supabase = createClient();
    const payload = {
      panaderia_id: panaderiaId,
      nombre: form.nombre.trim(),
      documento: form.documento?.trim() || null,
      telefono: form.telefono?.trim() || null,
      email: form.email?.trim() || null,
      direccion: form.direccion?.trim() || null,
      notas: form.notas?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (editId) {
      const { error } = await supabase.from("clientes").update(payload).eq("id", editId);
      if (error) {
        setMsg(error.message);
        return;
      }
      setMsg("Cliente actualizado");
    } else {
      const { error } = await supabase.from("clientes").insert(payload);
      if (error) {
        setMsg(
          /clientes/i.test(error.message)
            ? "Aplica la migración (npm run db:push) para clientes"
            : error.message,
        );
        return;
      }
      setMsg("Cliente creado");
    }
    setForm(empty());
    setEditId(null);
    await reload();
  }

  function editar(c: Cliente) {
    setEditId(c.id);
    setForm({
      nombre: c.nombre,
      documento: c.documento ?? "",
      telefono: c.telefono ?? "",
      email: c.email ?? "",
      direccion: c.direccion ?? "",
      notas: c.notas ?? "",
      activo: c.activo !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function desactivar(id: string) {
    if (!confirm("¿Desactivar este cliente?")) return;
    const supabase = createClient();
    await supabase.from("clientes").update({ activo: false }).eq("id", id);
    await reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-sm text-stone-500">
          Directorio para facturas y encargos (NIT / teléfono / dirección)
        </p>
      </div>
      {msg && <p className="text-sm text-orange-700">{msg}</p>}

      <Card className="space-y-3">
        <CardTitle>{editId ? "Editar cliente" : "Nuevo cliente"}</CardTitle>
        <form onSubmit={guardar} className="grid gap-2 sm:grid-cols-2">
          <Input
            required
            placeholder="Nombre / razón social *"
            value={form.nombre ?? ""}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
          <Input
            placeholder="NIT / CC"
            value={form.documento ?? ""}
            onChange={(e) => setForm({ ...form, documento: e.target.value })}
          />
          <Input
            placeholder="Teléfono"
            value={form.telefono ?? ""}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
          />
          <Input
            placeholder="Email"
            value={form.email ?? ""}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            className="sm:col-span-2"
            placeholder="Dirección"
            value={form.direccion ?? ""}
            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
          />
          <Input
            className="sm:col-span-2"
            placeholder="Notas"
            value={form.notas ?? ""}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
          />
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit">{editId ? "Actualizar" : "Crear"}</Button>
            {editId && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditId(null);
                  setForm(empty());
                }}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Input
        placeholder="Buscar por nombre, documento o teléfono…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <Card>
        <CardTitle>Directorio ({filtered.length})</CardTitle>
        <ul className="mt-3 divide-y text-sm">
          {filtered.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div>
                <p className="font-medium">{c.nombre}</p>
                <p className="text-xs text-stone-500">
                  {[c.documento, c.telefono, c.email].filter(Boolean).join(" · ") ||
                    "Sin datos de contacto"}
                </p>
              </div>
              <div className="flex gap-1">
                <Badge color="info">Activo</Badge>
                <Button size="sm" variant="secondary" onClick={() => editar(c)}>
                  Editar
                </Button>
                <Button size="sm" variant="danger" onClick={() => void desactivar(c.id)}>
                  Off
                </Button>
              </div>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="py-4 text-stone-500">Sin clientes</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
