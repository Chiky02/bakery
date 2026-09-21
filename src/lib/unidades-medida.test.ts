import { describe, expect, it } from "vitest";
import { resolveUnidades, UNIDADES_MEDIDA_DEFAULT } from "./unidades-medida";

describe("resolveUnidades", () => {
  it("usa defaults si no hay custom", () => {
    expect(resolveUnidades(null)).toEqual([...UNIDADES_MEDIDA_DEFAULT]);
    expect(resolveUnidades([])).toEqual([...UNIDADES_MEDIDA_DEFAULT]);
  });

  it("deduplica case-insensitive y recorta", () => {
    expect(resolveUnidades([" Kg ", "kg", "Bolsa"])).toEqual(["Kg", "Bolsa"]);
  });
});
