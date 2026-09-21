import { describe, expect, it } from "vitest";
import type { SessionContext } from "@/types";
import { assertRoles } from "./api-context";

function fakeCtx(rol: SessionContext["rol"]): SessionContext {
  return {
    profile: { id: "u1", nombre: "Test", activo: true, panaderia_activa_id: "p1" },
    panaderia: {
      id: "p1",
      nombre: "Demo",
      slug: "demo",
      moneda: "COP",
      pedido_directo_habilitado: true,
      requiere_aprobacion_mesero: false,
      activa: true,
    },
    rol,
    roleLabel: rol,
    permisos: [],
    memberships: [],
  };
}

describe("assertRoles", () => {
  it("permite rol incluido", () => {
    expect(assertRoles(fakeCtx("caja"), ["dueno", "caja"])).toBeNull();
  });

  it("bloquea con 403 si no está", async () => {
    const res = assertRoles(fakeCtx("mesero"), ["dueno", "admin"]);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    const body = await res!.json();
    expect(body.error).toBe("Sin permiso");
  });
});
