"use client";

import { formatCOP } from "@/lib/format";
import type { CartItem } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

export function CartPanel({
  items,
  onUpdateQty,
  onRemove,
  onClear,
  onCheckout,
  checkoutLabel = "Registrar venta",
  disabled = false,
}: {
  items: CartItem[];
  onUpdateQty: (productoId: string, delta: number) => void;
  onRemove: (productoId: string) => void;
  onClear: () => void;
  onCheckout: () => void;
  checkoutLabel?: string;
  disabled?: boolean;
}) {
  const total = items.reduce((s, i) => s + i.producto.precio * i.cantidad, 0);

  return (
    <Card className="sticky top-4 flex h-fit flex-col">
      <CardTitle>Cuenta actual</CardTitle>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-stone-500">Agrega productos del catálogo</p>
      ) : (
        <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
          {items.map((item) => (
            <li
              key={item.producto.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 p-2 dark:bg-stone-800"
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
      <div className="mt-4 border-t border-stone-200 pt-4 dark:border-stone-700">
        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-500">Total referencia</span>
          <span className="text-2xl font-bold text-amber-700">{formatCOP(total)}</span>
        </div>
        <p className="mt-1 text-xs text-stone-400">
          Digita este valor en la caja fiscal
        </p>
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
    </Card>
  );
}
