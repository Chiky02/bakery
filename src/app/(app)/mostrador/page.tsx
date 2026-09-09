import { requireBakeryContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadVentaProductos } from "@/lib/productos";
import { getTurnoAbiertoId } from "@/lib/turno-caja";
import { MostradorClient } from "./mostrador-client";

export default async function MostradorPage() {
  const { panaderia } = await requireBakeryContext();
  const supabase = await createClient();
  const [productos, turnoId] = await Promise.all([
    loadVentaProductos(supabase, panaderia.id, {
      onlyDisponible: true,
    }),
    getTurnoAbiertoId(supabase, panaderia.id),
  ]);

  return (
    <MostradorClient
      productos={productos}
      panaderia={panaderia}
      turnoAbierto={!!turnoId}
    />
  );
}
