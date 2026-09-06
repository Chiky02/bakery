"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ProductGrid } from "@/components/app/product-grid";
import { formatCOP } from "@/lib/format";
import type { ConfigNegocio, Mesa, Producto } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

export default function QrMenuPage() {
  const { mesaId } = useParams<{ mesaId: string }>();
  const [mesa, setMesa] = useState<Mesa | null>(null);
  const [config, setConfig] = useState<ConfigNegocio | null>(null);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cart, setCart] = useState<{ producto: Producto; cantidad: number }[]>([]);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: m }, { data: c }, { data: p }] = await Promise.all([
      supabase.from("mesas").select("*").eq("id", mesaId).single(),
      supabase.from("config_negocio").select("*").eq("id", 1).single(),
      supabase.from("productos").select("*, categorias(*)").eq("disponible", true).order("orden"),
    ]);
    setMesa(m as Mesa);
    setConfig(c as ConfigNegocio);
    setProductos((p as Producto[]) ?? []);
  }, [mesaId]);

  useEffect(() => {
    load();
  }, [load]);

  function addToCart(producto: Producto) {
    setCart((prev) => {
      const ex = prev.find((i) => i.producto.id === producto.id);
      if (ex) return prev.map((i) => (i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i));
      return [...prev, { producto, cantidad: 1 }];
    });
  }

  async function enviarPedido() {
    const res = await fetch(`/api/qr/${mesaId}/pedido`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map((i) => ({
          producto_id: i.producto.id,
          cantidad: i.cantidad,
        })),
      }),
    });
    if (res.ok) {
      setCart([]);
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    }
  }

  if (!mesa) return <div className="p-8 text-center">Cargando menú...</div>;

  if (!config?.pedido_directo_habilitado || !mesa.qr_habilitado) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        <Card>
          <CardTitle>Pedido por QR no disponible</CardTitle>
          <p className="mt-2 text-sm text-stone-500">
            Consulta con el mesero para hacer tu pedido.
          </p>
        </Card>
      </div>
    );
  }

  const total = cart.reduce((s, i) => s + i.producto.precio * i.cantidad, 0);

  return (
    <div className="min-h-screen bg-amber-50 p-4 dark:bg-stone-950">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="text-center">
          <p className="text-3xl">🥐</p>
          <h1 className="text-xl font-bold">{config.nombre}</h1>
          <p className="text-sm text-stone-500">{mesa.nombre}</p>
        </header>

        <ProductGrid productos={productos} onSelect={addToCart} compact />

        {cart.length > 0 && (
          <Card className="sticky bottom-4">
            <CardTitle>Tu pedido</CardTitle>
            <ul className="mt-2 space-y-1 text-sm">
              {cart.map((i) => (
                <li key={i.producto.id} className="flex justify-between">
                  <span>
                    {i.cantidad}x {i.producto.nombre}
                  </span>
                  <span>{formatCOP(i.producto.precio * i.cantidad)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 font-bold text-amber-700">{formatCOP(total)}</p>
            <Button className="mt-3 w-full" onClick={enviarPedido}>
              Enviar pedido
            </Button>
            {sent && (
              <p className="mt-2 text-center text-sm text-emerald-600">
                ✓ Pedido enviado{config.requiere_aprobacion_mesero ? " — esperando confirmación" : ""}
              </p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
