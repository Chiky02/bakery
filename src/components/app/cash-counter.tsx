"use client";

import { formatCOP } from "@/lib/format";
import {
  BILLETES_COP,
  MONEDAS_COP,
  totalConteo,
  type ConteoDenominaciones,
} from "@/lib/caja-denominaciones";
import { Input } from "@/components/ui/input";

function denomShort(value: number) {
  if (value >= 1000) {
    const k = value / 1000;
    return `$${Number.isInteger(k) ? k : String(k).replace(".", ",")} mil`;
  }
  return `$${value}`;
}

function Cell({
  id,
  value,
  qty,
  onChange,
}: {
  id: string;
  value: number;
  qty: number;
  onChange: (n: number) => void;
}) {
  const name = `cash-${id}-${value}`;
  return (
    <label
      htmlFor={name}
      className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1.5 ring-1 ring-stone-200"
    >
      <span className="w-[4.25rem] shrink-0 text-xs font-semibold tabular-nums text-stone-700">
        {denomShort(value)}
      </span>
      <Input
        id={name}
        name={name}
        type="number"
        min={0}
        inputMode="numeric"
        autoComplete="off"
        className="h-8 w-14 shrink-0 px-1.5 text-center text-sm tabular-nums"
        value={qty === 0 ? "" : String(qty)}
        placeholder="0"
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
      />
      {qty > 0 ? (
        <span className="min-w-0 flex-1 truncate text-[10px] text-stone-400">
          {formatCOP(value * qty)}
        </span>
      ) : (
        <span className="min-w-0 flex-1" />
      )}
    </label>
  );
}

export function CashCounter({
  value,
  onChange,
  title = "Conteo de efectivo",
  idPrefix = "caja",
}: {
  value: ConteoDenominaciones;
  onChange: (next: ConteoDenominaciones) => void;
  title?: string;
  idPrefix?: string;
}) {
  const total = totalConteo(value);

  function setQty(denom: number, qty: number) {
    onChange({ ...value, [String(denom)]: qty });
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-stone-200 bg-stone-50/90 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-base font-bold tabular-nums text-orange-700">{formatCOP(total)}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <fieldset className="min-w-0 space-y-1.5">
          <legend className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            Billetes
          </legend>
          <div className="grid grid-cols-2 gap-1.5">
            {BILLETES_COP.map((d) => (
              <Cell
                key={d}
                id={`${idPrefix}-b`}
                value={d}
                qty={Math.max(0, Math.floor(Number(value[String(d)]) || 0))}
                onChange={(n) => setQty(d, n)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="min-w-0 space-y-1.5">
          <legend className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            Monedas
          </legend>
          <div className="grid grid-cols-2 gap-1.5">
            {MONEDAS_COP.map((d) => (
              <Cell
                key={`m-${d}`}
                id={`${idPrefix}-m`}
                value={d}
                qty={Math.max(0, Math.floor(Number(value[String(d)]) || 0))}
                onChange={(n) => setQty(d, n)}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
