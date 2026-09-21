import { afterEach, describe, expect, it } from "vitest";
import {
  getPublicOrigin,
  isUuid,
  qrAbsoluteUrl,
  qrPath,
  sanitizePublicOrigin,
} from "./public-url";

describe("isUuid", () => {
  it("acepta UUID v4 válido", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("rechaza ids inválidos", () => {
    expect(isUuid("no-uuid")).toBe(false);
    expect(isUuid("../etc/passwd")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});

describe("sanitizePublicOrigin", () => {
  it("acepta https y localhost http", () => {
    expect(sanitizePublicOrigin("https://app.example.com")).toBe("https://app.example.com");
    expect(sanitizePublicOrigin("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("rechaza http no local, credenciales y basura", () => {
    expect(sanitizePublicOrigin("http://evil.com")).toBeNull();
    expect(sanitizePublicOrigin("https://user:pass@evil.com")).toBeNull();
    expect(sanitizePublicOrigin("ftp://files.com")).toBeNull();
    expect(sanitizePublicOrigin("https://x.com/<script>")).toBeNull();
    expect(sanitizePublicOrigin(null)).toBeNull();
  });

  it("agrega https si falta protocolo", () => {
    expect(sanitizePublicOrigin("app.example.com")).toBe("https://app.example.com");
  });
});

describe("qrPath / qrAbsoluteUrl", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";

  it("arma path solo con UUID", () => {
    expect(qrPath(id)).toBe(`/qr/${id}`);
    expect(qrPath("bad")).toBeNull();
  });

  it("arma URL absoluta con origen seguro", () => {
    expect(qrAbsoluteUrl(id, "https://dulce.example")).toBe(
      `https://dulce.example/qr/${id}`,
    );
    expect(qrAbsoluteUrl(id, "http://evil.com")).toBeNull();
  });
});

describe("getPublicOrigin", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_PROD_ORIGIN;
  });

  it("prioriza NEXT_PUBLIC_SITE_URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://site.example";
    process.env.NEXT_PUBLIC_VERCEL_PROD_ORIGIN = "https://vercel.example";
    expect(getPublicOrigin()).toBe("https://site.example");
  });
});
