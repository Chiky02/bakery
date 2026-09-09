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
import { MobileAccountSheet } from "@/components/app/mobile-account-sheet";

export default function MesaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const closingRef = useRef(false);
  /** Evita que el realtime dispare reload mientras nosotros mutamos. */
  const mutatingRef = useRef(0);
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
  const [cuentaOpen, setCuentaOpen] = useState(false);
  const [emitirFactura, setEmitirFactura] = useState(false);
  const [ivaPct, setIvaPct] = useState("0");
  const [cliente, setCliente] = useState({
    nombre: "",
    documento: "",
    email: "",
    telefono: "",
    direccion: "",
  });

  /** Solo ítems + subcuentas (rápido). No recarga catálogo. */
  const refreshCuenta = useCallback(async (cid: string) => {
    if (closingRef.current) return;
    const supabase = createClient();
    const [{ data: its }, { data: subs }] = await Promise.all([
      supabase
        .from("items_cuenta")
        .select("*, productos(*)")
        .eq("cuenta_mesa_id", cid)
        .neq("estado", "cancelado")
        .order("created_at"),
      supabase.from("sub_cuentas").select("*").eq("cuenta_mesa_id", cid),
    ]);
    setItems((its as ItemCuenta[]) ?? []);
    setSubCuentas((subs as SubCuenta[]) ?? []);
  }, []);

  /** Carga inicial: mesa + catálogo + cuenta. */
  const bootstrap = useCallback(async () => {
    if (closingRef.current) return;
    const supabase = createClient();
    const { data: mesaData } = await supabase.from("mesas").select("*").eq("id", id).single();
    setMesa(mesaData as Mesa);
    if (!mesaData) return;

    const [list, cuentaRes] = await Promise.all([
      loadVentaProductos(supabase, mesaData.panaderia_id, { onlyDisponible: true }),
      supabase
        .from("cuentas_mesa")
        .select("*")
        .eq("mesa_id", id)
        .eq("estado", "abierta")
        .maybeSingle(),
    ]);
    setProductos(list);

    const cuenta = cuentaRes.data;
    if (!cuenta) {
      setCuentaId(null);
      setItems([]);
      setSubCuentas([]);
      return;
    }

    setCuentaId(cuenta.id);
    await refreshCuenta(cuenta.id);
  }, [id, refreshCuenta]);

  useEffect(() => {
    bootstrap();
    const supabase = createClient();
    const channel = supabase
      .channel(`mesa-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "items_cuenta" }, () => {
        if (mutatingRef.current > 0 || closingRef.current) return;
        setCuentaId((cid) => {
          if (cid) void refreshCuenta(cid);
          return cid;
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cuentas_mesa" }, () => {
        if (mutatingRef.current > 0 || closingRef.current) return;
        void bootstrap();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, bootstrap, refreshCuenta]);

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
    await bootstrap();
  }

  async function addProducto(producto: Producto, cantidad: number) {
    if (!cuentaId) return;
    const qty = Math.max(1, cantidad);
    const existing = items.find(
      (i) =>
        i.producto_id === producto.id &&
        ["pendiente", "pendiente_confirmacion", "en_preparacion", "listo"].includes(i.estado),
    );

    const prev = items;
    if (existing) {
      setItems((list) =>
        list.map((i) =>
          i.id === existing.id ? { ...i, cantidad: i.cantidad + qty } : i,
        ),
      );
    } else {
      const tempId = `temp-${producto.id}-${Date.now()}`;
      setItems((list) => [
        ...list,
        {
          id: tempId,
          cuenta_mesa_id: cuentaId,
          sub_cuenta_id: null,
          producto_id: producto.id,
          cantidad: qty,
          precio_al_momento: producto.precio,
          origen: "mesero",
          estado: "pendiente",
          notas: null,
          productos: producto,
        },
      ]);
    }

    mutatingRef.current += 1;
    try {
      const res = await fetch(`/api/cuentas/${cuentaId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ producto_id: producto.id, origen: "mesero", cantidad: qty }),
      });
      if (!res.ok) {
        setItems(prev);
        return;
      }
      const saved = (await res.json()) as ItemCuenta;
      setItems((list) => {
        const rest = list.filter(
          (i) =>
            i.id !== saved.id &&
            i.id !== existing?.id &&
            !i.id.startsWith(`temp-${producto.id}-`),
        );
        return [...rest, saved];
      });
    } finally {
      mutatingRef.current -= 1;
    }
  }

  async function setCantidad(itemId: string, cantidad: number) {
    const prev = items;
    if (cantidad <= 0) {
      setItems((list) => list.filter((i) => i.id !== itemId));
    } else {
      setItems((list) =>
        list.map((i) => (i.id === itemId ? { ...i, cantidad } : i)),
      );
    }

    mutatingRef.current += 1;
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cantidad }),
      });
      if (!res.ok) {
        setItems(prev);
        return;
      }
      if (cantidad <= 0) return;
      const saved = (await res.json()) as ItemCuenta;
      setItems((list) => list.map((i) => (i.id === itemId ? saved : i)));
    } finally {
      mutatingRef.current -= 1;
    }
  }

  async function quitar(itemId: string) {
    const prev = items;
    setItems((list) => list.filter((i) => i.id !== itemId));

    mutatingRef.current += 1;
    try {
      const res = await fetch(`/api/items/${itemId}`, { method: "DELETE" });
      if (!res.ok) setItems(prev);
    } finally {
      mutatingRef.current -= 1;
    }
  }

  async function crearSubCuenta() {
    if (!cuentaId || !nuevaSub.trim()) return;
    mutatingRef.current += 1;
    try {
      await fetch(`/api/cuentas/${cuentaId}/sub-cuentas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etiqueta: nuevaSub.trim() }),
      });
      setNuevaSub("");
      await refreshCuenta(cuentaId);
    } finally {
      mutatingRef.current -= 1;
    }
  }

  async function asignarItem(itemId: string, subCuentaId: string | null) {
    const prev = items;
    setItems((list) =>
      list.map((i) => (i.id === itemId ? { ...i, sub_cuenta_id: subCuentaId } : i)),
    );
    mutatingRef.current += 1;
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sub_cuenta_id: subCuentaId }),
      });
      if (!res.ok) setItems(prev);
    } finally {
      mutatingRef.current -= 1;
    }
  }

  async function cerrarMesa() {
    if (!cuentaId) return;
    if (emitirFactura && !cliente.nombre.trim()) {
      setCerrarMsg("Indica razón social / nombre del cliente para la factura");
      return;
    }
    setCerrando(true);
    setCerrarMsg("");
    closingRef.current = true;
    const detalleFactura = items.map((i) => ({
      producto_id: i.producto_id,
      nombre: i.productos?.nombre ?? "Ítem",
      cantidad: i.cantidad,
      precio: i.precio_al_momento,
    }));
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

    if (emitirFactura) {
      const fRes = await fetch("/api/facturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origen: "mesa",
          cuenta_mesa_id: cuentaId,
          cliente_nombre: cliente.nombre.trim(),
          cliente_documento: cliente.documento.trim() || null,
          cliente_email: cliente.email.trim() || null,
          cliente_telefono: cliente.telefono.trim() || null,
          cliente_direccion: cliente.direccion.trim() || null,
          medio_pago: medioPago,
          iva_porcentaje: Number(ivaPct) || 0,
          detalle: detalleFactura,
          notas: "Documento comercial de venta (no es factura electrónica DIAN).",
        }),
      });
      if (fRes.ok) {
        const f = await fRes.json();
        window.open(`/facturas/${f.id}`, "_blank");
      }
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
          <Link href="/mesas" className="text-sm text-orange-700 hover:underline">
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

  const itemCount = items.reduce((s, i) => s + i.cantidad, 0);

  const itemsList = (
    <ul className="space-y-2">
      {items.length === 0 ? (
        <li className="text-sm text-stone-500">Sin ítems aún</li>
      ) : (
        items.map((item) => (
          <li key={item.id} className="rounded-lg bg-stone-50 p-2 text-sm">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium">{item.productos?.nombre}</span>
              <button
                type="button"
                onClick={() => quitar(item.id)}
                aria-label="Quitar"
                disabled={item.id.startsWith("temp-")}
              >
                <Trash2 className="h-4 w-4 text-red-600" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="rounded border p-1"
                  disabled={item.id.startsWith("temp-")}
                  onClick={() => setCantidad(item.id, item.cantidad - 1)}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-6 text-center font-medium">{item.cantidad}</span>
                <button
                  type="button"
                  className="rounded border p-1"
                  disabled={item.id.startsWith("temp-")}
                  onClick={() => setCantidad(item.id, item.cantidad + 1)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <span>{formatCOP(item.precio_al_momento * item.cantidad)}</span>
            </div>
            {subCuentas.length > 0 && (
              <select
                className="mt-1 w-full rounded border px-1 py-0.5 text-xs"
                value={item.sub_cuenta_id ?? ""}
                disabled={item.id.startsWith("temp-")}
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
        ))
      )}
    </ul>
  );

  const divisionBlock = (
    <div>
      <p className="text-sm font-semibold">División de cuenta</p>
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
    </div>
  );

  const cerrarBlock = (
    <div className="shrink-0 border-t border-stone-200 pt-3">
      <p className="text-sm font-semibold">Cerrar mesa</p>
      <select
        className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
        value={medioPago}
        onChange={(e) => setMedioPago(e.target.value as typeof medioPago)}
      >
        <option value="efectivo">Efectivo</option>
        <option value="electronico">Electrónico</option>
        <option value="mixto">Mixto</option>
      </select>
      <p className="mt-2 text-xl font-bold text-orange-700">{formatCOP(total)}</p>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={emitirFactura}
          onChange={(e) => setEmitirFactura(e.target.checked)}
        />
        Emitir factura de venta (impresa)
      </label>
      {emitirFactura && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-stone-500">
            Documento comercial para empresas. No es factura electrónica DIAN.
          </p>
          <Input
            placeholder="Razón social / nombre *"
            value={cliente.nombre}
            onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
          />
          <Input
            placeholder="NIT / CC"
            value={cliente.documento}
            onChange={(e) => setCliente({ ...cliente, documento: e.target.value })}
          />
          <Input
            placeholder="Email"
            value={cliente.email}
            onChange={(e) => setCliente({ ...cliente, email: e.target.value })}
          />
          <Input
            type="number"
            placeholder="% IVA (0 si no aplica)"
            value={ivaPct}
            onChange={(e) => setIvaPct(e.target.value)}
          />
        </div>
      )}
      {cerrarMsg && <p className="mt-2 text-sm text-red-600">{cerrarMsg}</p>}
      <Button className="mt-3 w-full" onClick={cerrarMesa} disabled={cerrando}>
        {cerrando ? "Cerrando..." : "Cerrar y liberar mesa"}
      </Button>
    </div>
  );

  const mobileCuenta = (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-semibold">Ítems de la cuenta</p>
        {itemsList}
      </div>
      {divisionBlock}
      {cerrarBlock}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/mesas" className="text-sm text-orange-700 hover:underline">
            ← Mesas
          </Link>
          <h1 className="text-2xl font-bold">{mesa.nombre}</h1>
        </div>
        <button type="button" className="lg:pointer-events-none" onClick={() => setCuentaOpen(true)}>
          <Badge color="info">{formatCOP(total)}</Badge>
        </button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Input
            placeholder="Buscar producto o código de barras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ProductGrid productos={filtered} onSelect={addProducto} compact />
        </div>

        <Card className="sticky top-4 hidden max-h-[calc(100dvh-6.5rem)] flex-col overflow-hidden lg:flex">
          <CardTitle className="shrink-0">Cuenta</CardTitle>
          <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
            <div>
              <p className="mb-2 text-sm font-semibold">Ítems</p>
              {itemsList}
            </div>
            {divisionBlock}
          </div>
          <div className="mt-3 shrink-0">{cerrarBlock}</div>
        </Card>

        <MobileAccountSheet
          title={mesa.nombre}
          total={total}
          count={itemCount}
          actionLabel={itemCount === 0 ? "Ver cuenta" : "Cobrar"}
          open={cuentaOpen}
          onOpenChange={setCuentaOpen}
        >
          {mobileCuenta}
        </MobileAccountSheet>
      </div>
    </div>
  );
}
