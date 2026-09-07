import type { Producto } from "@/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Carga productos de venta. Si la columna `tipo` no existe aún, no rompe. */
export async function loadVentaProductos(
  supabase: SupabaseClient,
  panaderiaId: string,
  opts?: { onlyDisponible?: boolean },
) {
  let q = supabase
    .from("productos")
    .select("*, categorias(*)")
    .eq("panaderia_id", panaderiaId)
    .order("orden");

  if (opts?.onlyDisponible) q = q.eq("disponible", true);

  const { data, error } = await q;
  if (error) {
    console.error("loadVentaProductos", error.message);
    return [] as Producto[];
  }

  return ((data as Producto[]) ?? []).filter((p) => (p.tipo ?? "venta") !== "materia_prima");
}
