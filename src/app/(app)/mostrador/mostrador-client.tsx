"use client";

import { useState } from "react";
import { ProductGrid } from "@/components/app/product-grid";
import { CartPanel } from "@/components/app/cart-panel";
import type { CartItem, Factura, Producto } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

export function MostradorClient({ productos }: { productos: Producto[] }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [medioPago, setMedioPago] = useState<"efectivo" | "electronico" | "mixto">("efectivo");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [emitirFactura, setEmitirFactura] = useState(false);
  const [cliente, setCliente] = useState({
    nombre: "",
    documento: "",
    email: "",
    telefono: "",
    direccion: "",
  });
  const [ivaPct, setIvaPct] = useState("0");

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
    if (emitirFactura && !cliente.nombre.trim()) {
      setMessage("Indica razón social / nombre del cliente para la factura");
      return;
    }
    setLoading(true);
    setMessage("");
    const detalleCart = cart.map((i) => ({
      producto_id: i.producto.id,
      nombre: i.producto.nombre,
      cantidad: i.cantidad,
      precio: i.producto.precio,
      subtotal: i.producto.precio * i.cantidad,
    }));

    const res = await fetch("/api/ventas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medio_pago: medioPago, detalle: detalleCart }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMessage(body.error ?? "Error al registrar la venta");
      setLoading(false);
      return;
    }

    const venta = await res.json();
    setCart([]);
    setMessage("✓ Venta registrada. Digita el total en la caja fiscal.");

    if (emitirFactura) {
      const fRes = await fetch("/api/facturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origen: "mostrador",
          venta_id: venta.id,
          cliente_nombre: cliente.nombre.trim(),
          cliente_documento: cliente.documento.trim() || null,
          cliente_email: cliente.email.trim() || null,
          cliente_telefono: cliente.telefono.trim() || null,
          cliente_direccion: cliente.direccion.trim() || null,
          medio_pago: medioPago,
          iva_porcentaje: Number(ivaPct) || 0,
          detalle: detalleCart.map((d) => ({
            producto_id: d.producto_id,
            nombre: d.nombre,
            cantidad: d.cantidad,
            precio: d.precio,
          })),
          notas: "Documento comercial de venta (no es factura electrónica DIAN).",
        }),
      });
      if (fRes.ok) {
        const f = (await fRes.json()) as Factura;
        setEmitirFactura(false);
        setCliente({ nombre: "", documento: "", email: "", telefono: "", direccion: "" });
        window.open(`/facturas/${f.id}`, "_blank");
        setMessage("✓ Venta y factura emitida. Imprime o guarda el PDF del navegador.");
      } else {
        const body = await fRes.json().catch(() => ({}));
        setMessage(`Venta OK, pero factura falló: ${body.error ?? "error"}`);
      }
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
        <div className="space-y-3">
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
          <Card className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={emitirFactura}
                onChange={(e) => setEmitirFactura(e.target.checked)}
              />
              Emitir factura de venta (impresa)
            </label>
            {emitirFactura && (
              <>
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
                  placeholder="Teléfono"
                  value={cliente.telefono}
                  onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
                />
                <Input
                  placeholder="Dirección"
                  value={cliente.direccion}
                  onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })}
                />
                <Input
                  type="number"
                  placeholder="% IVA (0 si no aplica)"
                  value={ivaPct}
                  onChange={(e) => setIvaPct(e.target.value)}
                />
              </>
            )}
            <CardTitle className="!text-xs font-normal text-stone-400">
              También puedes emitir desde Caja sobre ventas del día.
            </CardTitle>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => (window.location.href = "/caja")}
            >
              Ir a caja
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
