"use client";

import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Producto } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

/**
 * Catálogo POS: un toque = +1 (estándar en mostrador/mesero).
 * La cantidad se ajusta en la cuenta, no en la tarjeta.
 */
export function ProductGrid({
  productos,
  onSelect,
  compact = false,
}: {
  productos: Producto[];
  onSelect: (p: Producto, cantidad: number) => void;
  compact?: boolean;
}) {
  const byCategory = productos.reduce<Record<string, Producto[]>>((acc, p) => {
    const cat = p.categorias?.nombre ?? "Sin categoría";
    (acc[cat] ??= []).push(p);
    return acc;
  }, {});

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
              <button
                key={p.id}
                type="button"
                disabled={!p.disponible}
                onClick={() => onSelect(p, 1)}
                className={cn(
                  "rounded-xl border p-3 text-left transition active:scale-[0.98]",
                  p.disponible
                    ? "border-stone-200 bg-white hover:border-orange-300 hover:bg-orange-50/60"
                    : "cursor-not-allowed border-stone-100 bg-stone-50 opacity-50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium leading-tight">{p.nombre}</span>
                  {!p.disponible ? (
                    <Badge color="danger">Agotado</Badge>
                  ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm font-semibold text-orange-700">{formatCOP(p.precio)}</p>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
