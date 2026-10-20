import { describe, expect, it } from "vitest";
import { comandasParaCocina, normalizeHubUrl, type HubComanda } from "./cocina-hub";

function row(partial: Partial<HubComanda> & Pick<HubComanda, "id">): HubComanda {
  return {
    panaderia_id: "p",
    mesa_id: "m",
    mesa_nombre: "Mesa 1",
    cuenta_id: "c",
    producto_id: "prod",
    nombre: "Bandeja",
    cantidad: 1,
    precio: 1000,
    estado: "pendiente",
    pasa_cocina: true,
    created_at: "2026-01-01T00:00:00.000Z",
    status: "pending",
    ...partial,
  };
}

describe("cocina hub", () => {
  it("acepta la dirección del equipo en la red local", () => {
    expect(normalizeHubUrl("http://192.168.1.50:8787/")).toBe("http://192.168.1.50:8787");
    expect(normalizeHubUrl("")).toBeNull();
    expect(normalizeHubUrl("no-es-url")).toBeNull();
  });

  it("con nube oculta lo ya sincronizado y sin nube muestra la cola local", () => {
    const list = [
      row({ id: "a" }),
      row({ id: "b", synced: true }),
      row({ id: "c", pasa_cocina: false }),
      row({ id: "d", estado: "listo" }),
    ];
    expect(comandasParaCocina(list, true).map((c) => c.id)).toEqual(["a"]);
    expect(comandasParaCocina(list, false).map((c) => c.id)).toEqual(["a", "b"]);
  });
});