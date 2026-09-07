"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ProductGrid } from "@/components/app/product-grid";
import { formatCOP } from "@/lib/format";
import { loadVentaProductos } from "@/lib/productos";
import type { ItemCuenta, Mesa, Producto, SubCuenta } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Trash2 } from "lucide-react";

export default function MesaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const closingRef = useRef(false);
  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemCuenta[]>([]);
  const [subCuentas, setSubCuentas] = useState<SubCuenta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [search, setSearch] = useState("");
  const [nuevaSub, setNuevaSub] = useState("");
  const [medioPago, setMedioPago] = useState<"efectivo" | "electronico" | "mixto">("efectivo");
  const [cerrarMsg, setCerrarMsg] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [abriendo, setAbriendo] = useState(false);

  const load = useCallback(async () => {
    if (closingRef.current) return;
    const supabase = createClient();
    const { data: mesaData } = await supabase.from("mesas").select("*").eq("id", id).single();
    setMesa(mesaData as Mesa);
    if (!mesaData) return;

    const list = await loadVentaProductos(supabase, mesaData.panaderia_id, {
      onlyDisponible: true,
    });
    setProductos(list);

    // Nunca reabre sola: solo carga si hay cuenta abierta
    const { data: cuenta } = await supabase
      .from("cuentas_mesa")
      .select("*")
      .eq("mesa_id", id)
      .eq("estado", "abierta")
      .maybeSingle();

    if (!cuenta) {
      setCuentaId(null);
      setItems([]);
      setSubCuentas([]);
      return;
    }

    setCuentaId(cuenta.id);
    const [{ data: its }, { data: subs }] = await Promise.all([
      supabase
        .from("items_cuenta")
        .select("*, productos(*)")
        .eq("cuenta_mesa_id", cuenta.id)
        .neq("estado", "cancelado")
        .order("created_at"),
      supabase.from("sub_cuentas").select("*").eq("cuenta_mesa_id", cuenta.id),
    ]);
    setItems((its as ItemCuenta[]) ?? []);
    setSubCuentas((subs as SubCuenta[]) ?? []);
  }, [id]);

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel(`mesa-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "items_cuenta" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "cuentas_mesa" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  const total = items.reduce((s, i) => s + i.precio_al_momento * i.cantidad, 0);
  const filtered = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (p.codigo_barras ?? "").includes(search),
  );

  async function abrirMesa() {
    setAbriendo(true);
    setCerrarMsg("");
    const res = await fetch(`/api/mesas/${id}/abrir`, { method: "POST" });
    setAbriendo(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setCerrarMsg(body.error ?? "No se pudo abrir la mesa");
      return;
    }
    await load();
  }

  async function addProducto(producto: Producto, cantidad: number) {
    if (!cuentaId) return;
    await fetch(`/api/cuentas/${cuentaId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ producto_id: producto.id, origen: "mesero", cantidad }),
    });
    load();
  }

  async function setCantidad(itemId: string, cantidad: number) {
    await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cantidad }),
    });
    load();
  }

  async function quitar(itemId: string) {
    await fetch(`/api/items/${itemId}`, { method: "DELETE" });
    load();
  }

  async function crearSubCuenta() {
    if (!cuentaId || !nuevaSub.trim()) return;
    await fetch(`/api/cuentas/${cuentaId}/sub-cuentas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ etiqueta: nuevaSub.trim() }),
    });
    setNuevaSub("");
    load();
  }

  async function asignarItem(itemId: string, subCuentaId: string | null) {
    await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sub_cuenta_id: subCuentaId }),
    });
    load();
  }

  async function cerrarMesa() {
    if (!cuentaId) return;
    setCerrando(true);
    setCerrarMsg("");
    closingRef.current = true;
    const res = await fetch(`/api/cuentas/${cuentaId}/cerrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total_final: total, medio_pago: medioPago }),
    });
    if (!res.ok) {
      closingRef.current = false;
      setCerrando(false);
      const body = await res.json().catch(() => ({}));
      setCerrarMsg(body.error ?? "No se pudo cerrar la mesa");
      return;
    }
    setCuentaId(null);
    setItems([]);
    router.replace("/mesas");
  }

  if (!mesa) return <p>Cargando...</p>;

  if (!cuentaId) {
    return (
      <div className="space-y-4">
        <div>
          <Link href="/mesas" className="text-sm text-orange-700 hover:underline dark:text-orange-300">
            ← Mesas
          </Link>
          <h1 className="text-2xl font-bold">{mesa.nombre}</h1>
          <p className="text-sm text-stone-500">{mesa.zona} · libre</p>
        </div>
        <Card className="flex max-w-xl flex-col items-start gap-3 p-6">
          <CardTitle>Mesa sin cuenta abierta</CardTitle>
          <p className="text-sm text-stone-500">
            Abre la mesa para tomar pedidos. No se reabre sola al cerrar.
          </p>
          {cerrarMsg && <p className="text-sm text-red-600">{cerrarMsg}</p>}
          <Button onClick={abrirMesa} disabled={abriendo}>
            {abriendo ? "Abriendo..." : "Abrir mesa"}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/mesas" className="text-sm text-orange-700 hover:underline dark:text-orange-300">
            ← Mesas
          </Link>
          <h1 className="text-2xl font-bold">{mesa.nombre}</h1>
        </div>
        <Badge color="info">{formatCOP(total)}</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Input
            placeholder="Buscar producto o código de barras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ProductGrid productos={filtered} onSelect={addProducto} compact />
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitle>Ítems de la cuenta</CardTitle>
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id} className="rounded-lg bg-stone-50 p-2 text-sm dark:bg-stone-800">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{item.productos?.nombre}</span>
                    <button type="button" onClick={() => quitar(item.id)} aria-label="Quitar">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded border p-1 dark:border-stone-600"
                        onClick={() => setCantidad(item.id, item.cantidad - 1)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-6 text-center font-medium">{item.cantidad}</span>
                      <button
                        type="button"
                        className="rounded border p-1 dark:border-stone-600"
                        onClick={() => setCantidad(item.id, item.cantidad + 1)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span>{formatCOP(item.precio_al_momento * item.cantidad)}</span>
                  </div>
                  {subCuentas.length > 0 && (
                    <select
                      className="mt-1 w-full rounded border px-1 py-0.5 text-xs dark:border-stone-600 dark:bg-stone-900"
                      value={item.sub_cuenta_id ?? ""}
                      onChange={(e) => asignarItem(item.id, e.target.value || null)}
                    >
                      <option value="">General</option>
                      {subCuentas.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.etiqueta}
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardTitle>División de cuenta</CardTitle>
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="Ej: Persona 1"
                value={nuevaSub}
                onChange={(e) => setNuevaSub(e.target.value)}
              />
              <Button onClick={crearSubCuenta}>+</Button>
            </div>
            {subCuentas.map((s) => {
              const subTotal = items
                .filter((i) => i.sub_cuenta_id === s.id)
                .reduce((sum, i) => sum + i.precio_al_momento * i.cantidad, 0);
              return (
                <div key={s.id} className="mt-2 flex justify-between text-sm">
                  <span>{s.etiqueta}</span>
                  <span className="font-medium">{formatCOP(subTotal)}</span>
                </div>
              );
            })}
          </Card>

          <Card>
            <CardTitle>Cerrar mesa</CardTitle>
            <select
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900"
              value={medioPago}
              onChange={(e) => setMedioPago(e.target.value as typeof medioPago)}
            >
              <option value="efectivo">Efectivo</option>
              <option value="electronico">Electrónico</option>
              <option value="mixto">Mixto</option>
            </select>
            <p className="mt-2 text-xl font-bold text-orange-700 dark:text-orange-400">
              {formatCOP(total)}
            </p>
            {cerrarMsg && <p className="mt-2 text-sm text-red-600">{cerrarMsg}</p>}
            <Button className="mt-3 w-full" onClick={cerrarMesa} disabled={cerrando}>
              {cerrando ? "Cerrando..." : "Cerrar y liberar mesa"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
