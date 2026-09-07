import { createClient } from "@/lib/supabase/server";
import type { Panaderia } from "@/types";

export type PublicBakeryListItem = Pick<
  Panaderia,
  "id" | "nombre" | "nombre_publico" | "slug" | "activa"
>;

/** Lista locales activos visibles en el sitio público. */
export async function listPublicBakeries(): Promise<PublicBakeryListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("panaderias")
    .select("id, nombre, nombre_publico, slug, activa")
    .eq("activa", true)
    .order("nombre");
  return (data as PublicBakeryListItem[]) ?? [];
}

export async function getPublicBakeryBySlug(slug: string): Promise<Panaderia | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("panaderias")
    .select("*")
    .eq("slug", slug)
    .eq("activa", true)
    .maybeSingle();
  return (data as Panaderia) ?? null;
}

export async function getPublicBakeryById(id: string): Promise<Panaderia | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("panaderias")
    .select("*")
    .eq("id", id)
    .eq("activa", true)
    .maybeSingle();
  return (data as Panaderia) ?? null;
}
