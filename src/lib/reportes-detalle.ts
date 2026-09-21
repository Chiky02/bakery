/** Líneas de venta expandidas (mostrador + mesas) para reportes. */

export type VentaLineaDetalle = {
  fecha_hora: string;
  canal: "mostrador" | "mesa";
  referencia: string;
  producto: string;
  categoria: string;
  cantidad: number;
  precio_unit: number;
  subtotal: number;
};

export type ProductoAgregado = {
  key: string;
  producto: string;
  categoria: string;
  cantidad: number;
  subtotal: number;
};

export type CategoriaAgregada = {
  categoria: string;
  cantidad: number;
  subtotal: number;
};

type CatMap = Map<string, string>;

export function buildCategoriaMap(
  productos: Array<{
    id: string;
    categorias?: { nombre?: string } | { nombre?: string }[] | null;
  }>,
): CatMap {
  const map = new Map<string, string>();
  for (const p of productos) {
    const cat = Array.isArray(p.categorias) ? p.categorias[0] : p.categorias;
    map.set(p.id, cat?.nombre?.trim() || "Sin categoría");
  }
  return map;
}

function catFromEmbed(
  productos:
    | { nombre?: string; categorias?: { nombre?: string } | { nombre?: string }[] | null }
    | null
    | undefined,
  fallbackId: string | null | undefined,
  catMap: CatMap,
): { nombre: string; categoria: string } {
  const nombre = productos?.nombre?.trim() || "Producto";
  const embed = Array.isArray(productos?.categorias)
    ? productos?.categorias[0]
    : productos?.categorias;
  const categoria =
    embed?.nombre?.trim() ||
    (fallbackId ? catMap.get(fallbackId) : undefined) ||
    "Sin categoría";
  return { nombre, categoria };
}

export function expandVentasDetalle(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ventas: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mesas: any[];
  catMap: CatMap;
}): {
  lineas: VentaLineaDetalle[];
  porProducto: ProductoAgregado[];
  porCategoria: CategoriaAgregada[];
} {
  const lineas: VentaLineaDetalle[] = [];

  for (const v of opts.ventas) {
    const items = (v.detalle ?? []) as Array<{
      producto_id?: string;
      nombre?: string;
      cantidad?: number;
      precio?: number;
      subtotal?: number;
    }>;
    const fecha = v.fecha_hora ?? "";
    const ref = `Mostrador · ${(v.id as string)?.slice(0, 8) ?? ""}`;
    for (const i of items) {
      const qty = Number(i.cantidad) || 0;
      if (qty <= 0) continue;
      const precio = Number(i.precio) || 0;
      const sub = Number(i.subtotal) || Math.round(precio * qty);
      const cat =
        (i.producto_id && opts.catMap.get(i.producto_id)) || "Sin categoría";
      lineas.push({
        fecha_hora: fecha,
        canal: "mostrador",
        referencia: ref,
        producto: i.nombre?.trim() || "Producto",
        categoria: cat,
        cantidad: qty,
        precio_unit: precio,
        subtotal: sub,
      });
    }
  }

  for (const c of opts.mesas) {
    const mesa = c.mesas as { nombre?: string } | null;
    const fecha = c.hora_cierre ?? "";
    const ref = `Mesa · ${mesa?.nombre ?? "sin nombre"}`;
    const items = (c.items_cuenta ?? []) as Array<{
      cantidad?: number;
      precio_al_momento?: number;
      estado?: string;
      producto_id?: string;
      productos?: {
        nombre?: string;
        categorias?: { nombre?: string } | { nombre?: string }[] | null;
      } | null;
    }>;
    for (const i of items) {
      if (i.estado === "cancelado") continue;
      const qty = Number(i.cantidad) || 0;
      if (qty <= 0) continue;
      const precio = Number(i.precio_al_momento) || 0;
      const { nombre, categoria } = catFromEmbed(
        i.productos,
        i.producto_id,
        opts.catMap,
      );
      lineas.push({
        fecha_hora: fecha,
        canal: "mesa",
        referencia: ref,
        producto: nombre,
        categoria,
        cantidad: qty,
        precio_unit: precio,
        subtotal: Math.round(precio * qty),
      });
    }
  }

  lineas.sort((a, b) => (a.fecha_hora < b.fecha_hora ? 1 : -1));

  const byProd = new Map<string, ProductoAgregado>();
  for (const l of lineas) {
    const key = `${l.categoria}::${l.producto}`;
    const cur = byProd.get(key) ?? {
      key,
      producto: l.producto,
      categoria: l.categoria,
      cantidad: 0,
      subtotal: 0,
    };
    cur.cantidad += l.cantidad;
    cur.subtotal += l.subtotal;
    byProd.set(key, cur);
  }
  const porProducto = [...byProd.values()].sort((a, b) => b.cantidad - a.cantidad);

  const byCat = new Map<string, CategoriaAgregada>();
  for (const l of lineas) {
    const cur = byCat.get(l.categoria) ?? {
      categoria: l.categoria,
      cantidad: 0,
      subtotal: 0,
    };
    cur.cantidad += l.cantidad;
    cur.subtotal += l.subtotal;
    byCat.set(l.categoria, cur);
  }
  const porCategoria = [...byCat.values()].sort((a, b) => b.subtotal - a.subtotal);

  return { lineas, porProducto, porCategoria };
}
