import { describe, expect, it } from "vitest";
import { formatCOP, formatDate, formatHour } from "./format";

describe("formatCOP", () => {
  it("formatea con puntos de miles", () => {
    expect(formatCOP(1_250_000)).toBe("$1.250.000");
    expect(formatCOP(0)).toBe("$0");
    expect(formatCOP(-500)).toBe("-$500");
  });

  it("redondea", () => {
    expect(formatCOP(10.6)).toBe("$11");
  });
});

describe("formatDate / formatHour", () => {
  const iso = "2026-09-21T18:45:00.000Z"; // 13:45 Bogotá

  it("fecha en es-CO / Bogotá", () => {
    expect(formatDate(iso)).toMatch(/21\/09\/2026/);
  });

  it("hora 24h Bogotá", () => {
    expect(formatHour(iso)).toMatch(/13:45/);
  });
});
