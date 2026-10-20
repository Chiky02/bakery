"use client";

import { useEffect, useState, useTransition } from "react";
import { useOnlineStatus, usePendingOutboxCount, notifyOutboxChanged } from "@/lib/offline/hooks";
import { Button } from "@/components/ui/button";

export function OfflineBanner() {
  const online = useOnlineStatus();
  const { count, refresh } = usePendingOutboxCount();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    async function runSync() {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const { countPendingOutbox } = await import("@/lib/offline/store");
      const n = await countPendingOutbox();
      if (n === 0) return;
      startTransition(async () => {
        const { flushOutbox } = await import("@/lib/offline/sync");
        const { flushComandasLocales } = await import("@/lib/cocina-sync");
        const result = await flushOutbox();
        const comandas = await flushComandasLocales();
        notifyOutboxChanged();
        await refresh();
        const partes: string[] = [];
        if (result.synced > 0) partes.push(`${result.synced} venta(s)`);
        if (comandas.synced > 0) partes.push(`${comandas.synced} pedido(s) de mesa`);
        if (partes.length) setMsg(`Sincronizado: ${partes.join(" y ")}.`);
        else if (result.failed > 0 || comandas.failed > 0) {
          setMsg(result.errors[0] ?? "No se pudieron sincronizar algunos pendientes.");
        }
      });
    }

    void runSync();
    window.addEventListener("online", runSync);
    return () => window.removeEventListener("online", runSync);
  }, [refresh]);

  async function syncNow() {
    setMsg(null);
    startTransition(async () => {
      const { flushOutbox } = await import("@/lib/offline/sync");
      const { flushComandasLocales } = await import("@/lib/cocina-sync");
      const result = await flushOutbox();
      const comandas = await flushComandasLocales();
      notifyOutboxChanged();
      await refresh();
      const partes: string[] = [];
      if (result.synced > 0) partes.push(`${result.synced} venta(s)`);
      if (comandas.synced > 0) partes.push(`${comandas.synced} pedido(s) de mesa`);
      if (partes.length) setMsg(`Sincronizado: ${partes.join(" y ")}.`);
      else if (result.failed > 0 || comandas.failed > 0) {
        setMsg(result.errors[0] ?? "Error al sincronizar");
      } else {
        setMsg("Nada pendiente.");
      }
    });
  }

  if (online && count === 0 && !msg) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 text-sm md:px-4 ${
        online
          ? "border-sky-200 bg-sky-50 text-sky-950"
          : "border-amber-300 bg-amber-50 text-amber-950"
      }`}
    >
      <div className="min-w-0 space-y-0.5">
        {!online ? (
          <p>
            <span className="font-semibold">Sin conexión.</span> Ventas de mostrador y pedidos
            de mesa se guardan en este dispositivo. Si hay equipo de cocina en el WiFi, la comanda
            llega allá igual
            {count > 0 ? ` · ${count} pendiente(s)` : ""}.
          </p>
        ) : count > 0 ? (
          <p>
            <span className="font-semibold">Pendientes de sync:</span> {count} en este
            dispositivo.
          </p>
        ) : null}
        {msg && <p className="text-xs opacity-90">{msg}</p>}
      </div>
      {online && count > 0 && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => void syncNow()}
        >
          {pending ? "Sincronizando…" : "Sincronizar ahora"}
        </Button>
      )}
    </div>
  );
}
