"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { formatCOP } from "@/lib/format";
import type { CartItem, MedioPago } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

function CartItemsList({
  items,
  onUpdateQty,
  onRemove,
}: {
  items: CartItem[];
  onUpdateQty: (productoId: string, delta: number) => void;
  onRemove: (productoId: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-stone-500">Agrega productos del catálogo</p>;
  }

  return (
    <ul className="space-y-2">
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
  );
}

function CartFooter({
  total,
  itemsLength,
  onClear,
  onCheckout,
  checkoutLabel,
  disabled,
  hint,
  message,
}: {
  total: number;
  itemsLength: number;
  onClear: () => void;
  onCheckout: () => void;
  checkoutLabel: string;
  disabled: boolean;
  hint: string;
  message?: string;
}) {
  return (
    <div className="shrink-0 border-t border-stone-200 bg-white pt-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-500">Total referencia</span>
        <span className="text-2xl font-bold text-amber-700">{formatCOP(total)}</span>
      </div>
      <p className="mt-1 text-xs text-stone-400">{hint}</p>
      {message && <p className="mt-2 text-sm text-amber-800">{message}</p>}
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onClear} disabled={!itemsLength}>
          Limpiar
        </Button>
        <Button className="flex-1" onClick={onCheckout} disabled={!itemsLength || disabled}>
          {checkoutLabel}
        </Button>
      </div>
    </div>
  );
}

export function CartPanel({
  items,
  medioPago,
  onMedioPago,
  montoEfectivo,
  montoElectronico,
  onMontoEfectivo,
  onMontoElectronico,
  onUpdateQty,
  onRemove,
  onClear,
  onCheckout,
  checkoutLabel = "Registrar venta",
  disabled = false,
  hint = "Digita este valor en la caja fiscal",
  message,
  extra,
}: {
  items: CartItem[];
  medioPago: MedioPago;
  onMedioPago: (v: MedioPago) => void;
  montoEfectivo?: string;
  montoElectronico?: string;
  onMontoEfectivo?: (v: string) => void;
  onMontoElectronico?: (v: string) => void;
  onUpdateQty: (productoId: string, delta: number) => void;
  onRemove: (productoId: string) => void;
  onClear: () => void;
  onCheckout: () => void;
  checkoutLabel?: string;
  disabled?: boolean;
  hint?: string;
  message?: string;
  extra?: ReactNode;
}) {
  const total = items.reduce((s, i) => s + i.producto.precio * i.cantidad, 0);
  const count = items.reduce((s, i) => s + i.cantidad, 0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [recibido, setRecibido] = useState("");
  const prevCount = useRef(count);

  useEffect(() => {
    if (prevCount.current > 0 && count === 0) setSheetOpen(false);
    prevCount.current = count;
  }, [count]);

  const recibidoNum = Math.round(Number(recibido) || 0);
  const cambio = medioPago === "efectivo" && recibidoNum > 0 ? recibidoNum - total : null;

  const pagoExtra = (
    <div className="space-y-2">
      {medioPago === "mixto" && onMontoEfectivo && onMontoElectronico && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-stone-500">Efectivo</label>
            <Input
              type="number"
              min={0}
              value={montoEfectivo ?? ""}
              onChange={(e) => onMontoEfectivo(e.target.value)}
              placeholder="COP"
            />
          </div>
          <div>
            <label className="text-xs text-stone-500">Electrónico</label>
            <Input
              type="number"
              min={0}
              value={montoElectronico ?? ""}
              onChange={(e) => onMontoElectronico(e.target.value)}
              placeholder="COP"
            />
          </div>
          <p className="col-span-2 text-xs text-stone-400">
            Debe sumar {formatCOP(total)}
          </p>
        </div>
      )}
      {medioPago === "efectivo" && (
        <div>
          <label className="text-xs text-stone-500">Recibido (opcional)</label>
          <Input
            type="number"
            min={0}
            value={recibido}
            onChange={(e) => setRecibido(e.target.value)}
            placeholder="Para calcular cambio"
          />
          {cambio != null && (
            <p
              className={`mt-1 text-sm font-medium ${
                cambio < 0 ? "text-red-600" : "text-emerald-700"
              }`}
            >
              {cambio < 0 ? `Faltan ${formatCOP(-cambio)}` : `Cambio ${formatCOP(cambio)}`}
            </p>
          )}
        </div>
      )}
    </div>
  );

  const scrollBody = (
    <div className="space-y-4">
      <PagoSelect value={medioPago} onChange={onMedioPago} />
      {pagoExtra}
      <CartItemsList items={items} onUpdateQty={onUpdateQty} onRemove={onRemove} />
      {extra}
    </div>
  );

  const footer = (
    <CartFooter
      total={total}
      itemsLength={items.length}
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
      <Card className="sticky top-4 hidden max-h-[calc(100dvh-6.5rem)] flex-col overflow-hidden lg:flex">
        <CardTitle className="shrink-0">Cuenta actual</CardTitle>
        <div className="mt-3 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
          {scrollBody}
        </div>
        <div className="mt-3 shrink-0">{footer}</div>
      </Card>

      <MobileAccountSheet
        title="Cuenta actual"
        total={total}
        count={count}
        actionLabel={count === 0 ? "Ver cuenta" : "Cobrar"}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      >
        <div className="space-y-4">
          {scrollBody}
          {footer}
        </div>
      </MobileAccountSheet>
    </>
  );
}
