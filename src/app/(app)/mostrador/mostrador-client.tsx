"use client";

import { useState } from "react";
import { ProductGrid } from "@/components/app/product-grid";
import { CartPanel } from "@/components/app/cart-panel";
import type { CartItem, Factura, Panaderia, Producto } from "@/types";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export function MostradorClient({
  productos,
  panaderia,
}: {
  productos: Producto[];
  panaderia: Pick<Panaderia, "id" | "imprimir_ticket_venta">;
}) {
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
  const printTicket = panaderia.imprimir_ticket_venta !== false;

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
    let msg = "✓ Venta registrada. Digita el total en la caja fiscal.";

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
        msg = "✓ Venta y factura emitida. Imprime o guarda el PDF del navegador.";
      } else {
        const body = await fRes.json().catch(() => ({}));
        msg = `Venta OK, pero factura falló: ${body.error ?? "error"}`;
      }
    } else if (printTicket) {
      window.open(`/ventas/${venta.id}/ticket`, "_blank");
      msg = "✓ Venta registrada. Ticket listo para imprimir / PDF.";
    }

    setMessage(msg);
    setLoading(false);
  }

  const facturaExtra = (
    <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50/80 p-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={emitirFactura}
          onChange={(e) => setEmitirFactura(e.target.checked)}
        />
        Emitir factura de venta (impresa)
      </label>
      {emitirFactura && (
        <div className="space-y-2">
          <p className="text-xs text-stone-500">
            Completa los datos del comprador aquí (quedan encima del total). No es FE DIAN.
          </p>
          <Input
            id="mostrador-cliente-nombre"
            name="cliente_nombre"
            placeholder="Razón social / nombre *"
            value={cliente.nombre}
            onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
          />
          <Input
            id="mostrador-cliente-doc"
            name="cliente_documento"
            placeholder="NIT / CC"
            value={cliente.documento}
            onChange={(e) => setCliente({ ...cliente, documento: e.target.value })}
          />
          <Input
            id="mostrador-cliente-email"
            name="cliente_email"
            placeholder="Email"
            value={cliente.email}
            onChange={(e) => setCliente({ ...cliente, email: e.target.value })}
          />
          <Input
            id="mostrador-cliente-tel"
            name="cliente_telefono"
            placeholder="Teléfono"
            value={cliente.telefono}
            onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
          />
          <Input
            id="mostrador-cliente-dir"
            name="cliente_direccion"
            placeholder="Dirección"
            value={cliente.direccion}
            onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })}
          />
          <Input
            id="mostrador-iva"
            name="iva"
            type="number"
            placeholder="% IVA (0 si no aplica)"
            value={ivaPct}
            onChange={(e) => setIvaPct(e.target.value)}
          />
        </div>
      )}
      {!emitirFactura && printTicket && (
        <p className="text-xs text-stone-400">
          Al registrar se abrirá el ticket de venta (lista + total) para imprimir o PDF.
        </p>
      )}
      <Link href="/caja" className="block text-xs text-orange-700 underline">
        Ir a caja / anular ventas
      </Link>
    </div>
  );

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
          extra={facturaExtra}
        />
      </div>
    </div>
  );
}
