/** Zona horaria operativa Colombia. */
export const TZ_BOGOTA = "America/Bogota";

export function bogotaParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ_BOGOTA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Inicio del día en Bogotá como ISO UTC. */
export function startOfBogotaDay(date = new Date()): string {
  const { year, month, day } = bogotaParts(date);
  // Bogotá is UTC-5 year-round
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0)).toISOString();
}

export function endOfBogotaDay(date = new Date()): string {
  const { year, month, day } = bogotaParts(date);
  return new Date(Date.UTC(year, month - 1, day + 1, 4, 59, 59, 999)).toISOString();
}

export function startOfBogotaMonth(date = new Date()): string {
  const { year, month } = bogotaParts(date);
  return new Date(Date.UTC(year, month - 1, 1, 5, 0, 0)).toISOString();
}

export function startOfPrevBogotaMonth(date = new Date()): string {
  const { year, month } = bogotaParts(date);
  return new Date(Date.UTC(year, month - 2, 1, 5, 0, 0)).toISOString();
}

export function endOfPrevBogotaMonth(date = new Date()): string {
  const { year, month } = bogotaParts(date);
  return new Date(Date.UTC(year, month - 1, 1, 4, 59, 59, 999)).toISOString();
}

export function parseBogotaDateInput(yyyyMmDd: string, endOfDay = false): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  if (endOfDay) {
    return new Date(Date.UTC(y, m - 1, d + 1, 4, 59, 59, 999)).toISOString();
  }
  return new Date(Date.UTC(y, m - 1, d, 5, 0, 0)).toISOString();
}

export function bogotaTodayInput(): string {
  const { year, month, day } = bogotaParts();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
