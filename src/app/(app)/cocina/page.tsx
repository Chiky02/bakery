"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ItemCuenta } from "@/types";
import { useBakeryId } from "@/lib/use-bakery-id";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChefHat, Printer, X } from "lucide-react";
import { cn } from "@/lib/utils";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function imprimirComanda(mesa: string, items: ItemConMesa[]) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=420,height=640");
  if (!win) return;
  const filas = items
    .map(
      (item) =>
        `<tr><td>${item.cantidad}×</td><td>${escapeHtml(item.productos?.nombre ?? "Producto")}</td></tr>`,
    )
    .join("");
  const cuando = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
  win.document.write(`<!doctype html><html><head><title>Comanda ${escapeHtml(mesa)}</title>
    <style>body{font-family:sans-serif;padding:16px} h1{font-size:20px;margin:0} p{color:#444;font-size:12px} table{width:100%;border-collapse:collapse;margin-top:12px} td{padding:6px 0;border-bottom:1px solid #ddd;font-size:16px}</style>
    </head><body><h1>${escapeHtml(mesa)}</h1><p>${cuando}</p><table>${filas}</table></body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

type ItemConMesa = ItemCuenta & {
  cuentas_mesa?: {
    id?: string;
    estado?: string;
    panaderia_id?: string;
    mesas?: { nombre: string } | null;
  } | null;
};

export default function CocinaPage() {
  const { panaderiaId } = useBakeryId();
  const [items, setItems] = useState<ItemConMesa[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [cocinaOn, setCocinaOn] = useState(true);
  const [puedeImprimir, setPuedeImprimir] = useState(false);

  async function load() {
    if (!panaderiaId) return;
    const supabase = createClient();
    const [{ data }, { data: neg }] = await Promise.all([
      supabase
        .from("items_cuenta")
        .select("*, productos(*), cuentas_mesa!inner(id, estado, panaderia_id, mesas(nombre))")
        .eq("cuentas_mesa.panaderia_id", panaderiaId)
        .eq("cuentas_mesa.estado", "abierta")
        .in("estado", ["pendiente", "en_preparacion", "pendiente_confirmacion"])
        .order("created_at"),
      supabase
        .from("panaderias")
        .select("cocina_habilitada, cocina_imprimir")
        .eq("id", panaderiaId)
        .maybeSingle(),
    ]);
    const habilitada = neg?.cocina_habilitada !== false;
    setCocinaOn(habilitada);
    setPuedeImprimir(habilitada && !!neg?.cocina_imprimir);
    const rows = ((data as ItemConMesa[]) ?? []).filter(
      (item) => habilitada && item.productos?.pasa_cocina !== false,
    );
    setItems(rows);
  }

  useEffect(() => {
    load();
    if (!panaderiaId) return;
    const supabase = createClient();
    const channel = supabase
      .channel("cocina")
      .on("postgres_changes", { event: "*", schema: "public", table: "items_cuenta" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "cuentas_mesa" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [panaderiaId]);

  async function updateEstado(id: string, estado: string) {
    await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    // Optimistic: quita de la cola al marcar listo/entregado
    if (estado === "listo" || estado === "entregado" || estado === "cancelado") {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setChecked((c) => {
        const next = { ...c };
        delete next[id];
        return next;
      });
    }
    await load();
  }

  async function bulk(ids: string[], estado: string) {
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/items/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estado }),
        }),
      ),
    );
    if (estado === "listo" || estado === "entregado") {
      setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
    }
    setChecked({});
    await load();
  }

  const byMesa = useMemo(() => {
    const map = new Map<string, { key: string; nombre: string; items: ItemConMesa[] }>();
    for (const item of items) {
      const nombre = item.cuentas_mesa?.mesas?.nombre ?? "Sin mesa";
      const key = item.cuentas_mesa?.id ?? nombre;
      if (!map.has(key)) map.set(key, { key, nombre, items: [] });
      map.get(key)!.items.push(item);
    }
    return [...map.values()];
  }, [items]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ChefHat className="h-6 w-6" /> Cocina
        </h1>
        <p className="text-sm text-stone-500">
          Solo entran los productos marcados como “Pasa por cocina”, si el local lo tiene activo
          en Configuración. Al marcar listo salen de la cola.
        </p>
      </div>

      {!cocinaOn ? (
        <p className="rounded-2xl border border-dashed border-stone-300 p-10 text-center text-stone-500">
          Cocina desactivada. En Configuración puedes activar “Los pedidos de mesa pasan por
          cocina” si este local prepara platos.
        </p>
      ) : byMesa.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 p-10 text-center text-stone-500 ">
          Sin pedidos en cola
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {byMesa.map((grupo) => {
            const ids = grupo.items.map((i) => i.id);
            const allOn = ids.length > 0 && ids.every((id) => checked[id]);
            const selected = ids.filter((id) => checked[id]);
            const pendientes = grupo.items.filter((i) =>
              ["pendiente", "pendiente_confirmacion"].includes(i.estado),
            ).length;

            return (
              <article
                key={grupo.key}
                className="flex flex-col rounded-2xl border border-stone-200 bg-white shadow-sm  "
              >
                <header className="flex items-start justify-between gap-2 border-b border-stone-100 px-4 py-3 ">
                  <div>
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded"
                        checked={allOn}
                        onChange={(e) => {
                          const next = { ...checked };
                          ids.forEach((id) => {
                            next[id] = e.target.checked;
                          });
                          setChecked(next);
                        }}
                      />
                      <span className="text-lg font-bold">{grupo.nombre}</span>
                    </label>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {grupo.items.length} ítem(s)
                      {pendientes > 0 ? ` · ${pendientes} por empezar` : ""}
                    </p>
                  </div>
                  <Badge color={pendientes ? "warning" : "info"}>En cocina</Badge>
                </header>

                <ul className="flex-1 space-y-1 px-2 py-2">
                  {grupo.items.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-2 py-2.5",
                        item.estado === "en_preparacion" && "bg-amber-50 ",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded"
                        checked={!!checked[item.id]}
                        onChange={(e) =>
                          setChecked((c) => ({ ...c, [item.id]: e.target.checked }))
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-tight">
                          {item.cantidad}× {item.productos?.nombre}
                        </p>
                        <p className="text-[11px] uppercase tracking-wide text-stone-500">
                          {item.estado.replaceAll("_", " ")}
                          {item.origen === "cliente_qr" ? " · QR" : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1">
                        {item.estado === "pendiente_confirmacion" && (
                          <Button size="sm" onClick={() => updateEstado(item.id, "pendiente")}>
                            OK
                          </Button>
                        )}
                        {item.estado === "pendiente" && (
                          <Button size="sm" onClick={() => updateEstado(item.id, "en_preparacion")}>
                            Prep
                          </Button>
                        )}
                        {item.estado === "en_preparacion" && (
                          <Button
                            size="sm"
                            variant="success"
                            title="Listo (sale de cocina)"
                            onClick={() => updateEstado(item.id, "listo")}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                <footer className="flex flex-wrap gap-2 border-t border-stone-100 p-3 ">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() =>
                      bulk(
                        (selected.length ? selected : ids).filter((id) => {
                          const it = grupo.items.find((x) => x.id === id);
                          return it && ["pendiente", "pendiente_confirmacion"].includes(it.estado);
                        }),
                        "en_preparacion",
                      )
                    }
                  >
                    Preparar
                  </Button>
                  <Button
                    size="sm"
                    variant="success"
                    className="flex-1 gap-1"
                    onClick={() => bulk(selected.length ? selected : ids, "listo")}
                  >
                    <Check className="h-3.5 w-3.5" /> Listos
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full gap-1"
                    title="Quitar tarjeta de cocina"
                    onClick={() => bulk(ids, "listo")}
                  >
                    <X className="h-3.5 w-3.5" /> Limpiar tarjeta
                  </Button>
                  {puedeImprimir && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full gap-1"
                      onClick={() => imprimirComanda(grupo.nombre, grupo.items)}
                    >
                      <Printer className="h-3.5 w-3.5" /> Imprimir
                    </Button>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
