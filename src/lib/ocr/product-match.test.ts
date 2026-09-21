import { describe, expect, it } from "vitest";
import {
  MATCH_THRESHOLD,
  matchProducts,
  normalizeSearchText,
  scoreProductName,
} from "./product-match";
import { ocrScorePercent, ocrScoreTextClass } from "./ocr-similarity";

const catalog = [
  { pk_product: "1", name: "Pan francés", unit_price: 1500 },
  { pk_product: "2", name: "Croissant de almendra", unit_price: 3500 },
  { pk_product: "3", name: "Café americano", unit_price: 2500 },
];

describe("normalizeSearchText", () => {
  it("quita acentos y puntuación", () => {
    expect(normalizeSearchText("Café — Almendra!")).toBe("cafe almendra");
  });
});

describe("scoreProductName / matchProducts", () => {
  it("match exacto = 1", () => {
    expect(scoreProductName("Pan francés", "Pan francés")).toBe(1);
  });

  it("elige best cuando el score supera el umbral", () => {
    const { best, candidates } = matchProducts("Croissant de almendra", catalog);
    expect(best?.fk_product).toBe("2");
    expect(best!.score).toBeGreaterThanOrEqual(MATCH_THRESHOLD);
    expect(candidates[0]?.fk_product).toBe("2");
  });

  it("lista candidatos parciales sin forzar best bajo umbral", () => {
    const { best, candidates } = matchProducts("croissant", catalog);
    expect(candidates.some((c) => c.fk_product === "2")).toBe(true);
    if (candidates[0] && candidates[0].score < MATCH_THRESHOLD) {
      expect(best).toBeNull();
    }
  });

  it("sin match claro no propone best", () => {
    const { best, candidates } = matchProducts("xyz desconocido", catalog);
    expect(best).toBeNull();
    expect(candidates).toEqual([]);
  });
});

describe("ocr similarity helpers", () => {
  it("porcentaje y clase por umbral", () => {
    expect(ocrScorePercent(0.856)).toBe(86);
    expect(ocrScoreTextClass(0.9)).toContain("emerald");
    expect(ocrScoreTextClass(0.6)).toContain("amber");
    expect(ocrScoreTextClass(0.2)).toContain("red");
  });
});
