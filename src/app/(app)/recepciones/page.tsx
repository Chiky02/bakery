"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Producto, Proveedor, Recepcion, RecepcionItem } from "@/types";
import { formatCOP } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Eye, Pencil, Trash2, Plus, Check } from "lucide-react";
import { useBakery } from "@/lib/use-bakery-id";
import { ProductSearchSelect } from "@/components/app/product-search-select";
import { resolveUnidades } from "@/lib/unidades-medida";

type DraftItem = {
  descripcion: string;
  producto_id: string;
  cantidad_pedida: number;
  unidad: string;
  costo_unitario: number;
};

const emptyItem = (): DraftItem => ({
  descripcion: "",
  producto_id: "",
  cantidad_pedida: 1,
  unidad: "unidad",
  costo_unitario: 0,
});

type ProvForm = {
  id?: string;
  nombre: string;
  telefono: string;
  nit: string;
  contacto: string;
  direccion: string;
  ciudad: string;
  email: string;
  diasEntrega: string;
  condiciones: string;
};

const emptyProv = (): ProvForm => ({
  nombre: "",
  telefono: "",
  nit: "",
  contacto: "",
  direccion: "",
  ciudad: "",
  email: "",
  diasEntrega: "",
  condiciones: "",
});

export default function RecepcionesPage() {
  const { profile, panaderia } = useBakery();
  const panaderiaId = panaderia.id;
  const userId = profile.id;
  const unidades = resolveUnidades(panaderia.unidades_medida);
  const [recepciones, setRecepciones] = useState<Recepcion[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [tab, setTab] = useState<"lista" | "nueva" | "proveedores" | "nuevo-proveedor">("lista");
  const [proveedorId, setProveedorId] = useState("");
  const [notas, setNotas] = useState("");
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [provForm, setProvForm] = useState<ProvForm>(emptyProv());
  const [viewProv, setViewProv] = useState<Proveedor | null>(null);
  const [selected, setSelected] = useState<Recepcion | null>(null);
  const [msg, setMsg] = useState("");

  async function loadAll(pid: string) {
    const supabase = createClient();
    const [{ data: recs }, { data: provs }, { data: prods }] = await Promise.all([
      supabase
        .from("recepciones")
        .select("*, proveedores(*), recepcion_items(*)")
        .eq("panaderia_id", pid)
        .order("created_at", { ascending: false }),
      supabase.from("proveedores").select("*").eq("panaderia_id", pid).order("nombre"),
      supabase.from("productos").select("*").eq("panaderia_id", pid).order("nombre"),
    ]);
    setRecepciones((recs as Recepcion[]) ?? []);
    setProveedores((provs as Proveedor[]) ?? []);
    setProductos((prods as Producto[]) ?? []);
  }

  useEffect(() => {
    if (panaderiaId) loadAll(panaderiaId);
  }, [panaderiaId]);

  const totalEstimado = useMemo(
    () => items.reduce((s, i) => s + i.cantidad_pedida * i.costo_unitario, 0),
    [items],
  );

  async function saveProveedor(e: React.FormEvent) {
    e.preventDefault();
    if (!panaderiaId || !provForm.nombre.trim()) return;
    const supabase = createClient();
    const payload = {
      panaderia_id: panaderiaId,
      nombre: provForm.nombre.trim(),
      telefono: provForm.telefono || null,
      email: provForm.email || null,
      nit: provForm.nit || null,
      contacto_nombre: provForm.contacto || null,
      direccion: provForm.direccion || null,
      ciudad: provForm.ciudad || null,
      dias_entrega: provForm.diasEntrega || null,
      condiciones_pago: provForm.condiciones || null,
      activo: true,
    };
    if (provForm.id) {
      const { error } = await supabase.from("proveedores").update(payload).eq("id", provForm.id);
      if (error) {
        setMsg(error.message);
        return;
      }
      setMsg("Proveedor actualizado");
    } else {
      const { error } = await supabase.from("proveedores").insert(payload);
      if (error) {
        setMsg(error.message);
        return;
      }
      setMsg("Proveedor creado");
    }
    setProvForm(emptyProv());
    setTab("proveedores");
    await loadAll(panaderiaId);
  }

  async function deleteProveedor(p: Proveedor) {
    if (!panaderiaId || !confirm(`¿Eliminar o desactivar ${p.nombre}?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("proveedores").delete().eq("id", p.id);
    if (error) {
      // soft-deactivate if FK
      const { error: e2 } = await supabase
        .from("proveedores")
        .update({ activo: false })
        .eq("id", p.id);
      if (e2) {
        setMsg(e2.message);
        return;
      }
      setMsg("Proveedor desactivado (tiene historial)");
    } else {
      setMsg("Proveedor eliminado");
    }
    await loadAll(panaderiaId);
  }

  async function crearRecepcion(e: React.FormEvent) {
    e.preventDefault();
    if (!panaderiaId || !userId) return;
    const valid = items.filter((i) => i.descripcion.trim() && i.cantidad_pedida > 0);
    if (valid.length === 0) {
      setMsg("Agrega al menos un ítem");
      return;
    }
    const supabase = createClient();
    const numero = `RC-${Date.now().toString().slice(-6)}`;
    const { data: rec, error } = await supabase
      .from("recepciones")
      .insert({
        panaderia_id: panaderiaId,
        proveedor_id: proveedorId || null,
        numero,
        estado: "pendiente",
        fecha_pedido: new Date().toISOString().slice(0, 10),
        notas: notas || null,
        total_estimado: totalEstimado,
        creado_por: userId,
      })
      .select()
      .single();
    if (error || !rec) {
      setMsg(error?.message ?? "Error al crear");
      return;
    }
    const { error: itemsErr } = await supabase.from("recepcion_items").insert(
      valid.map((i) => ({
        recepcion_id: rec.id,
        producto_id: i.producto_id || null,
        descripcion: i.descripcion.trim(),
        cantidad_pedida: i.cantidad_pedida,
        cantidad_recibida: 0,
        unidad: i.unidad || "unidad",
        costo_unitario: i.costo_unitario,
      })),
    );
    if (itemsErr) {
      setMsg(itemsErr.message);
      return;
    }
    setItems([emptyItem()]);
    setNotas("");
    setProveedorId("");
    setTab("lista");
    setMsg("Orden de recepción creada");
    await loadAll(panaderiaId);
  }

  async function marcarRecibida(rec: Recepcion) {
    if (!panaderiaId || !userId) return;
    const res = await fetch(`/api/recepciones/${rec.id}/recibir`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(body.error ?? "No se pudo marcar como recibida");
      return;
    }
    setSelected(null);
    setMsg("Recepción marcada como recibida · stock actualizado");
    await loadAll(panaderiaId);
  }

  function estadoBadge(estado: string) {
    if (estado === "recibida") return "success" as const;
    if (estado === "cancelada") return "danger" as const;
    return "warning" as const;
  }

  const proveedoresActivos = proveedores.filter((p) => p.activo !== false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Recepciones</h1>
          <p className="text-sm text-stone-500">
            Pedidos a proveedores y mercancía que entra a la panadería
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={tab === "lista" ? "primary" : "secondary"} onClick={() => setTab("lista")}>
            Lista
          </Button>
          <Button variant={tab === "nueva" ? "primary" : "secondary"} onClick={() => setTab("nueva")}>
            Nueva orden
          </Button>
          <Button
            variant={tab === "proveedores" ? "primary" : "secondary"}
            onClick={() => setTab("proveedores")}
          >
            Proveedores
          </Button>
          <Button
            variant={tab === "nuevo-proveedor" ? "primary" : "secondary"}
            onClick={() => {
              setProvForm(emptyProv());
              setTab("nuevo-proveedor");
            }}
          >
            Nuevo proveedor
          </Button>
        </div>
      </div>

      {msg && <p className="text-sm text-orange-700 ">{msg}</p>}

      {tab === "lista" && (
        <div className="space-y-3">
          {recepciones.length === 0 ? (
            <Card>
              <p className="text-sm text-stone-500">No hay recepciones todavía.</p>
            </Card>
          ) : (
            recepciones.map((r) => (
              <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {r.numero ?? r.id.slice(0, 8)} · {r.proveedores?.nombre ?? "Sin proveedor"}
                  </p>
                  <p className="text-sm text-stone-500">
                    Pedido {r.fecha_pedido ?? "—"} · {formatCOP(r.total_estimado)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Badge color={estadoBadge(r.estado)}>{r.estado}</Badge>
                  <Button
                    size="sm"
                    variant="secondary"
                    title="Ver"
                    aria-label="Ver"
                    onClick={() => setSelected(r)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {r.estado !== "recibida" && r.estado !== "cancelada" && (
                    <Button
                      size="sm"
                      title="Marcar recibida"
                      aria-label="Marcar recibida"
                      onClick={() => marcarRecibida(r)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === "nueva" && (
        <Card className="w-full max-w-5xl space-y-4">
          <CardTitle>Nueva orden / recepción</CardTitle>
          <form onSubmit={crearRecepcion} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Proveedor</label>
              <select
                className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm  "
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
              >
                <option value="">— Sin proveedor —</option>
                {proveedoresActivos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Notas</label>
              <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" />
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium">Ítems</p>
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="grid gap-2 rounded-lg border border-stone-200 p-3 md:grid-cols-6"
                >
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-stone-500">
                      Producto
                    </label>
                    <ProductSearchSelect
                      id={`rec-prod-${idx}`}
                      name={`rec-prod-${idx}`}
                      options={productos.map((p) => ({
                        id: p.id,
                        label: p.nombre,
                        hint: p.codigo_barras ?? undefined,
                      }))}
                      value={item.producto_id}
                      onChange={(id, opt) => {
                        const next = [...items];
                        next[idx] = {
                          ...item,
                          producto_id: id,
                          descripcion: opt?.label || item.descripcion,
                        };
                        setItems(next);
                      }}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-stone-500">
                      Descripción
                    </label>
                    <Input
                      placeholder="Detalle opcional"
                      value={item.descripcion}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...item, descripcion: e.target.value };
                        setItems(next);
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-500">Cantidad</label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Cantidad"
                      value={item.cantidad_pedida}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...item, cantidad_pedida: Number(e.target.value) };
                        setItems(next);
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-stone-500">Unidad</label>
                    <select
                      className="w-full rounded-lg border border-stone-200 bg-white px-2 py-2 text-sm"
                      value={item.unidad}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...item, unidad: e.target.value };
                        setItems(next);
                      }}
                    >
                      {unidades.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                      {!unidades.includes(item.unidad) && item.unidad && (
                        <option value={item.unidad}>{item.unidad}</option>
                      )}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-stone-500">
                      Costo unitario
                    </label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Costo"
                      value={item.costo_unitario}
                      onChange={(e) => {
                        const next = [...items];
                        next[idx] = { ...item, costo_unitario: Number(e.target.value) };
                        setItems(next);
                      }}
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                className="gap-1"
                onClick={() => setItems([...items, emptyItem()])}
              >
                <Plus className="h-4 w-4" /> Ítem
              </Button>
            </div>
            <p className="text-sm font-medium">Total estimado: {formatCOP(totalEstimado)}</p>
            <Button type="submit">Guardar orden</Button>
          </form>
        </Card>
      )}

      {tab === "nuevo-proveedor" && (
        <Card className="w-full space-y-3">
          <CardTitle>{provForm.id ? "Editar proveedor" : "Nuevo proveedor"}</CardTitle>
          <form onSubmit={saveProveedor} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              className="sm:col-span-2 lg:col-span-3"
              placeholder="Nombre / razón social"
              value={provForm.nombre}
              onChange={(e) => setProvForm({ ...provForm, nombre: e.target.value })}
              required
            />
            <Input
              placeholder="NIT"
              value={provForm.nit}
              onChange={(e) => setProvForm({ ...provForm, nit: e.target.value })}
            />
            <Input
              placeholder="Contacto"
              value={provForm.contacto}
              onChange={(e) => setProvForm({ ...provForm, contacto: e.target.value })}
            />
            <Input
              placeholder="Teléfono"
              value={provForm.telefono}
              onChange={(e) => setProvForm({ ...provForm, telefono: e.target.value })}
            />
            <Input
              placeholder="Email"
              value={provForm.email}
              onChange={(e) => setProvForm({ ...provForm, email: e.target.value })}
            />
            <Input
              className="sm:col-span-2"
              placeholder="Dirección"
              value={provForm.direccion}
              onChange={(e) => setProvForm({ ...provForm, direccion: e.target.value })}
            />
            <Input
              placeholder="Ciudad"
              value={provForm.ciudad}
              onChange={(e) => setProvForm({ ...provForm, ciudad: e.target.value })}
            />
            <Input
              placeholder="Días de entrega"
              value={provForm.diasEntrega}
              onChange={(e) => setProvForm({ ...provForm, diasEntrega: e.target.value })}
            />
            <Input
              className="sm:col-span-2 lg:col-span-3"
              placeholder="Condiciones de pago"
              value={provForm.condiciones}
              onChange={(e) => setProvForm({ ...provForm, condiciones: e.target.value })}
            />
            <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit">{provForm.id ? "Actualizar" : "Guardar"}</Button>
              <Button type="button" variant="ghost" onClick={() => setTab("proveedores")}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {tab === "proveedores" && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <CardTitle>Listado de proveedores</CardTitle>
            <Button
              size="sm"
              className="gap-1"
              onClick={() => {
                setProvForm(emptyProv());
                setTab("nuevo-proveedor");
              }}
            >
              <Plus className="h-4 w-4" /> Nuevo
            </Button>
          </div>
          <ul className="divide-y ">
            {proveedoresActivos.length === 0 ? (
              <li className="py-4 text-sm text-stone-500">Sin proveedores.</li>
            ) : (
              proveedoresActivos.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium">{p.nombre}</p>
                    <p className="text-sm text-stone-500">
                      {[p.nit && `NIT ${p.nit}`, p.contacto_nombre, p.telefono, p.ciudad]
                        .filter(Boolean)
                        .join(" · ") || "Sin datos extra"}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      title="Ver"
                      aria-label="Ver"
                      onClick={() => setViewProv(p)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      title="Editar"
                      aria-label="Editar"
                      onClick={() => {
                        setProvForm({
                          id: p.id,
                          nombre: p.nombre,
                          telefono: p.telefono ?? "",
                          nit: p.nit ?? "",
                          contacto: p.contacto_nombre ?? "",
                          direccion: p.direccion ?? "",
                          ciudad: p.ciudad ?? "",
                          email: p.email ?? "",
                          diasEntrega: p.dias_entrega ?? "",
                          condiciones: p.condiciones_pago ?? "",
                        });
                        setTab("nuevo-proveedor");
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      title="Eliminar"
                      aria-label="Eliminar"
                      onClick={() => deleteProveedor(p)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </Card>
      )}

      {viewProv && (
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle>{viewProv.nombre}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setViewProv(null)}>
              Cerrar
            </Button>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-stone-500">NIT</dt>
              <dd>{viewProv.nit || "—"}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Contacto</dt>
              <dd>{viewProv.contacto_nombre || "—"}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Teléfono</dt>
              <dd>{viewProv.telefono || "—"}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Email</dt>
              <dd>{viewProv.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Dirección</dt>
              <dd>{viewProv.direccion || "—"}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Ciudad</dt>
              <dd>{viewProv.ciudad || "—"}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Entrega</dt>
              <dd>{viewProv.dias_entrega || "—"}</dd>
            </div>
            <div>
              <dt className="text-stone-500">Pago</dt>
              <dd>{viewProv.condiciones_pago || "—"}</dd>
            </div>
          </dl>
        </Card>
      )}

      {selected && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle>
              {selected.numero} — {selected.proveedores?.nombre ?? "Sin proveedor"}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Cerrar
            </Button>
          </div>
          <ul className="divide-y ">
            {(selected.recepcion_items ?? []).map((i) => (
              <li key={i.id} className="flex justify-between py-2 text-sm">
                <span>{i.descripcion}</span>
                <span>
                  Cant. {i.cantidad_recibida}/{i.cantidad_pedida} {i.unidad} · Costo{" "}
                  {formatCOP(i.costo_unitario)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
