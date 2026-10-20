import type { ComandaLocal } from "@/lib/offline/store";
import type { ItemCuenta } from "@/types";

const URL_KEY = "sissa.cocinaHubUrl";

export type HubComanda = ComandaLocal & {
  synced?: boolean;
  cloud_item_id?: string | null;
};

export function normalizeHubUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getCocinaHubUrl(): string | null {
  if (typeof localStorage === "undefined") return null;
  const saved = localStorage.getItem(URL_KEY);
  return saved ? normalizeHubUrl(saved) : null;
}

export function setCocinaHubUrl(url: string | null): void {
  if (typeof localStorage === "undefined") return;
  if (!url) localStorage.removeItem(URL_KEY);
  else localStorage.setItem(URL_KEY, url);
}

/** Pedidos que la pantalla de cocina debe mostrar desde el equipo local. */
export function localItemId(id: string) {
  return `local:${id}`;
}

export function parseLocalItemId(id: string): string | null {
  return id.startsWith("local:") ? id.slice("local:".length) : null;
}

export function comandaToItem(row: ComandaLocal): ItemCuenta {
  return {
    id: localItemId(row.id),
    cuenta_mesa_id: row.cuenta_id,
    sub_cuenta_id: null,
    producto_id: row.producto_id,
    cantidad: row.cantidad,
    precio_al_momento: row.precio,
    origen: "mesero",
    estado: row.estado,
    notas: null,
    productos: {
      id: row.producto_id,
      panaderia_id: row.panaderia_id,
      categoria_id: "",
      nombre: row.nombre,
      precio: row.precio,
      disponible: true,
      orden: 0,
      pasa_cocina: row.pasa_cocina,
    },
  };
}

export function comandasParaCocina(list: HubComanda[], cloudOk: boolean): HubComanda[] {
  return list.filter((c) => {
    if (c.pasa_cocina === false) return false;
    if (c.estado === "listo" || c.estado === "cancelado") return false;
    if (cloudOk && c.synced) return false;
    return true;
  });
}

async function hubFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const base = getCocinaHubUrl();
  if (!base) return null;
  try {
    return await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    return null;
  }
}

export async function publishComanda(row: ComandaLocal): Promise<boolean> {
  if (!row.pasa_cocina) return false;
  const res = await hubFetch("/comandas", {
    method: "POST",
    body: JSON.stringify(row),
  });
  return !!res?.ok;
}

export async function listHubComandas(panaderiaId: string): Promise<HubComanda[]> {
  const res = await hubFetch(`/comandas?panaderia_id=${encodeURIComponent(panaderiaId)}`);
  if (!res?.ok) return [];
  const body = (await res.json().catch(() => ({}))) as { comandas?: HubComanda[] };
  return body.comandas ?? [];
}

export async function patchHubComanda(
  id: string,
  patch: Partial<Pick<HubComanda, "estado" | "cantidad" | "synced" | "cloud_item_id">>,
): Promise<boolean> {
  const res = await hubFetch(`/comandas/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return !!res?.ok;
}
