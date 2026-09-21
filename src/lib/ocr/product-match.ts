export type CatalogProduct = {
  pk_product: string;
  name: string;
  unit_price: number;
};

export type ProductMatchCandidate = {
  fk_product: string;
  name: string;
  unit_price: number;
  score: number;
};

const MATCH_THRESHOLD = 0.72;

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeSearchText(value).split(" ").filter((token) => token.length > 1));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function includesScore(query: string, candidate: string): number {
  if (!query || !candidate) return 0;
  if (query === candidate) return 1;
  if (candidate.includes(query) || query.includes(candidate)) {
    const shorter = Math.min(query.length, candidate.length);
    const longer = Math.max(query.length, candidate.length);
    return Math.min(0.95, shorter / longer + 0.15);
  }
  return 0;
}

export function scoreProductName(rawName: string, productName: string): number {
  const query = normalizeSearchText(rawName);
  const candidate = normalizeSearchText(productName);
  if (!query || !candidate) return 0;

  const exact = query === candidate ? 1 : 0;
  const includes = includesScore(query, candidate);
  const tokens = jaccard(tokenSet(query), tokenSet(candidate));
  return Math.max(exact, includes, tokens * 0.95);
}

export function matchProducts(
  rawName: string,
  catalog: CatalogProduct[],
  limit = 3,
): { best: ProductMatchCandidate | null; candidates: ProductMatchCandidate[] } {
  const ranked = catalog
    .map((product) => ({
      fk_product: product.pk_product,
      name: product.name,
      unit_price: product.unit_price,
      score: scoreProductName(rawName, product.name),
    }))
    .filter((row) => row.score > 0.35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const best = ranked[0] && ranked[0].score >= MATCH_THRESHOLD ? ranked[0] : null;
  return { best, candidates: ranked };
}

export { MATCH_THRESHOLD };
