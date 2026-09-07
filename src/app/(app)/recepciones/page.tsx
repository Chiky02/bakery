"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Producto, Proveedor, Recepcion, RecepcionItem } from "@/types";
import { formatCOP } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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

export default function RecepcionesPage() {
  const [recepciones, setRecepciones] = useState<Recepcion[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [panaderiaId, setPanaderiaId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<"lista" | "nueva" | "proveedores">("lista");
  const [proveedorId, setProveedorId] = useState("");
  const [notas, setNotas] = useState("");
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [nuevoProveedor, setNuevoProveedor] = useState("");
  const [telefono, setTelefono] = useState("");
  const [nit, setNit] = useState("");
  const [contacto, setContacto] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [emailProv, setEmailProv] = useState("");
  const [diasEntrega, setDiasEntrega] = useState("");
  const [condiciones, setCondiciones] = useState("");
  const [selected, setSelected] = useState<Recepcion | null>(null);
  const [msg, setMsg] = useState("");

  async function bootstrap() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data: profile } = await supabase
      .from("profiles")
      .select("panaderia_activa_id")
      .eq("id", user.id)
      .single();
    const pid = profile?.panaderia_activa_id as string | null;
    if (!pid) return;
    setPanaderiaId(pid);
    await loadAll(pid);
  }

  async function loadAll(pid: string) {
    const supabase = createClient();
    const [{ data: recs }, { data: provs }, { data: prods }] = await Promise.all([
      supabase
        .from("recepciones")
        .select("*, proveedores(*), recepcion_items(*)")
        .eq("panaderia_id", pid)
        .order("created_at", { ascending: false }),
      supabase.from("proveedores").select("*").eq("panaderia_id", pid).eq("activo", true).order("nombre"),
      supabase.from("productos").select("*").eq("panaderia_id", pid).order("nombre"),
    ]);
    setRecepciones((recs as Recepcion[]) ?? []);
    setProveedores((provs as Proveedor[]) ?? []);
    setProductos((prods as Producto[]) ?? []);
  }

  useEffect(() => {
    bootstrap();
  }, []);

  const totalEstimado = useMemo(
    () => items.reduce((s, i) => s + i.cantidad_pedida * i.costo_unitario, 0),
    [items],
  );

  async function crearProveedor(e: React.FormEvent) {
    e.preventDefault();
    if (!panaderiaId || !nuevoProveedor.trim()) return;
    const supabase = createClient();
    const { error } = await supabase.from("proveedores").insert({
      panaderia_id: panaderiaId,
      nombre: nuevoProveedor.trim(),
      telefono: telefono || null,
      email: emailProv || null,
      nit: nit || null,
      contacto_nombre: contacto || null,
      direccion: direccion || null,
      ciudad: ciudad || null,
      dias_entrega: diasEntrega || null,
      condiciones_pago: condiciones || null,
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    setNuevoProveedor("");
    setTelefono("");
    setNit("");
    setContacto("");
    setDireccion("");
    setCiudad("");
    setEmailProv("");
    setDiasEntrega("");
    setCondiciones("");
    setMsg("Proveedor creado");
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
    const supabase = createClient();
    const lines = (rec.recepcion_items as RecepcionItem[]) ?? [];
    for (const line of lines) {
      await supabase
        .from("recepcion_items")
        .update({ cantidad_recibida: line.cantidad_pedida })
        .eq("id", line.id);
    }
    await supabase
      .from("recepciones")
      .update({
        estado: "recibida",
        fecha_recepcion: new Date().toISOString().slice(0, 10),
        recibido_por: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rec.id);
    setSelected(null);
    setMsg("Recepción marcada como recibida");
    await loadAll(panaderiaId);
  }

  function estadoBadge(estado: string) {
    if (estado === "recibida") return "success" as const;
    if (estado === "cancelada") return "danger" as const;
    return "warning" as const;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Recepciones</h1>
          <p className="text-sm text-stone-500">
            Pedidos a proveedores y mercancía que entra a la panadería
          </p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

      {msg && <p className="text-sm text-orange-700 dark:text-orange-300">{msg}</p>}

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
                <div className="flex items-center gap-2">
                  <Badge color={estadoBadge(r.estado)}>{r.estado}</Badge>
                  <Button size="sm" variant="secondary" onClick={() => setSelected(r)}>
                    Ver
                  </Button>
                  {r.estado !== "recibida" && r.estado !== "cancelada" && (
                    <Button size="sm" onClick={() => marcarRecibida(r)}>
                      Marcar recibida
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {tab === "nueva" && (
        <Card className="max-w-3xl space-y-4">
          <CardTitle>Nueva orden / recepción</CardTitle>
          <form onSubmit={crearRecepcion} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Proveedor</label>
              <select
                className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
                value={proveedorId}
                onChange={(e) => setProveedorId(e.target.value)}
              >
                <option value="">— Sin proveedor —</option>
                {proveedores.map((p) => (
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
                <div key={idx} className="grid gap-2 rounded-lg border border-stone-200 p-3 dark:border-stone-800 md:grid-cols-5">
                  <Input
                    className="md:col-span-2"
                    placeholder="Descripción"
                    value={item.descripcion}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...item, descripcion: e.target.value };
                      setItems(next);
                    }}
                  />
                  <select
                    className="rounded-lg border border-stone-200 bg-white px-2 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
                    value={item.producto_id}
                    onChange={(e) => {
                      const prod = productos.find((p) => p.id === e.target.value);
                      const next = [...items];
                      next[idx] = {
                        ...item,
                        producto_id: e.target.value,
                        descripcion: prod?.nombre ?? item.descripcion,
                      };
                      setItems(next);
                    }}
                  >
                    <option value="">Producto (opc.)</option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Cant."
                    value={item.cantidad_pedida}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...item, cantidad_pedida: Number(e.target.value) };
                      setItems(next);
                    }}
                  />
                  <Input
                    type="number"
                    min={0}
                    placeholder="Costo und."
                    value={item.costo_unitario}
                    onChange={(e) => {
                      const next = [...items];
                      next[idx] = { ...item, costo_unitario: Number(e.target.value) };
                      setItems(next);
                    }}
                  />
                </div>
              ))}
              <Button type="button" variant="secondary" onClick={() => setItems([...items, emptyItem()])}>
                + Ítem
              </Button>
            </div>
            <p className="text-sm font-medium">Total estimado: {formatCOP(totalEstimado)}</p>
            <Button type="submit">Guardar orden</Button>
          </form>
        </Card>
      )}

      {tab === "proveedores" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3">
            <CardTitle>Nuevo proveedor</CardTitle>
            <form onSubmit={crearProveedor} className="space-y-3">
              <Input
                placeholder="Nombre / razón social"
                value={nuevoProveedor}
                onChange={(e) => setNuevoProveedor(e.target.value)}
                required
              />
              <Input placeholder="NIT" value={nit} onChange={(e) => setNit(e.target.value)} />
              <Input
                placeholder="Contacto"
                value={contacto}
                onChange={(e) => setContacto(e.target.value)}
              />
              <Input
                placeholder="Teléfono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
              />
              <Input
                placeholder="Email"
                value={emailProv}
                onChange={(e) => setEmailProv(e.target.value)}
              />
              <Input
                placeholder="Dirección"
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
              />
              <Input
                placeholder="Ciudad"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
              />
              <Input
                placeholder="Días de entrega"
                value={diasEntrega}
                onChange={(e) => setDiasEntrega(e.target.value)}
              />
              <Input
                placeholder="Condiciones de pago"
                value={condiciones}
                onChange={(e) => setCondiciones(e.target.value)}
              />
              <Button type="submit">Guardar</Button>
            </form>
          </Card>
          <Card>
            <CardTitle>Listado</CardTitle>
            <ul className="mt-3 divide-y dark:divide-stone-800">
              {proveedores.map((p) => (
                <li key={p.id} className="py-2 text-sm">
                  <p className="font-medium">{p.nombre}</p>
                  <p className="text-stone-500">
                    {[p.nit && `NIT ${p.nit}`, p.contacto_nombre, p.telefono, p.ciudad]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos extra"}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
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
          <ul className="divide-y dark:divide-stone-800">
            {(selected.recepcion_items ?? []).map((i) => (
              <li key={i.id} className="flex justify-between py-2 text-sm">
                <span>{i.descripcion}</span>
                <span>
                  {i.cantidad_recibida}/{i.cantidad_pedida} {i.unidad} · {formatCOP(i.costo_unitario)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
