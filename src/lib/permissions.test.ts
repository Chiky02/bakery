import { describe, expect, it } from "vitest";
import {
  canAccess,
  defaultPermisosForRole,
  navForRole,
  resolveSessionPermisos,
  slugify,
} from "./permissions";

describe("defaultPermisosForRole", () => {
  it("dueño opera su local pero no ve Negocios (plataforma)", () => {
    const p = defaultPermisosForRole("dueno");
    expect(p).toContain("dashboard");
    expect(p).toContain("usuarios");
    expect(p).toContain("reportes");
    expect(p).not.toContain("negocios");
  });

  it("gerente (admin tenant) tampoco tiene negocios", () => {
    expect(defaultPermisosForRole("admin")).not.toContain("negocios");
  });

  it("cocina ve cocina + producción (puede subir stock) + dashboard", () => {
    const p = defaultPermisosForRole("cocina");
    expect(p).toContain("dashboard");
    expect(p).toContain("cocina");
    expect(p).toContain("produccion");
    expect(p).toContain("produccion_crear");
    expect(p).toContain("produccion_recetas");
    expect(p).not.toContain("caja");
    expect(p).not.toContain("usuarios");
  });

  it("dueño ve producción y recetas, pero no registra tandas por defecto", () => {
    const p = defaultPermisosForRole("dueno");
    expect(p).toContain("produccion");
    expect(p).toContain("produccion_recetas");
    expect(p).not.toContain("produccion_crear");
  });

  it("mostrador, mesero y caja no tienen producción por defecto", () => {
    for (const rol of ["mostrador", "mesero", "caja"] as const) {
      const p = defaultPermisosForRole(rol);
      expect(p).not.toContain("produccion");
      expect(p).not.toContain("produccion_crear");
    }
  });
  it("dueño incluye subpermisos crear de clientes/productos", () => {
    const p = defaultPermisosForRole("dueno");
    expect(p).toContain("clientes");
    expect(p).toContain("clientes_crear");
    expect(p).toContain("productos_crear");
    expect(p).toContain("encargos_crear");
  });
});

describe("canAccess", () => {
  it("usa roles por defecto si no hay permisos custom", () => {
    expect(canAccess("mesero", "/mesas")).toBe(true);
    expect(canAccess("mesero", "/caja")).toBe(false);
    expect(canAccess("admin", "/reportes")).toBe(true);
  });

  it("negocios solo con plataformaAdmin", () => {
    expect(canAccess("dueno", "/negocios")).toBe(false);
    expect(canAccess("admin", "/negocios")).toBe(false);
    expect(canAccess("dueno", "/negocios", null, { plataformaAdmin: true })).toBe(true);
  });

  it("prioriza href más específico (gestion vs mesas)", () => {
    expect(canAccess("mesero", "/mesas/gestion")).toBe(false);
    expect(canAccess("admin", "/mesas/gestion")).toBe(true);
  });

  it("respeta lista custom de permisos", () => {
    expect(canAccess("mostrador", "/caja", ["mostrador"])).toBe(false);
    expect(canAccess("mostrador", "/caja", ["caja", "mostrador"])).toBe(true);
  });

  it("permite /clientes con solo clientes_crear", () => {
    expect(canAccess("mostrador", "/clientes", ["clientes_crear", "dashboard"])).toBe(true);
    expect(canAccess("mostrador", "/clientes", ["dashboard"])).toBe(false);
  });

  it("dueno/admin pasan rutas desconocidas", () => {
    expect(canAccess("dueno", "/ruta-rara")).toBe(true);
    expect(canAccess("caja", "/ruta-rara")).toBe(false);
  });
});

describe("resolveSessionPermisos", () => {
  it("inyecta negocios y terminos solo a admin de plataforma", () => {
    const base = resolveSessionPermisos("dueno", null, false);
    expect(base).not.toContain("negocios");
    expect(base).not.toContain("terminos");
    const admin = resolveSessionPermisos("dueno", null, true);
    expect(admin).toContain("negocios");
    expect(admin).toContain("terminos");
  });

  it("limpia negocios de permisos custom de tenant", () => {
    const p = resolveSessionPermisos("dueno", ["dashboard", "negocios"], false);
    expect(p).toEqual(["dashboard"]);
  });
  it("inyecta dashboard si el custom no lo trae", () => {
    const p = resolveSessionPermisos("mostrador", ["mostrador", "encargos"], false);
    expect(p[0]).toBe("dashboard");
    expect(p).toContain("mostrador");
  });
});

describe("navForRole", () => {
  it("filtra por permisos custom", () => {
    const nav = navForRole("caja", ["caja", "dashboard"]);
    expect(nav.map((n) => n.key).sort()).toEqual(["caja", "dashboard"]);
  });

  it("incluye negocios y terminos en nav solo con plataformaAdmin", () => {
    expect(navForRole("dueno").map((n) => n.key)).not.toContain("negocios");
    expect(navForRole("dueno").map((n) => n.key)).not.toContain("terminos");
    const keys = navForRole("dueno", null, { plataformaAdmin: true }).map((n) => n.key);
    expect(keys).toContain("negocios");
    expect(keys).toContain("terminos");
  });

  it("muestra Clientes en nav si solo tiene clientes_crear", () => {
    const keys = navForRole("mostrador", ["clientes_crear", "dashboard"]).map((n) => n.key);
    expect(keys).toContain("clientes");
    expect(keys).not.toContain("clientes_crear");
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
