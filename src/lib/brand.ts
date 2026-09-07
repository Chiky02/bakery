import type { Panaderia } from "@/types";

/** Nombre visible en UI pública y panel (configurado en el negocio). */
export function bakeryDisplayName(
  p: Pick<Panaderia, "nombre"> & { nombre_publico?: string | null } | null | undefined,
  fallback = "Panadería",
): string {
  const publicName = p?.nombre_publico?.trim();
  const name = p?.nombre?.trim();
  return publicName || name || fallback;
}
