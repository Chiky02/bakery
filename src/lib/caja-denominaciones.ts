/** Denominaciones COP para conteo de caja. El billete de $1.000 ya no circula. */
export const BILLETES_COP = [100_000, 50_000, 20_000, 10_000, 5_000, 2_000] as const;
export const MONEDAS_COP = [1_000, 500, 200, 100] as const;

export type Denominacion = (typeof BILLETES_COP)[number] | (typeof MONEDAS_COP)[number];

export type ConteoDenominaciones = Partial<Record<string, number>>;

/** El billete de $1.000 y la moneda de $1.000 no comparten la misma casilla. */
export function conteoKey(kind: "billete" | "moneda", value: number) {
  return `${kind}:${value}`;
}

function valorDeClave(key: string): number {
  const raw = key.includes(":") ? key.slice(key.indexOf(":") + 1) : key;
  return Number(raw);
}

export function emptyConteo(): ConteoDenominaciones {
  const c: ConteoDenominaciones = {};
  for (const d of BILLETES_COP) c[conteoKey("billete", d)] = 0;
  for (const d of MONEDAS_COP) c[conteoKey("moneda", d)] = 0;
  return c;
}

export function totalConteo(conteo: ConteoDenominaciones): number {
  let total = 0;
  for (const [denom, qty] of Object.entries(conteo)) {
    const n = valorDeClave(denom);
    const q = Math.max(0, Math.floor(Number(qty) || 0));
    if (Number.isFinite(n) && q > 0) total += n * q;
  }
  return total;
}

export function resumenConteo(conteo: ConteoDenominaciones): string {
  const parts: string[] = [];
  for (const d of BILLETES_COP) {
    const q = Math.max(0, Math.floor(Number(conteo[conteoKey("billete", d)] ?? conteo[String(d)]) || 0));
    if (q > 0) parts.push(`${q}×${formatDenom(d)} billete`);
  }
  for (const d of MONEDAS_COP) {
    const q = Math.max(
      0,
      Math.floor(Number(conteo[conteoKey("moneda", d)] ?? conteo[String(d)]) || 0),
    );
    if (q > 0) parts.push(`${q}×${formatDenom(d)} moneda`);
  }
  return parts.join(" · ") || "Sin efectivo";
}

function formatDenom(d: number): string {
  const withDots = d.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$${withDots}`;
}
