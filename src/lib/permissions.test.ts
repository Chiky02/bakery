import { describe, expect, it } from "vitest";
import {
  canAccess,
  defaultPermisosForRole,
  navForRole,
  slugify,
} from "./permissions";

describe("defaultPermisosForRole", () => {
  it("da módulos de dueño/admin", () => {
    const p = defaultPermisosForRole("dueno");
    expect(p).toContain("dashboard");
    expect(p).toContain("usuarios");
    expect(p).toContain("negocios");
    expect(p).toContain("reportes");
  });

  it("cocina solo ve cocina + config + panaderías", () => {
    const p = defaultPermisosForRole("cocina");
    expect(p).toContain("cocina");
    expect(p).toContain("configuracion");
    expect(p).not.toContain("caja");
    expect(p).not.toContain("usuarios");
  });
});

describe("canAccess", () => {
  it("usa roles por defecto si no hay permisos custom", () => {
    expect(canAccess("mesero", "/mesas")).toBe(true);
    expect(canAccess("mesero", "/caja")).toBe(false);
    expect(canAccess("admin", "/reportes")).toBe(true);
  });

  it("prioriza href más específico (gestion vs mesas)", () => {
    expect(canAccess("mesero", "/mesas/gestion")).toBe(false);
    expect(canAccess("admin", "/mesas/gestion")).toBe(true);
  });

  it("respeta lista custom de permisos", () => {
    expect(canAccess("mostrador", "/caja", ["mostrador"])).toBe(false);
    expect(canAccess("mostrador", "/caja", ["caja", "mostrador"])).toBe(true);
  });

  it("dueno/admin pasan rutas desconocidas", () => {
    expect(canAccess("dueno", "/ruta-rara")).toBe(true);
    expect(canAccess("caja", "/ruta-rara")).toBe(false);
  });
});

describe("navForRole", () => {
  it("filtra por permisos custom", () => {
    const nav = navForRole("caja", ["caja", "dashboard"]);
    expect(nav.map((n) => n.key).sort()).toEqual(["caja", "dashboard"]);
  });

  it("filtra por rol si no hay custom", () => {
    const keys = navForRole("cocina").map((n) => n.key);
    expect(keys).toContain("cocina");
    expect(keys).not.toContain("mostrador");
  });
});

describe("slugify", () => {
  it("normaliza acentos y espacios", () => {
    expect(slugify("Panadería Síssa 02!")).toBe("panaderia-sissa-02");
  });

  it("recorta a 48 chars", () => {
    expect(slugify("a".repeat(60)).length).toBe(48);
  });
});
