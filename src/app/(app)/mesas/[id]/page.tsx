"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ProductGrid } from "@/components/app/product-grid";
import { formatCOP } from "@/lib/format";
import type { ItemCuenta, Mesa, Producto, SubCuenta } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function MesaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [cuentaId, setCuentaId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemCuenta[]>([]);
  const [subCuentas, setSubCuentas] = useState<SubCuenta[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [search, setSearch] = useState("");
  const [nuevaSub, setNuevaSub] = useState("");
  const [medioPago, setMedioPago] = useState<"efectivo" | "electronico" | "mixto">("efectivo");

  const load = useCallback(async () => {
    const supabase = createClient();

    const [{ data: mesaData }, { data: prods }] = await Promise.all([
      supabase.from("mesas").select("*").eq("id", id).single(),
      supabase.from("productos").select("*, categorias(*)").eq("disponible", true).order("orden"),
    ]);
    setMesa(mesaData as Mesa);
    setProductos((prods as Producto[]) ?? []);

    let { data: cuenta } = await supabase
      .from("cuentas_mesa")
      .select("*")
      .eq("mesa_id", id)
      .eq("estado", "abierta")
      .maybeSingle();

    if (!cuenta) {
      const res = await fetch(`/api/mesas/${id}/abrir`, { method: "POST" });
      if (res.ok) cuenta = await res.json();
    }

    if (cuenta) {
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
    }
  }, [id]);

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel(`mesa-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items_cuenta" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cuentas_mesa" },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  const total = items.reduce((s, i) => s + i.precio_al_momento * i.cantidad, 0);
  const filtered = productos.filter((p) =>
    p.nombre.toLowerCase().includes(search.toLowerCase()),
  );

  async function addProducto(producto: Producto) {
    if (!cuentaId) return;
    await fetch(`/api/cuentas/${cuentaId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ producto_id: producto.id, origen: "mesero" }),
    });
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
    await fetch(`/api/cuentas/${cuentaId}/cerrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total_final: total, medio_pago: medioPago }),
    });
    window.location.href = "/mesas";
  }

  if (!mesa) return <p>Cargando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/mesas" className="text-sm text-amber-700 hover:underline">
            ← Mesas
          </Link>
          <h1 className="text-2xl font-bold">{mesa.nombre}</h1>
        </div>
        <Badge color="info">{formatCOP(total)}</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <ProductGrid productos={filtered} onSelect={addProducto} compact />
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitle>Ítems de la cuenta</CardTitle>
            <ul className="mt-3 max-h-60 space-y-2 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id} className="rounded-lg bg-stone-50 p-2 text-sm dark:bg-stone-800">
                  <div className="flex justify-between">
                    <span>
                      {item.cantidad}x {item.productos?.nombre}
                    </span>
                    <span>{formatCOP(item.precio_al_momento * item.cantidad)}</span>
                  </div>
                  {subCuentas.length > 0 && (
                    <select
                      className="mt-1 w-full rounded border px-1 py-0.5 text-xs"
                      value={item.sub_cuenta_id ?? ""}
                      onChange={(e) =>
                        asignarItem(item.id, e.target.value || null)
                      }
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
              className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
              value={medioPago}
              onChange={(e) => setMedioPago(e.target.value as typeof medioPago)}
            >
              <option value="efectivo">Efectivo</option>
              <option value="electronico">Electrónico</option>
              <option value="mixto">Mixto</option>
            </select>
            <p className="mt-2 text-xl font-bold text-amber-700">{formatCOP(total)}</p>
            <Button className="mt-3 w-full" onClick={cerrarMesa}>
              Cerrar y liberar mesa
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
