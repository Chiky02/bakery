"use client";

import { useState } from "react";
import { ProductGrid } from "@/components/app/product-grid";
import { CartPanel } from "@/components/app/cart-panel";
import type { CartItem, Producto } from "@/types";
import { Input } from "@/components/ui/input";

export function MostradorClient({ productos }: { productos: Producto[] }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [medioPago, setMedioPago] = useState<"efectivo" | "electronico" | "mixto">("efectivo");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const q = search.trim().toLowerCase();
  const filtered = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(q) || (p.codigo_barras ?? "").includes(search.trim()),
  );

  function addToCart(producto: Producto, cantidad: number) {
    setCart((prev) => {
      const existing = prev.find((i) => i.producto.id === producto.id);
      if (existing) {
        return prev.map((i) =>
          i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + cantidad } : i,
        );
      }
      return [...prev, { producto, cantidad }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) => (i.producto.id === id ? { ...i, cantidad: i.cantidad + delta } : i))
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
      {message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          {message}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-h-[28rem] space-y-4 lg:col-span-2">
          <Input
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-stone-200 bg-white px-4 py-10 text-center text-sm text-stone-500">
              {productos.length === 0
                ? "No hay productos disponibles para venta."
                : "Ningún producto coincide con la búsqueda."}
            </p>
          ) : (
            <ProductGrid productos={filtered} onSelect={addToCart} />
          )}
        </div>
        <CartPanel
          items={cart}
          medioPago={medioPago}
          onMedioPago={setMedioPago}
          onUpdateQty={updateQty}
          onRemove={(id) => updateQty(id, -999)}
          onClear={() => setCart([])}
          onCheckout={checkout}
          disabled={loading}
          message={message}
        />
      </div>
    </div>
  );
}
