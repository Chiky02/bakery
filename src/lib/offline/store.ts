const DB_NAME = "sissa-offline";
const DB_VERSION = 2;

export type OutboxVentaPayload = {
  panaderia_id: string;
  client_request_id: string;
  medio_pago: "efectivo" | "electronico" | "mixto";
  monto_efectivo?: number;
  monto_electronico?: number;
  detalle: {
    producto_id: string;
    nombre: string;
    cantidad: number;
    precio: number;
    subtotal: number;
  }[];
  /** Si true, tras sync exitoso se intenta emitir factura (solo online). */
  emitir_factura?: boolean;
  factura?: {
    cliente_id: string | null;
    cliente_nombre: string;
    cliente_documento: string;
    cliente_email: string;
    cliente_telefono: string;
    cliente_direccion: string;
    iva_porcentaje: number;
  };
  print_ticket?: boolean;
};

export type OutboxItem = {
  id: string;
  kind: "venta_mostrador";
  created_at: string;
  status: "pending" | "syncing" | "error";
  last_error?: string | null;
  payload: OutboxVentaPayload;
};

export type CatalogSnapshot = {
  panaderia_id: string;
  updated_at: string;
  productos: unknown[];
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("catalog")) {
        db.createObjectStore("catalog", { keyPath: "panaderia_id" });
      }
      if (!db.objectStoreNames.contains("outbox")) {
        const store = db.createObjectStore("outbox", { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
      }
      if (!db.objectStoreNames.contains("mesa_cache")) {
        db.createObjectStore("mesa_cache", { keyPath: "mesa_id" });
      }
      if (!db.objectStoreNames.contains("comandas_locales")) {
        db.createObjectStore("comandas_locales", { keyPath: "id" });
      }
    };
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IDB tx"));
    tx.onabort = () => reject(tx.error ?? new Error("IDB abort"));
  });
}

export async function saveCatalog(panaderiaId: string, productos: unknown[]): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  const tx = db.transaction("catalog", "readwrite");
  tx.objectStore("catalog").put({
    panaderia_id: panaderiaId,
    updated_at: new Date().toISOString(),
    productos,
  } satisfies CatalogSnapshot);
  await txDone(tx);
  db.close();
}

export async function loadCatalog(panaderiaId: string): Promise<CatalogSnapshot | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  const tx = db.transaction("catalog", "readonly");
  const req = tx.objectStore("catalog").get(panaderiaId);
  const row = await new Promise<CatalogSnapshot | undefined>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as CatalogSnapshot | undefined);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return row ?? null;
}

export async function enqueueOutbox(item: OutboxItem): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("outbox", "readwrite");
  tx.objectStore("outbox").put(item);
  await txDone(tx);
  db.close();
}

export async function listOutbox(): Promise<OutboxItem[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  const tx = db.transaction("outbox", "readonly");
  const req = tx.objectStore("outbox").getAll();
  const rows = await new Promise<OutboxItem[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as OutboxItem[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function updateOutbox(
  id: string,
  patch: Partial<Pick<OutboxItem, "status" | "last_error">>,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("outbox", "readwrite");
  const store = tx.objectStore("outbox");
  const req = store.get(id);
  const current = await new Promise<OutboxItem | undefined>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as OutboxItem | undefined);
    req.onerror = () => reject(req.error);
  });
  if (current) {
    store.put({ ...current, ...patch });
  }
  await txDone(tx);
  db.close();
}

export async function removeOutbox(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("outbox", "readwrite");
  tx.objectStore("outbox").delete(id);
  await txDone(tx);
  db.close();
}

export async function countPendingOutbox(): Promise<number> {
  const [items, comandas] = await Promise.all([listOutbox(), listComandasLocales()]);
  const ventas = items.filter((i) => i.status === "pending" || i.status === "error").length;
  return ventas + comandas.length;
}

export type MesaCache = {
  mesa_id: string;
  panaderia_id: string;
  mesa: unknown;
  cuenta_id: string | null;
  productos: unknown[];
  cocina_habilitada: boolean;
  updated_at: string;
};

export type ComandaLocal = {
  id: string;
  panaderia_id: string;
  mesa_id: string;
  mesa_nombre: string;
  cuenta_id: string;
  producto_id: string;
  nombre: string;
  cantidad: number;
  precio: number;
  estado: "pendiente" | "en_preparacion" | "listo" | "cancelado";
  pasa_cocina: boolean;
  created_at: string;
  status: "pending" | "error";
  last_error?: string | null;
};

export async function saveMesaCache(row: MesaCache): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  const tx = db.transaction("mesa_cache", "readwrite");
  tx.objectStore("mesa_cache").put(row);
  await txDone(tx);
  db.close();
}

export async function loadMesaCache(mesaId: string): Promise<MesaCache | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  const tx = db.transaction("mesa_cache", "readonly");
  const req = tx.objectStore("mesa_cache").get(mesaId);
  const row = await new Promise<MesaCache | undefined>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as MesaCache | undefined);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return row ?? null;
}

export async function saveComandaLocal(row: ComandaLocal): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("comandas_locales", "readwrite");
  tx.objectStore("comandas_locales").put(row);
  await txDone(tx);
  db.close();
}

export async function listComandasLocales(): Promise<ComandaLocal[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  const tx = db.transaction("comandas_locales", "readonly");
  const req = tx.objectStore("comandas_locales").getAll();
  const rows = await new Promise<ComandaLocal[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as ComandaLocal[]) ?? []);
    req.onerror = () => reject(req.error);
  });
  await txDone(tx);
  db.close();
  return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function removeComandaLocal(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("comandas_locales", "readwrite");
  tx.objectStore("comandas_locales").delete(id);
  await txDone(tx);
  db.close();
}

export function newClientRequestId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
