"use client";

import { formatCOP } from "@/lib/format";
import {
  BILLETES_COP,
  MONEDAS_COP,
  totalConteo,
  type ConteoDenominaciones,
} from "@/lib/caja-denominaciones";
import { Input } from "@/components/ui/input";

function denomLabel(value: number) {
  return `$${value.toLocaleString("es-CO")}`;
}

function Row({
  value,
  qty,
  onChange,
}: {
  value: number;
  qty: number;
  onChange: (n: number) => void;
}) {
  const sub = value * qty;
  return (
    <div className="grid grid-cols-[1fr_5.5rem_auto] items-center gap-2 text-sm">
      <span className="font-medium">{denomLabel(value)}</span>
      <Input
        type="number"
        min={0}
        inputMode="numeric"
        className="h-9 text-center"
        value={qty === 0 ? "" : String(qty)}
        placeholder="0"
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
      />
      <span className="min-w-[5.5rem] text-right text-stone-500">{formatCOP(sub)}</span>
    </div>
  );
}

export function CashCounter({
  value,
  onChange,
  title = "Conteo de efectivo",
}: {
  value: ConteoDenominaciones;
  onChange: (next: ConteoDenominaciones) => void;
  title?: string;
}) {
  const total = totalConteo(value);

  function setQty(denom: number, qty: number) {
    onChange({ ...value, [String(denom)]: qty });
  }

  return (
    <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm font-bold text-orange-700">{formatCOP(total)}</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Billetes
        </p>
        <div className="space-y-1.5">
          {BILLETES_COP.map((d) => (
            <Row
              key={d}
              value={d}
              qty={Math.max(0, Math.floor(Number(value[String(d)]) || 0))}
              onChange={(n) => setQty(d, n)}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Monedas
        </p>
        <div className="space-y-1.5">
          {MONEDAS_COP.map((d) => (
            <Row
              key={`m-${d}`}
              value={d}
              qty={Math.max(0, Math.floor(Number(value[String(d)]) || 0))}
              onChange={(n) => setQty(d, n)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
