import type { Factura } from "@/types";
import {
  listOutbox,
  removeOutbox,
  updateOutbox,
  type OutboxItem,
} from "@/lib/offline/store";

export type SyncResult = {
  synced: number;
  failed: number;
  errors: string[];
};

async function postVenta(item: OutboxItem): Promise<{ id: string }> {
  const p = item.payload;
  const res = await fetch("/api/ventas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_request_id: p.client_request_id,
      medio_pago: p.medio_pago,
      monto_efectivo: p.monto_efectivo,
      monto_electronico: p.monto_electronico,
      detalle: p.detalle.map((d) => ({
        producto_id: d.producto_id,
        cantidad: d.cantidad,
      })),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? `Error ${res.status}`);
  }
  return body as { id: string };
}

async function maybeFactura(item: OutboxItem, ventaId: string): Promise<void> {
  const p = item.payload;
  if (!p.emitir_factura || !p.factura?.cliente_nombre?.trim()) return;

  const fRes = await fetch("/api/facturas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origen: "mostrador",
      venta_id: ventaId,
      cliente_id: p.factura.cliente_id,
      cliente_nombre: p.factura.cliente_nombre.trim(),
      cliente_documento: p.factura.cliente_documento.trim() || null,
      cliente_email: p.factura.cliente_email.trim() || null,
      cliente_telefono: p.factura.cliente_telefono.trim() || null,
      cliente_direccion: p.factura.cliente_direccion.trim() || null,
      medio_pago: p.medio_pago,
      iva_porcentaje: p.factura.iva_porcentaje || 0,
      detalle: p.detalle.map((d) => ({
        producto_id: d.producto_id,
        nombre: d.nombre,
        cantidad: d.cantidad,
        precio: d.precio,
      })),
      notas: "Documento comercial de venta (no es factura electrónica DIAN).",
    }),
  });
  if (fRes.ok) {
    const f = (await fRes.json()) as Factura;
    if (typeof window !== "undefined") {
      window.open(`/facturas/${f.id}`, "_blank");
    }
  }
}

/** Envía pendientes de la cola local al servidor (idempotente). */
export async function flushOutbox(): Promise<SyncResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { synced: 0, failed: 0, errors: ["Sin conexión"] };
  }

  const items = await listOutbox();
  const pending = items.filter((i) => i.status === "pending" || i.status === "error");
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of pending) {
    await updateOutbox(item.id, { status: "syncing", last_error: null });
    try {
      const venta = await postVenta(item);
      try {
        await maybeFactura(item, venta.id);
      } catch {
        // Venta OK; factura opcional
      }
      if (item.payload.print_ticket && !item.payload.emitir_factura && typeof window !== "undefined") {
        window.open(`/ventas/${venta.id}/ticket`, "_blank");
      }
      await removeOutbox(item.id);
      synced += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error de sync";
      await updateOutbox(item.id, { status: "error", last_error: msg });
      failed += 1;
      errors.push(msg);
    }
  }

  return { synced, failed, errors };
}
