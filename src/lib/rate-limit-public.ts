import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Fallback en memoria (una sola instancia serverless). */
const memoryHits = new Map<string, { n: number; t: number }>();

function memoryAllow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const cur = memoryHits.get(key);
  if (!cur || now - cur.t > windowMs) {
    memoryHits.set(key, { n: 1, t: now });
    return true;
  }
  if (cur.n >= max) return false;
  cur.n += 1;
  return true;
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  const ip = cf || real || fwd || "unknown";
  // Normaliza IPv6 mapped / evita keys enormes
  return ip.slice(0, 64);
}

export function tooLargeBody(request: Request, maxBytes: number): boolean {
  const len = request.headers.get("content-length");
  if (!len) return false;
  const n = Number(len);
  return Number.isFinite(n) && n > maxBytes;
}

export function rateLimitExceededResponse(retryAfterSec = 60) {
  return NextResponse.json(
    { error: "Demasiadas solicitudes. Espera un momento e intenta de nuevo." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "Cache-Control": "no-store",
      },
    },
  );
}

type Bucket = { key: string; max: number; windowSec: number };

/**
 * Rate limit multi-bucket. Usa RPC en Supabase (compartido entre instancias);
 * si falla la migración, cae a memoria local.
 */
export async function assertPublicRateLimit(
  supabase: SupabaseClient,
  buckets: Bucket[],
): Promise<NextResponse | null> {
  for (const b of buckets) {
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_key: b.key,
      p_max: b.max,
      p_window_seconds: b.windowSec,
    });

    if (error) {
      if (!memoryAllow(b.key, b.max, b.windowSec * 1000)) {
        return rateLimitExceededResponse(b.windowSec);
      }
      continue;
    }

    if (data === false) {
      return rateLimitExceededResponse(b.windowSec);
    }
  }
  return null;
}

export function getPublicServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
