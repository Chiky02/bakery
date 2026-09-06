"use client";

import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Producto } from "@/types";
import { Badge } from "@/components/ui/badge";

export function ProductGrid({
  productos,
  onSelect,
  compact = false,
}: {
  productos: Producto[];
  onSelect: (p: Producto) => void;
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
                onClick={() => onSelect(p)}
                disabled={!p.disponible}
                className={cn(
                  "rounded-xl border p-3 text-left transition-all hover:border-amber-400 hover:shadow-md",
                  p.disponible
                    ? "border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900"
                    : "cursor-not-allowed border-stone-100 bg-stone-50 opacity-50 dark:border-stone-800",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium leading-tight">{p.nombre}</span>
                  {!p.disponible && <Badge color="danger">Agotado</Badge>}
                </div>
                <p className="mt-2 text-sm font-semibold text-amber-700">{formatCOP(p.precio)}</p>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
