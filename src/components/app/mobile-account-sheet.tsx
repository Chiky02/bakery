"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { formatCOP } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function MobileAccountSheet({
  title,
  total,
  count,
  actionLabel = "Ver cuenta",
  open: openProp,
  onOpenChange,
  children,
}: {
  title: string;
  total: number;
  count: number;
  actionLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = openProp ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <div className="h-[4.75rem]" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-3 pt-2 shadow-[0_-8px_30px_rgba(28,25,23,0.12)] backdrop-blur-sm pb-[max(0.65rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl bg-stone-900 px-3 py-2.5 text-left text-white"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-300">
              {title} · {count} {count === 1 ? "ítem" : "ítems"}
            </p>
            <p className="truncate text-lg font-bold tabular-nums">{formatCOP(total)}</p>
          </div>
          <span className="shrink-0 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white">
            {actionLabel}
          </span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-stone-900/45"
            aria-label="Cerrar cuenta"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-2xl bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-stone-100 px-4 py-3">
              <div>
                <h2 id={titleId} className="text-base font-semibold">
                  {title}
                </h2>
                <p className="text-sm font-bold tabular-nums text-orange-700">{formatCOP(total)}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
