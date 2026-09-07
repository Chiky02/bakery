import { createClient } from "@/lib/supabase/server";
import type { Panaderia } from "@/types";

/** Panadería pública principal (slug interno de despliegue; el nombre visible viene de BD). */
const PUBLIC_SLUG = process.env.NEXT_PUBLIC_BAKERY_SLUG || "bakerychiky02";

export async function getPublicBakery(): Promise<Panaderia | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("panaderias")
    .select("*")
    .eq("slug", PUBLIC_SLUG)
    .maybeSingle();

  if (data) return data as Panaderia;

  const { data: first } = await supabase
    .from("panaderias")
    .select("*")
    .eq("activa", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  return (first as Panaderia) ?? null;
}
