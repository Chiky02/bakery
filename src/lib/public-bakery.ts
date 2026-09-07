import { createClient } from "@/lib/supabase/server";
import type { Panaderia } from "@/types";
import { bakeryDisplayName } from "@/lib/brand";

export type PublicBakeryListItem = Pick<
  Panaderia,
  | "id"
  | "nombre"
  | "nombre_publico"
  | "slug"
  | "activa"
  | "telefono"
  | "direccion"
  | "maps_url"
  | "whatsapp"
>;

const PRIMARY_SLUG = process.env.NEXT_PUBLIC_BAKERY_SLUG || "bakerychiky02";

/** Lista locales activos visibles en el sitio público. */
export async function listPublicBakeries(): Promise<PublicBakeryListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("panaderias")
    .select("id, nombre, nombre_publico, slug, activa, telefono, direccion, maps_url, whatsapp")
    .eq("activa", true)
    .order("nombre");
  return (data as PublicBakeryListItem[]) ?? [];
}

/** Negocio principal del despliegue (nombre/teléfono del home y config). */
export async function getPrimaryPublicBakery(): Promise<Panaderia | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("panaderias")
    .select("*")
    .eq("slug", PRIMARY_SLUG)
    .eq("activa", true)
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

export function primaryBrandName(p: Panaderia | null | undefined) {
  return bakeryDisplayName(p, "Panadería");
}
