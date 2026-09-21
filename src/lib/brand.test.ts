import { describe, expect, it } from "vitest";
import { bakeryDisplayName } from "./brand";

describe("bakeryDisplayName", () => {
  it("prioriza nombre público", () => {
    expect(
      bakeryDisplayName({ nombre: "Interno SA", nombre_publico: "Dulce Bonanza" }),
    ).toBe("Dulce Bonanza");
  });

  it("cae a nombre interno o fallback", () => {
    expect(bakeryDisplayName({ nombre: "Local 1", nombre_publico: "  " })).toBe("Local 1");
    expect(bakeryDisplayName(null)).toBe("Panadería");
    expect(bakeryDisplayName(undefined, "Mi Bakery")).toBe("Mi Bakery");
  });
});
