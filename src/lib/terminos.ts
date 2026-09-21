import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type TerminosVersion = {
  id: string;
  version: string;
  titulo: string;
  contenido: string;
  vigente: boolean;
  publicada_at: string | null;
  created_at: string;
};

export const getVigenteTerminos = cache(async (): Promise<TerminosVersion | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("terminos_versiones")
    .select("id, version, titulo, contenido, vigente, publicada_at, created_at")
    .eq("vigente", true)
    .maybeSingle();

  if (error?.message?.includes("terminos_versiones")) {
    // Migración aún no aplicada
    return null;
  }
  return (data as TerminosVersion | null) ?? null;
});

export const hasAcceptedVigente = cache(async (userId: string): Promise<boolean> => {
  const vigente = await getVigenteTerminos();
  if (!vigente) return true; // sin tabla/versión: no bloquear

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("terminos_aceptaciones")
    .select("id")
    .eq("user_id", userId)
    .eq("terminos_version_id", vigente.id)
    .maybeSingle();

  if (error?.message?.includes("terminos_aceptaciones")) {
    return true;
  }
  return !!data;
});
