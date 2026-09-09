import { requireBakeryContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadVentaProductos } from "@/lib/productos";
import { MostradorClient } from "./mostrador-client";

export default async function MostradorPage() {
  const { panaderia } = await requireBakeryContext();
  const supabase = await createClient();
  const productos = await loadVentaProductos(supabase, panaderia.id, {
    onlyDisponible: true,
  });

  return <MostradorClient productos={productos} panaderia={panaderia} />;
}
