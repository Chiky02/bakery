import type { MedioPago } from "@/types";

export type PagoDesglose = {
  medio_pago: MedioPago;
  monto_efectivo: number;
  monto_electronico: number;
};

/** Normaliza y valida desglose de pago. Para mixto exige que sume el total. */
export function resolvePagoDesglose(
  medio: MedioPago,
  total: number,
  montoEfectivo?: number | null,
  montoElectronico?: number | null,
): { ok: true; value: PagoDesglose } | { ok: false; error: string } {
  const t = Math.max(0, Math.round(total));
  if (medio === "efectivo") {
    return {
      ok: true,
      value: { medio_pago: medio, monto_efectivo: t, monto_electronico: 0 },
    };
  }
  if (medio === "electronico") {
    return {
      ok: true,
      value: { medio_pago: medio, monto_efectivo: 0, monto_electronico: t },
    };
  }
  const e = Math.max(0, Math.round(Number(montoEfectivo) || 0));
  const el = Math.max(0, Math.round(Number(montoElectronico) || 0));
  if (e + el !== t) {
    return {
      ok: false,
      error: `En pago mixto, efectivo + electrónico debe sumar ${t.toLocaleString("es-CO")}`,
    };
  }
  if (e === 0 || el === 0) {
    return {
      ok: false,
      error: "En mixto indica montos en efectivo y electrónico (ambos > 0)",
    };
  }
  return {
    ok: true,
    value: { medio_pago: "mixto", monto_efectivo: e, monto_electronico: el },
  };
}

export function aporteEfectivo(row: {
  medio_pago?: string | null;
  total?: number | null;
  total_final?: number | null;
  monto_efectivo?: number | null;
  monto_electronico?: number | null;
}): number {
  const total = Number(row.total ?? row.total_final ?? 0) || 0;
  if (row.monto_efectivo != null || row.monto_electronico != null) {
    return Number(row.monto_efectivo) || 0;
  }
  if (row.medio_pago === "efectivo") return total;
  if (row.medio_pago === "mixto") return Math.round(total / 2);
  return 0;
}

export function aporteElectronico(row: {
  medio_pago?: string | null;
  total?: number | null;
  total_final?: number | null;
  monto_efectivo?: number | null;
  monto_electronico?: number | null;
}): number {
  const total = Number(row.total ?? row.total_final ?? 0) || 0;
  if (row.monto_efectivo != null || row.monto_electronico != null) {
    return Number(row.monto_electronico) || 0;
  }
  if (row.medio_pago === "electronico") return total;
  if (row.medio_pago === "mixto") return total - Math.round(total / 2);
  return 0;
}
