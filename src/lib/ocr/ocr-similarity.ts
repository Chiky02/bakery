/** Matches backend OCR auto-match threshold (product-match.ts). */
export const OCR_MATCH_THRESHOLD = 0.72;

export function ocrScorePercent(score: number): number {
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}

export function ocrScoreTextClass(score: number): string {
  if (score >= OCR_MATCH_THRESHOLD) return "text-emerald-700";
  if (score >= 0.5) return "text-amber-700";
  return "text-red-700";
}

export function ocrScoreBadgeClass(score: number): string {
  if (score >= OCR_MATCH_THRESHOLD) {
    return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  }
  if (score >= 0.5) {
    return "bg-amber-50 text-amber-800 ring-amber-200";
  }
  return "bg-red-50 text-red-800 ring-red-200";
}
