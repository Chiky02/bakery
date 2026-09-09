"use client";

import { useEffect, useRef, useState } from "react";
import { formatCOP } from "@/lib/format";
import type { CartItem, MedioPago } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { MobileAccountSheet } from "@/components/app/mobile-account-sheet";

function PagoSelect({
  value,
  onChange,
}: {
  value: MedioPago;
  onChange: (v: MedioPago) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">Medio de pago</label>
      <select
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value as MedioPago)}
      >
        <option value="efectivo">Efectivo</option>
        <option value="electronico">Electrónico</option>
        <option value="mixto">Mixto</option>
      </select>
    </div>
  );
}

function CartBody({
  items,
  total,
  medioPago,
  onMedioPago,
  onUpdateQty,
  onRemove,
  onClear,
  onCheckout,
  checkoutLabel,
  disabled,
  hint,
  message,
}: {
  items: CartItem[];
  total: number;
  medioPago: MedioPago;
  onMedioPago: (v: MedioPago) => void;
  onUpdateQty: (productoId: string, delta: number) => void;
  onRemove: (productoId: string) => void;
  onClear: () => void;
  onCheckout: () => void;
  checkoutLabel: string;
  disabled: boolean;
  hint: string;
  message?: string;
}) {
  return (
    <>
      <PagoSelect value={medioPago} onChange={onMedioPago} />
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">Agrega productos del catálogo</p>
      ) : (
        <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
          {items.map((item) => (
            <li
              key={item.producto.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 p-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.producto.nombre}</p>
                <p className="text-xs text-stone-500">{formatCOP(item.producto.precio)} c/u</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onUpdateQty(item.producto.id, -1)}
                >
                  −
                </Button>
                <span className="w-6 text-center text-sm font-semibold">{item.cantidad}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onUpdateQty(item.producto.id, 1)}
                >
                  +
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onRemove(item.producto.id)}>
                  ✕
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 border-t border-stone-200 pt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-500">Total referencia</span>
          <span className="text-2xl font-bold text-amber-700">{formatCOP(total)}</span>
        </div>
        <p className="mt-1 text-xs text-stone-400">{hint}</p>
        {message && <p className="mt-2 text-sm text-emerald-600">{message}</p>}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClear} disabled={!items.length}>
            Limpiar
          </Button>
          <Button
            className="flex-1"
            onClick={onCheckout}
            disabled={!items.length || disabled}
          >
            {checkoutLabel}
          </Button>
        </div>
      </div>
    </>
  );
}

export function CartPanel({
  items,
  medioPago,
  onMedioPago,
  onUpdateQty,
  onRemove,
  onClear,
  onCheckout,
  checkoutLabel = "Registrar venta",
  disabled = false,
  hint = "Digita este valor en la caja fiscal",
  message,
}: {
  items: CartItem[];
  medioPago: MedioPago;
  onMedioPago: (v: MedioPago) => void;
  onUpdateQty: (productoId: string, delta: number) => void;
  onRemove: (productoId: string) => void;
  onClear: () => void;
  onCheckout: () => void;
  checkoutLabel?: string;
  disabled?: boolean;
  hint?: string;
  message?: string;
}) {
  const total = items.reduce((s, i) => s + i.producto.precio * i.cantidad, 0);
  const count = items.reduce((s, i) => s + i.cantidad, 0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    if (prevCount.current > 0 && count === 0) setSheetOpen(false);
    prevCount.current = count;
  }, [count]);
  const body = (
    <CartBody
      items={items}
      total={total}
      medioPago={medioPago}
      onMedioPago={onMedioPago}
      onUpdateQty={onUpdateQty}
      onRemove={onRemove}
      onClear={onClear}
      onCheckout={onCheckout}
      checkoutLabel={checkoutLabel}
      disabled={disabled}
      hint={hint}
      message={message}
    />
  );

  return (
    <>
      <Card className="sticky top-4 hidden h-fit flex-col lg:flex">
        <CardTitle>Cuenta actual</CardTitle>
        <div className="mt-3">{body}</div>
      </Card>
      <MobileAccountSheet
        title="Cuenta actual"
        total={total}
        count={count}
        actionLabel={count === 0 ? "Ver cuenta" : "Cobrar"}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      >
        {body}
      </MobileAccountSheet>
    </>
  );
}
