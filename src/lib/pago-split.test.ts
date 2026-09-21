import { describe, expect, it } from "vitest";
import { aporteEfectivo, aporteElectronico, resolvePagoDesglose } from "./pago-split";

describe("resolvePagoDesglose", () => {
  it("asigna todo a efectivo", () => {
    expect(resolvePagoDesglose("efectivo", 15_500.4)).toEqual({
      ok: true,
      value: { medio_pago: "efectivo", monto_efectivo: 15_500, monto_electronico: 0 },
    });
  });

  it("asigna todo a electrónico", () => {
    expect(resolvePagoDesglose("electronico", 8_000)).toEqual({
      ok: true,
      value: { medio_pago: "electronico", monto_efectivo: 0, monto_electronico: 8_000 },
    });
  });

  it("acepta mixto que suma el total", () => {
    expect(resolvePagoDesglose("mixto", 10_000, 4_000, 6_000)).toEqual({
      ok: true,
      value: { medio_pago: "mixto", monto_efectivo: 4_000, monto_electronico: 6_000 },
    });
  });

  it("rechaza mixto que no suma", () => {
    const r = resolvePagoDesglose("mixto", 10_000, 3_000, 3_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/debe sumar/);
  });

  it("rechaza mixto con un lado en cero", () => {
    const r = resolvePagoDesglose("mixto", 10_000, 10_000, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/ambos > 0/);
  });

  it("no permite total negativo", () => {
    expect(resolvePagoDesglose("efectivo", -100)).toEqual({
      ok: true,
      value: { medio_pago: "efectivo", monto_efectivo: 0, monto_electronico: 0 },
    });
  });
});

describe("aporteEfectivo / aporteElectronico", () => {
  it("usa montos explícitos cuando existen", () => {
    const row = {
      medio_pago: "mixto",
      total: 10_000,
      monto_efectivo: 7_000,
      monto_electronico: 3_000,
    };
    expect(aporteEfectivo(row)).toBe(7_000);
    expect(aporteElectronico(row)).toBe(3_000);
  });

  it("infiere por medio cuando no hay montos", () => {
    expect(aporteEfectivo({ medio_pago: "efectivo", total: 5_000 })).toBe(5_000);
    expect(aporteElectronico({ medio_pago: "efectivo", total: 5_000 })).toBe(0);
    expect(aporteEfectivo({ medio_pago: "electronico", total: 5_000 })).toBe(0);
    expect(aporteElectronico({ medio_pago: "electronico", total: 5_000 })).toBe(5_000);
  });

  it("reparte mixto legacy a la mitad", () => {
    expect(aporteEfectivo({ medio_pago: "mixto", total: 10_001 })).toBe(5_001);
    expect(aporteElectronico({ medio_pago: "mixto", total: 10_001 })).toBe(5_000);
  });

  it("usa total_final como fallback", () => {
    expect(aporteEfectivo({ medio_pago: "efectivo", total_final: 2_500 })).toBe(2_500);
  });
});
