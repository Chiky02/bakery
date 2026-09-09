const TZ = "America/Bogota";

/** Formato COP estable (misma salida en Node y navegador; evita hydration #418). */
export function formatCOP(amount: number): string {
  const n = Math.round(Number(amount) || 0);
  const abs = Math.abs(n);
  const withDots = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}$${withDots}`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(date));
}

export function formatHour(date: string | Date): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(date));
}
