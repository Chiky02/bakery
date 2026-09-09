import { requireBakeryContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MesasClient, type MesaRow } from "../mesas-client";

export default async function MesasPage() {
  const { panaderia } = await requireBakeryContext();
  const supabase = await createClient();

  const { data } = await supabase
    .from("mesas")
    .select("*, cuentas_mesa(id, estado, hora_apertura)")
    .eq("panaderia_id", panaderia.id)
    .order("nombre");

  const mesas = ((data as MesaRow[]) ?? []).filter((m) => m.activa ?? true);

  return <MesasClient mesas={mesas} qrOn={!!panaderia.pedido_directo_habilitado} />;
}
