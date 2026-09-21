import { describe, expect, it } from "vitest";
import { emptyConteo, resumenConteo, totalConteo } from "./caja-denominaciones";

describe("caja-denominaciones", () => {
  it("emptyConteo inicia en cero", () => {
    const c = emptyConteo();
    expect(c["50000"]).toBe(0);
    expect(c["100"]).toBe(0);
    expect(totalConteo(c)).toBe(0);
  });

  it("suma billetes y monedas", () => {
    expect(
      totalConteo({
        "50000": 2,
        "2000": 1,
        "500": 3,
        "100": -5,
      }),
    ).toBe(100_000 + 2_000 + 1_500);
  });

  it("resume solo denominaciones con cantidad", () => {
    expect(resumenConteo({ "10000": 1, "500": 2 })).toBe("1×$10.000 · 2×$500");
    expect(resumenConteo({})).toBe("Sin efectivo");
  });
});
