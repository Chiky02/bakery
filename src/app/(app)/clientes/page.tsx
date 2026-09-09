import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClientesClient } from "./clientes-client";
import type { Cliente } from "@/types";

export default async function ClientesPage() {
  const { panaderia } = await requireFeature("clientes");
  const supabase = await createClient();

  const { data } = await supabase
    .from("clientes")
    .select("*")
    .eq("panaderia_id", panaderia.id)
    .order("nombre");

  return <ClientesClient initial={(data as Cliente[]) ?? []} />;
}
