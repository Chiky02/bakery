/** UUID v1–v8. Rechaza cualquier mesaId que no sea id de la base. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Origen público para QR/impresos.
 * Solo http(s) sin credenciales ni path. En producción exige https.
 */
export function sanitizePublicOrigin(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("@") || /[\s<>\\]/.test(trimmed)) return null;

  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (url.username || url.password) return null;
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;

    const host = url.hostname.toLowerCase();
    const local = host === "localhost" || host === "127.0.0.1";
    if (!local && url.protocol !== "https:") return null;

    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Dominio estable (impresos/QR). Nunca uses VERCEL_URL: cambia en cada deploy.
 * Prioridad: NEXT_PUBLIC_SITE_URL → dominio de producción de Vercel → origen actual.
 */
export function getPublicOrigin(): string {
  const fromSite = sanitizePublicOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (fromSite) return fromSite;

  const fromVercel = sanitizePublicOrigin(process.env.NEXT_PUBLIC_VERCEL_PROD_ORIGIN);
  if (fromVercel) return fromVercel;

  if (typeof window !== "undefined") {
    return sanitizePublicOrigin(window.location.origin) ?? "";
  }
  return "";
}

export function qrPath(mesaId: string): string | null {
  if (!isUuid(mesaId)) return null;
  return `/qr/${mesaId}`;
}

export function qrAbsoluteUrl(mesaId: string, origin = getPublicOrigin()): string | null {
  const path = qrPath(mesaId);
  const safeOrigin = sanitizePublicOrigin(origin);
  if (!path || !safeOrigin) return null;
  return `${safeOrigin}${path}`;
}
