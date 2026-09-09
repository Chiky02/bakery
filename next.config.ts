import type { NextConfig } from "next";

/** Dominio de producción de Vercel (estable). No usar VERCEL_URL. */
function vercelProductionOrigin() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (!host) return "";
  try {
    const url = new URL(host.includes("://") ? host : `https://${host}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    if (url.username || url.password) return "";
    return url.origin;
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VERCEL_PROD_ORIGIN: vercelProductionOrigin(),
  },
};

export default nextConfig;
