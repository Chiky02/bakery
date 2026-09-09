import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InventarioClient } from "./inventario-client";
import type { Producto } from "@/types";

export default async function InventarioPage() {
  const { panaderia } = await requireFeature("inventario");
  const supabase = await createClient();

  const { data } = await supabase
    .from("productos")
    .select("*, categorias(nombre)")
    .eq("panaderia_id", panaderia.id)
    .eq("control_stock", true)
    .order("nombre");

  return <InventarioClient initialProductos={(data as Producto[]) ?? []} />;
}
