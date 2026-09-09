/** Unidades de medida por defecto (recepciones / insumos). */
export const UNIDADES_MEDIDA_DEFAULT = [
  "unidad",
  "kg",
  "g",
  "litro",
  "ml",
  "libra",
  "paquete",
  "caja",
  "docena",
] as const;

export function resolveUnidades(custom?: string[] | null): string[] {
  const list = (custom ?? []).map((u) => u.trim()).filter(Boolean);
  if (list.length === 0) return [...UNIDADES_MEDIDA_DEFAULT];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of list) {
    const key = u.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
  }
  return out;
}
