"use client";

import { useState } from "react";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Producto } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";

export function ProductGrid({
  productos,
  onSelect,
  compact = false,
  showQty = true,
}: {
  productos: Producto[];
  onSelect: (p: Producto, cantidad: number) => void;
  compact?: boolean;
  showQty?: boolean;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const byCategory = productos.reduce<Record<string, Producto[]>>((acc, p) => {
    const cat = p.categorias?.nombre ?? "Sin categoría";
    (acc[cat] ??= []).push(p);
    return acc;
  }, {});

  function getQty(id: string) {
    return qty[id] ?? 0;
  }

  function add(p: Producto) {
    const n = getQty(p.id);
    if (n <= 0) return;
    onSelect(p, n);
    setQty((q) => ({ ...q, [p.id]: 0 }));
  }

  return (
    <div className="space-y-6">
      {Object.entries(byCategory).map(([cat, items]) => (
        <section key={cat}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
            {cat}
          </h3>
          <div
            className={cn(
              "grid gap-2",
              compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
            )}
          >
            {items.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "rounded-xl border p-3 text-left",
                  p.disponible
                    ? "border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900"
                    : "border-stone-100 bg-stone-50 opacity-50 dark:border-stone-800",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium leading-tight">{p.nombre}</span>
                  {!p.disponible && <Badge color="danger">Agotado</Badge>}
                </div>
                <p className="mt-2 text-sm font-semibold text-orange-700 dark:text-orange-400">
                  {formatCOP(p.precio)}
                </p>
                {showQty && p.disponible && (
                  <div className="mt-2 flex items-center gap-1">
                    <button
                      type="button"
                      className="rounded border p-1 dark:border-stone-600"
                      onClick={() =>
                        setQty((q) => ({ ...q, [p.id]: Math.max(0, getQty(p.id) - 1) }))
                      }
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-6 text-center text-sm font-medium">{getQty(p.id)}</span>
                    <button
                      type="button"
                      className="rounded border p-1 dark:border-stone-600"
                      onClick={() => setQty((q) => ({ ...q, [p.id]: getQty(p.id) + 1 }))}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <Button
                  size="sm"
                  className="mt-2 w-full"
                  disabled={!p.disponible || (showQty && getQty(p.id) <= 0)}
                  onClick={() => (showQty ? add(p) : onSelect(p, 1))}
                >
                  Agregar
                </Button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
