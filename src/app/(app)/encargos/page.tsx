"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Encargo, Producto } from "@/types";
import { formatCOP, formatDate } from "@/lib/format";
import { useBakeryId } from "@/lib/use-bakery-id";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ClientePicker } from "@/components/app/cliente-picker";
import { CheckCircle2, PackageCheck, Wallet } from "lucide-react";

const ESTADO_COLOR: Record<string, "warning" | "success" | "info" | "danger"> = {
  pendiente: "warning",
  entregado: "info",
  cobrado: "success",
  cancelado: "danger",
};

const PAGO_COLOR: Record<string, "warning" | "success" | "info"> = {
  pendiente: "warning",
  abonado: "info",
  pagado: "success",
};

type FormState = {
  producto_id: string;
  descripcion: string;
  cliente_id: string | null;
  cliente_nombre: string;
  cliente_telefono: string;
  fecha_entrega: string;
  valor: string;
  estado_pago: "pendiente" | "abonado" | "pagado";
  abono: string;
  notas: string;
};

const emptyForm = (): FormState => ({
  producto_id: "",
  descripcion: "",
  cliente_id: null,
  cliente_nombre: "",
  cliente_telefono: "",
  fecha_entrega: "",
  valor: "",
  estado_pago: "pendiente",
  abono: "0",
  notas: "",
});

export default function EncargosPage() {
  const { panaderiaId } = useBakeryId();
  const [encargos, setEncargos] = useState<Encargo[]>([]);
  const [encargables, setEncargables] = useState<Producto[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [msg, setMsg] = useState("");

  async function load() {
    if (!panaderiaId) return;
    const supabase = createClient();
    const [{ data }, { data: prods }] = await Promise.all([
      supabase
        .from("encargos")
        .select("*, productos(id, nombre, precio)")
        .eq("panaderia_id", panaderiaId)
        .order("fecha_entrega"),
      supabase
        .from("productos")
        .select("*, categorias(*)")
        .eq("panaderia_id", panaderiaId)
        .eq("disponible", true)
        .order("nombre"),
    ]);
    setEncargos((data as Encargo[]) ?? []);
    const list = (prods as Producto[]) ?? [];
    const only = list.filter((p) => p.encargable === true);
    // Si aún no hay columna / ninguno marcado, mostrar candidatos de tortas
    setEncargables(
      only.length > 0
        ? only
        : list.filter(
            (p) =>
              (p.categorias?.nombre ?? "").toLowerCase().includes("torta") ||
              p.nombre.toLowerCase().includes("torta") ||
              p.nombre.toLowerCase().includes("ponqué"),
          ),
    );
  }

  useEffect(() => {
    load();
  }, [panaderiaId]);

  function onPickProducto(id: string) {
    const p = encargables.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      producto_id: id,
      valor: p ? String(p.precio) : f.valor,
      descripcion: p ? `Encargo: ${p.nombre}` : f.descripcion,
    }));
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/encargos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        producto_id: form.producto_id || null,
        descripcion: form.descripcion,
        cliente_id: form.cliente_id,
        cliente_nombre: form.cliente_nombre || null,
        cliente_telefono: form.cliente_telefono || null,
        fecha_entrega: form.fecha_entrega,
        valor: parseInt(form.valor, 10) || 0,
        estado_pago: form.estado_pago,
        abono: parseInt(form.abono, 10) || 0,
        notas: form.notas || null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMsg(body.error ?? "No se pudo guardar");
      return;
    }
    setForm(emptyForm());
    setShowForm(false);
    load();
  }

  async function patchEncargo(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/encargos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
  }

  const proximos = encargos.filter((e) => e.estado === "pendiente");
  const otros = encargos.filter((e) => e.estado !== "pendiente");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Encargos y pedidos especiales</h1>
          <p className="text-sm text-stone-500">
            Elige productos marcados como encargables. Marca pago: pendiente, abonado o pagado.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancelar" : "Nuevo encargo"}
        </Button>
      </div>

      {msg && <p className="text-sm text-red-600">{msg}</p>}

      {showForm && (
        <Card>
          <CardTitle>Nuevo encargo</CardTitle>
          <form onSubmit={crear} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Producto encargable</label>
              <select
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm  "
                value={form.producto_id}
                onChange={(e) => onPickProducto(e.target.value)}
              >
                <option value="">— Personalizado / otra —</option>
                {encargables.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} · {formatCOP(p.precio)}
                  </option>
                ))}
              </select>
              {encargables.length === 0 && (
                <p className="mt-1 text-xs text-stone-500">
                  Marca productos como encargables en Productos (check “Encargable”).
                </p>
              )}
            </div>
            <Input
              placeholder="Descripción"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              required
              className="sm:col-span-2"
            />
            <div className="sm:col-span-2">
              <ClientePicker
                selectedId={form.cliente_id}
                onSelect={(c) =>
                  setForm({
                    ...form,
                    cliente_id: c?.id ?? null,
                    cliente_nombre: c?.nombre ?? form.cliente_nombre,
                    cliente_telefono: c?.telefono ?? form.cliente_telefono,
                  })
                }
              />
            </div>
            <Input
              placeholder="Cliente"
              value={form.cliente_nombre}
              onChange={(e) =>
                setForm({ ...form, cliente_id: null, cliente_nombre: e.target.value })
              }
            />
            <Input
              placeholder="Teléfono"
              value={form.cliente_telefono}
              onChange={(e) => setForm({ ...form, cliente_telefono: e.target.value })}
            />
            <Input
              type="date"
              value={form.fecha_entrega}
              onChange={(e) => setForm({ ...form, fecha_entrega: e.target.value })}
              required
            />
            <Input
              type="number"
              placeholder="Valor"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
              required
            />
            <div>
              <label className="mb-1 block text-sm font-medium">Estado de pago</label>
              <select
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm  "
                value={form.estado_pago}
                onChange={(e) =>
                  setForm({ ...form, estado_pago: e.target.value as FormState["estado_pago"] })
                }
              >
                <option value="pendiente">Pendiente de pago</option>
                <option value="abonado">Abonado</option>
                <option value="pagado">Pagado</option>
              </select>
            </div>
            <Input
              type="number"
              min={0}
              placeholder="Abono (COP)"
              value={form.abono}
              onChange={(e) => setForm({ ...form, abono: e.target.value })}
              disabled={form.estado_pago === "pendiente"}
            />
            <Input
              placeholder="Notas"
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              className="sm:col-span-2"
            />
            <Button type="submit" className="sm:col-span-2">
              Guardar encargo
            </Button>
          </form>
        </Card>
      )}

      <Card>
        <CardTitle>Próximas entregas</CardTitle>
        {proximos.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">Sin encargos pendientes</p>
        ) : (
          <ul className="mt-4 divide-y ">
            {proximos.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-4">
                <div>
                  <p className="font-medium">{e.descripcion}</p>
                  {e.productos?.nombre && (
                    <p className="text-xs text-stone-500">Producto: {e.productos.nombre}</p>
                  )}
                  <p className="text-sm text-stone-500">
                    {e.cliente_nombre} · {formatDate(e.fecha_entrega)}
                  </p>
                  <p className="font-semibold text-amber-700">{formatCOP(e.valor)}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge color={PAGO_COLOR[e.estado_pago ?? "pendiente"]}>
                      pago: {e.estado_pago ?? "pendiente"}
                      {(e.estado_pago === "abonado" || (e.abono ?? 0) > 0) &&
                        ` · ${formatCOP(e.abono ?? 0)}`}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    title="Pendiente de pago"
                    onClick={() => patchEncargo(e.id, { estado_pago: "pendiente", abono: 0 })}
                  >
                    <Wallet className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    title="Abonado"
                    onClick={() =>
                      patchEncargo(e.id, {
                        estado_pago: "abonado",
                        abono: e.abono && e.abono > 0 ? e.abono : Math.round(e.valor / 2),
                      })
                    }
                  >
                    Abono
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    title="Pagado"
                    onClick={() => patchEncargo(e.id, { estado_pago: "pagado", abono: e.valor })}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    title="Entregado"
                    onClick={() => patchEncargo(e.id, { estado: "entregado" })}
                  >
                    <PackageCheck className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={() => patchEncargo(e.id, { estado: "cobrado" })}>
                    Cobrado
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {otros.length > 0 && (
        <Card>
          <CardTitle>Historial</CardTitle>
          <ul className="mt-4 divide-y ">
            {otros.map((e) => (
              <li key={e.id} className="flex justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{e.descripcion}</p>
                  <p className="text-stone-500">{e.cliente_nombre}</p>
                </div>
                <div className="text-right">
                  <Badge color={ESTADO_COLOR[e.estado]}>{e.estado}</Badge>
                  <Badge color={PAGO_COLOR[e.estado_pago ?? "pendiente"]} className="ml-1">
                    {e.estado_pago ?? "pendiente"}
                  </Badge>
                  <p className="mt-1">{formatCOP(e.valor)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
