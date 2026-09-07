"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProductGrid } from "@/components/app/product-grid";
import { formatCOP } from "@/lib/format";
import type { Mesa, Panaderia, Producto } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Trash2 } from "lucide-react";

type CartLine = { producto: Producto; cantidad: number };
type Step = "menu" | "cart" | "sent";

export default function QrMenuPage() {
  const { mesaId } = useParams<{ mesaId: string }>();
  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [config, setConfig] = useState<Panaderia | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [search, setSearch] = useState("");
  const [step, setStep] = useState<Step>("menu");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: m } = await supabase.from("mesas").select("*").eq("id", mesaId).single();
    if (!m) {
      setMesa(null);
      return;
    }
    setMesa(m as Mesa);
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("panaderias").select("*").eq("id", m.panaderia_id).single(),
      supabase
        .from("productos")
        .select("*, categorias(*)")
        .eq("panaderia_id", m.panaderia_id)
        .eq("disponible", true)
        .neq("tipo", "materia_prima")
        .order("orden"),
    ]);
    setConfig(c as Panaderia);
    setProductos((p as Producto[]) ?? []);
  }, [mesaId]);

  useEffect(() => {
    load();
  }, [load]);

  function addToCart(producto: Producto, cantidad: number) {
    setCart((prev) => {
      const ex = prev.find((i) => i.producto.id === producto.id);
      if (ex) {
        return prev.map((i) =>
          i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + cantidad } : i,
        );
      }
      return [...prev, { producto, cantidad }];
    });
    setStep("cart");
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => (i.producto.id === id ? { ...i, cantidad: i.cantidad + delta } : i))
        .filter((i) => i.cantidad > 0),
    );
  }

  async function enviarPedido() {
    if (cart.length === 0) return;
    setSending(true);
    const res = await fetch(`/api/qr/${mesaId}/pedido`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map((i) => ({ producto_id: i.producto.id, cantidad: i.cantidad })),
      }),
    });
    setSending(false);
    if (res.ok) {
      setCart([]);
      setStep("sent");
    }
  }

  if (!mesa) return <div className="p-8 text-center">Cargando menú...</div>;

  if (!config?.pedido_directo_habilitado || !mesa.qr_habilitado) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <Card>
          <CardTitle>Pedido por QR no disponible</CardTitle>
          <p className="mt-2 text-sm text-stone-500">Consulta con el mesero para hacer tu pedido.</p>
        </Card>
      </div>
    );
  }

  const total = cart.reduce((s, i) => s + i.producto.precio * i.cantidad, 0);
  const filtered = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (p.codigo_barras ?? "").includes(search),
  );

  if (step === "sent") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#fff8f0] p-6 text-center">
        <p className="text-4xl">✓</p>
        <h1 className="text-2xl font-bold">Pedido enviado</h1>
        <p className="max-w-sm text-stone-600">
          {config.requiere_aprobacion_mesero
            ? "El mesero confirmará tu pedido en unos momentos."
            : "Cocina ya recibió tu pedido."}
        </p>
        <Button
          onClick={() => {
            setStep("menu");
            setSearch("");
          }}
        >
          Pedir más
        </Button>
      </div>
    );
  }

  if (step === "cart") {
    return (
      <div className="mx-auto min-h-screen max-w-lg bg-[#fff8f0] p-4">
        <header className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-800">
            {config.nombre_publico ?? config.nombre}
          </p>
          <h1 className="text-xl font-bold">Tu pedido · {mesa.nombre}</h1>
        </header>
        {cart.length === 0 ? (
          <p className="text-stone-500">No hay productos. Agrega del menú.</p>
        ) : (
          <ul className="space-y-3">
            {cart.map((i) => (
              <li
                key={i.producto.id}
                className="flex items-center justify-between rounded-xl border border-orange-100 bg-white p-3"
              >
                <div>
                  <p className="font-medium">{i.producto.nombre}</p>
                  <p className="text-sm text-stone-500">
                    {formatCOP(i.producto.precio * i.cantidad)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => updateQty(i.producto.id, -1)}>
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-6 text-center font-semibold">{i.cantidad}</span>
                  <button type="button" onClick={() => updateQty(i.producto.id, 1)}>
                    <Plus className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => updateQty(i.producto.id, -i.cantidad)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-2xl font-bold text-orange-800">{formatCOP(total)}</p>
        <div className="mt-4 flex flex-col gap-2">
          <Button className="w-full" disabled={cart.length === 0 || sending} onClick={enviarPedido}>
            {sending ? "Enviando..." : "Confirmar pedido"}
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => setStep("menu")}>
            Pedir más productos
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fff8f0] p-4">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-800">
              {config.nombre_publico ?? config.nombre}
            </p>
            <h1 className="text-xl font-bold">{mesa.nombre}</h1>
          </div>
          {cart.length > 0 && (
            <Button size="sm" onClick={() => setStep("cart")}>
              Ver pedido ({cart.reduce((s, i) => s + i.cantidad, 0)})
            </Button>
          )}
        </header>

        <Input
          placeholder="Buscar producto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <ProductGrid productos={filtered} onSelect={addToCart} compact />
      </div>
    </div>
  );
}
