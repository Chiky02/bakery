import { describe, expect, it } from "vitest";
import { buildCategoriaMap, expandVentasDetalle } from "./reportes-detalle";

describe("expandVentasDetalle", () => {
  it("expande mostrador y mesas con categoría y cantidad", () => {
    const catMap = buildCategoriaMap([
      { id: "p1", categorias: { nombre: "Panadería" } },
      { id: "p2", categorias: { nombre: "Bebidas" } },
    ]);

    const { lineas, porProducto, porCategoria } = expandVentasDetalle({
      ventas: [
        {
          id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          fecha_hora: "2026-09-21T15:00:00.000Z",
          detalle: [
            {
              producto_id: "p1",
              nombre: "Pan francés",
              cantidad: 3,
              precio: 1500,
              subtotal: 4500,
            },
          ],
        },
      ],
      mesas: [
        {
          hora_cierre: "2026-09-21T16:00:00.000Z",
          mesas: { nombre: "Mesa 1" },
          items_cuenta: [
            {
              producto_id: "p2",
              cantidad: 2,
              precio_al_momento: 2500,
              estado: "entregado",
              productos: { nombre: "Café", categorias: { nombre: "Bebidas" } },
            },
            {
              cantidad: 1,
              precio_al_momento: 1000,
              estado: "cancelado",
              productos: { nombre: "Ignorado" },
            },
          ],
        },
      ],
      catMap,
    });

    expect(lineas).toHaveLength(2);
    expect(lineas.find((l) => l.producto === "Pan francés")).toMatchObject({
      categoria: "Panadería",
      cantidad: 3,
      canal: "mostrador",
    });
    expect(lineas.find((l) => l.producto === "Café")).toMatchObject({
      categoria: "Bebidas",
      cantidad: 2,
      canal: "mesa",
    });

    expect(porProducto).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ producto: "Pan francés", cantidad: 3, categoria: "Panadería" }),
        expect.objectContaining({ producto: "Café", cantidad: 2, categoria: "Bebidas" }),
      ]),
    );
    expect(porCategoria.map((c) => c.categoria).sort()).toEqual(["Bebidas", "Panadería"]);
  });
});
