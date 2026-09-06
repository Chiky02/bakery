"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProductGrid } from "@/components/app/product-grid";
import { CartPanel } from "@/components/app/cart-panel";
import type { CartItem, Producto } from "@/types";
import { Input } from "@/components/ui/input";

export default function MostradorPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [medioPago, setMedioPago] = useState<"efectivo" | "electronico" | "mixto">("efectivo");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("productos")
      .select("*, categorias(*)")
      .eq("disponible", true)
      .order("orden")
      .then(({ data }) => setProductos((data as Producto[]) ?? []));
  }, []);

  const filtered = productos.filter((p) =>
    p.nombre.toLowerCase().includes(search.toLowerCase()),
  );

  function addToCart(producto: Producto) {
    setCart((prev) => {
      const existing = prev.find((i) => i.producto.id === producto.id);
      if (existing) {
        return prev.map((i) =>
          i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i,
        );
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.producto.id === id ? { ...i, cantidad: i.cantidad + delta } : i,
        )
        .filter((i) => i.cantidad > 0),
    );
  }

  async function checkout() {
    setLoading(true);
    setMessage("");
    const total = cart.reduce((s, i) => s + i.producto.precio * i.cantidad, 0);
    const detalle = cart.map((i) => ({
      producto_id: i.producto.id,
      nombre: i.producto.nombre,
      cantidad: i.cantidad,
      precio: i.producto.precio,
      subtotal: i.producto.precio * i.cantidad,
    }));

    const res = await fetch("/api/ventas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ total, medio_pago: medioPago, detalle }),
    });

    if (res.ok) {
      setCart([]);
      setMessage("✓ Venta registrada. Digita el total en la caja fiscal.");
    } else {
      setMessage("Error al registrar la venta");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Calculadora de venta</h1>
        <p className="text-sm text-stone-500">Mostrador — referencia para caja fiscal</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Input
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ProductGrid productos={filtered} onSelect={addToCart} />
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Medio de pago</label>
            <select
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-800"
              value={medioPago}
              onChange={(e) => setMedioPago(e.target.value as typeof medioPago)}
            >
              <option value="efectivo">Efectivo</option>
              <option value="electronico">Electrónico</option>
              <option value="mixto">Mixto</option>
            </select>
          </div>
          <CartPanel
            items={cart}
            onUpdateQty={updateQty}
            onRemove={(id) => updateQty(id, -999)}
            onClear={() => setCart([])}
            onCheckout={checkout}
            disabled={loading}
          />
          {message && <p className="text-sm text-emerald-600">{message}</p>}
        </div>
      </div>
    </div>
  );
}
