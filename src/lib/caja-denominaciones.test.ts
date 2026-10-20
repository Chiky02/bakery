import { describe, expect, it } from "vitest";
import { emptyConteo, resumenConteo, totalConteo } from "./caja-denominaciones";

describe("caja-denominaciones", () => {
  it("emptyConteo inicia en cero", () => {
    const c = emptyConteo();
    expect(c["billete:50000"]).toBe(0);
    expect(c["moneda:100"]).toBe(0);
    expect(c["billete:1000"]).toBeUndefined();
    expect(c["moneda:1000"]).toBe(0);
    expect(totalConteo(c)).toBe(0);
  });

  it("suma billetes y monedas", () => {
    expect(
      totalConteo({
        "billete:50000": 2,
        "billete:2000": 1,
        "moneda:500": 3,
        "moneda:100": -5,
      }),
    ).toBe(100_000 + 2_000 + 1_500);
  });

  it("la moneda de 1000 entra en el conteo y el billete no se ofrece", () => {
    const c = emptyConteo();
    expect(c["billete:1000"]).toBeUndefined();
    expect(
      totalConteo({
        "moneda:1000": 3,
      }),
    ).toBe(3_000);
  });

  it("resume solo denominaciones con cantidad", () => {
    expect(resumenConteo({ "billete:10000": 1, "moneda:500": 2 })).toBe(
      "1×$10.000 billete · 2×$500 moneda",
    );
    expect(resumenConteo({})).toBe("Sin efectivo");
  });
});
