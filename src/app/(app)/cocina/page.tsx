"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ItemCuenta } from "@/types";
import { useBakeryId } from "@/lib/use-bakery-id";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChefHat } from "lucide-react";
import { cn } from "@/lib/utils";

type ItemConMesa = ItemCuenta & {
  cuentas_mesa?: { panaderia_id?: string; mesas?: { nombre: string } | null } | null;
};

export default function CocinaPage() {
  const { panaderiaId } = useBakeryId();
  const [items, setItems] = useState<ItemConMesa[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  async function load() {
    if (!panaderiaId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("items_cuenta")
      .select("*, productos(*), cuentas_mesa!inner(panaderia_id, mesas(nombre))")
      .eq("cuentas_mesa.panaderia_id", panaderiaId)
      .in("estado", ["pendiente", "pendiente_confirmacion", "en_preparacion", "listo"])
      .order("created_at");
    setItems((data as ItemConMesa[]) ?? []);
  }

  useEffect(() => {
    load();
    if (!panaderiaId) return;
    const supabase = createClient();
    const channel = supabase
      .channel("cocina")
      .on("postgres_changes", { event: "*", schema: "public", table: "items_cuenta" }, () => load())
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
    await load();
  }

  async function bulk(ids: string[], estado: string) {
    await Promise.all(ids.map((id) => updateEstado(id, estado)));
    setChecked({});
  }

  const byMesa = useMemo(() => {
    const map = new Map<string, { nombre: string; items: ItemConMesa[] }>();
    for (const item of items) {
      const nombre = item.cuentas_mesa?.mesas?.nombre ?? "Sin mesa";
      if (!map.has(nombre)) map.set(nombre, { nombre, items: [] });
      map.get(nombre)!.items.push(item);
    }
    return [...map.values()];
  }, [items]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ChefHat className="h-6 w-6" /> Cocina
        </h1>
        <p className="text-sm text-stone-500">Una tarjeta por mesa · checklist de platillos</p>
      </div>

      {byMesa.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 p-10 text-center text-stone-500 dark:border-stone-700">
          Sin pedidos en cola
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {byMesa.map((grupo) => {
            const ids = grupo.items.map((i) => i.id);
            const allOn = ids.every((id) => checked[id]);
            const selected = ids.filter((id) => checked[id]);
            const pendientes = grupo.items.filter((i) =>
              ["pendiente", "pendiente_confirmacion"].includes(i.estado),
            ).length;

            return (
              <article
                key={grupo.nombre}
                className="flex flex-col rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900"
              >
                <header className="flex items-start justify-between gap-2 border-b border-stone-100 px-4 py-3 dark:border-stone-800">
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
                  <Badge color={pendientes ? "warning" : "success"}>
                    {pendientes ? "En curso" : "Avanzado"}
                  </Badge>
                </header>

                <ul className="flex-1 space-y-1 px-2 py-2">
                  {grupo.items.map((item) => (
                    <li
                      key={item.id}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-2 py-2.5",
                        item.estado === "listo" && "bg-emerald-50 dark:bg-emerald-950/30",
                        item.estado === "en_preparacion" && "bg-amber-50 dark:bg-amber-950/20",
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
                        <p
                          className={cn(
                            "font-medium leading-tight",
                            item.estado === "listo" && "line-through opacity-70",
                          )}
                        >
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
                            onClick={() => updateEstado(item.id, "listo")}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {item.estado === "listo" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => updateEstado(item.id, "entregado")}
                          >
                            Entregar
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                <footer className="flex flex-wrap gap-2 border-t border-stone-100 p-3 dark:border-stone-800">
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
                    className="flex-1"
                    onClick={() =>
                      bulk(
                        (selected.length ? selected : ids).filter((id) => {
                          const it = grupo.items.find((x) => x.id === id);
                          return (
                            it && ["pendiente", "pendiente_confirmacion", "en_preparacion"].includes(it.estado)
                          );
                        }),
                        "listo",
                      )
                    }
                  >
                    Marcar listos
                  </Button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
