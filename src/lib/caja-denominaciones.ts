/** Denominaciones COP para conteo de caja (billetes y monedas). */
export const BILLETES_COP = [100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000] as const;
export const MONEDAS_COP = [1_000, 500, 200, 100] as const;

export type Denominacion = (typeof BILLETES_COP)[number] | (typeof MONEDAS_COP)[number];

export type ConteoDenominaciones = Partial<Record<string, number>>;

export function emptyConteo(): ConteoDenominaciones {
  const c: ConteoDenominaciones = {};
  for (const d of BILLETES_COP) c[String(d)] = 0;
  for (const d of MONEDAS_COP) c[String(d)] = 0;
  return c;
}

export function totalConteo(conteo: ConteoDenominaciones): number {
  let total = 0;
  for (const [denom, qty] of Object.entries(conteo)) {
    const n = Number(denom);
    const q = Math.max(0, Math.floor(Number(qty) || 0));
    if (Number.isFinite(n) && q > 0) total += n * q;
  }
  return total;
}

export function resumenConteo(conteo: ConteoDenominaciones): string {
  const parts: string[] = [];
  for (const d of [...BILLETES_COP, ...MONEDAS_COP]) {
    const q = Math.max(0, Math.floor(Number(conteo[String(d)]) || 0));
    if (q > 0) parts.push(`${q}×${formatDenom(d)}`);
  }
  return parts.join(" · ") || "Sin efectivo";
}

function formatDenom(d: number): string {
  const withDots = d.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$${withDots}`;
}
