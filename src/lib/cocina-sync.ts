import { listHubComandas, patchHubComanda } from "@/lib/cocina-hub";
import {
  listComandasLocales,
  removeComandaLocal,
  saveComandaLocal,
  type ComandaLocal,
} from "@/lib/offline/store";

export type ComandaSyncResult = {
  synced: number;
  failed: number;
};

/** Sube a la nube las comandas guardadas en este dispositivo. El id evita duplicados. */
export async function flushComandasLocales(): Promise<ComandaSyncResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const rows = await listComandasLocales();
  let synced = 0;
  let failed = 0;

  for (const row of rows) {
    if (row.estado === "cancelado") {
      await removeComandaLocal(row.id);
      await patchHubComanda(row.id, { estado: "cancelado", synced: true });
      continue;
    }
    if (!row.cuenta_id) {
      failed += 1;
      continue;
    }

    try {
      const res = await fetch(`/api/cuentas/${row.cuenta_id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producto_id: row.producto_id,
          cantidad: row.cantidad,
          origen: "mesero",
          client_request_id: row.id,
          estado: row.estado,
        }),
      });
      if (!res.ok) {
        failed += 1;
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const next: ComandaLocal = {
          ...row,
          status: "error",
          last_error: body.error ?? `Error ${res.status}`,
        };
        await saveComandaLocal(next);
        continue;
      }
      const saved = (await res.json().catch(() => ({}))) as { id?: string };
      await removeComandaLocal(row.id);
      await patchHubComanda(row.id, {
        synced: true,
        cloud_item_id: saved.id ?? null,
        estado: row.estado,
        cantidad: row.cantidad,
      });
      synced += 1;
    } catch {
      failed += 1;
    }
  }

  return { synced, failed };
}

/** La pantalla de cocina sube lo que está en el equipo del local y todavía no está en la nube. */
export async function flushHubComandas(panaderiaId: string): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const rows = await listHubComandas(panaderiaId);
  for (const row of rows) {
    if (row.synced || !row.cuenta_id || row.estado === "cancelado") continue;
    try {
      const res = await fetch(`/api/cuentas/${row.cuenta_id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producto_id: row.producto_id,
          cantidad: row.cantidad,
          origen: "mesero",
          client_request_id: row.id,
          estado: row.estado,
        }),
      });
      if (!res.ok) continue;
      const saved = (await res.json().catch(() => ({}))) as { id?: string };
      await patchHubComanda(row.id, {
        synced: true,
        cloud_item_id: saved.id ?? null,
        estado: row.estado,
        cantidad: row.cantidad,
      });
    } catch {
      /* sigue en el equipo local */
    }
  }
}
