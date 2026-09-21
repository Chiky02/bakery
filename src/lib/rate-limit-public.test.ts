import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertPublicRateLimit,
  clientIp,
  rateLimitExceededResponse,
  tooLargeBody,
} from "./rate-limit-public";

describe("clientIp", () => {
  it("prioriza cf-connecting-ip > x-real-ip > x-forwarded-for", () => {
    const req = new Request("https://x.com", {
      headers: {
        "cf-connecting-ip": "1.1.1.1",
        "x-real-ip": "2.2.2.2",
        "x-forwarded-for": "3.3.3.3, 4.4.4.4",
      },
    });
    expect(clientIp(req)).toBe("1.1.1.1");
  });

  it("toma el primer forwarded y trunca", () => {
    const long = "9".repeat(100);
    const req = new Request("https://x.com", {
      headers: { "x-forwarded-for": `${long}, 8.8.8.8` },
    });
    expect(clientIp(req).length).toBe(64);
  });

  it("unknown si no hay headers", () => {
    expect(clientIp(new Request("https://x.com"))).toBe("unknown");
  });
});

describe("tooLargeBody", () => {
  it("detecta content-length excesivo", () => {
    const big = new Request("https://x.com", {
      method: "POST",
      headers: { "content-length": "5000" },
    });
    expect(tooLargeBody(big, 1000)).toBe(true);
    expect(tooLargeBody(big, 10_000)).toBe(false);
  });

  it("permite si no hay length", () => {
    expect(tooLargeBody(new Request("https://x.com", { method: "POST" }), 10)).toBe(false);
  });
});

describe("rateLimitExceededResponse", () => {
  it("responde 429 con Retry-After", async () => {
    const res = rateLimitExceededResponse(30);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
    const body = await res.json();
    expect(body.error).toMatch(/Demasiadas/);
  });
});

describe("assertPublicRateLimit", () => {
  it("bloquea cuando RPC devuelve false", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    const supabase = { rpc } as unknown as SupabaseClient;
    const res = await assertPublicRateLimit(supabase, [
      { key: "ip:1", max: 5, windowSec: 60 },
    ]);
    expect(res?.status).toBe(429);
  });

  it("permite cuando RPC acepta", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const supabase = { rpc } as unknown as SupabaseClient;
    const res = await assertPublicRateLimit(supabase, [
      { key: `ok-${Date.now()}`, max: 5, windowSec: 60 },
    ]);
    expect(res).toBeNull();
  });

  it("cae a memoria si RPC falla y bloquea al superar max", async () => {
    const key = `mem-${Date.now()}-${Math.random()}`;
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "missing" } });
    const supabase = { rpc } as unknown as SupabaseClient;

    expect(await assertPublicRateLimit(supabase, [{ key, max: 2, windowSec: 60 }])).toBeNull();
    expect(await assertPublicRateLimit(supabase, [{ key, max: 2, windowSec: 60 }])).toBeNull();
    const blocked = await assertPublicRateLimit(supabase, [{ key, max: 2, windowSec: 60 }]);
    expect(blocked?.status).toBe(429);
  });
});
