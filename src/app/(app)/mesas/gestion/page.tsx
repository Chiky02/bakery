import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MesasGestionClient } from "./gestion-client";
import type { Mesa } from "@/types";

type MesaRow = Mesa & {
  cuentas_mesa?: { id: string; estado: string; hora_apertura: string }[];
};

export default async function MesasGestionPage() {
  const { panaderia } = await requireFeature("mesas_gestion");
  const supabase = await createClient();

  const { data: mesas } = await supabase
    .from("mesas")
    .select(
      "id, panaderia_id, nombre, zona, estado, qr_habilitado, activa, cuentas_mesa(id, estado, hora_apertura)",
    )
    .eq("panaderia_id", panaderia.id)
    .order("nombre");

  return (
    <MesasGestionClient
      panaderiaId={panaderia.id}
      initialMesas={(mesas as MesaRow[]) ?? []}
    />
  );
}
