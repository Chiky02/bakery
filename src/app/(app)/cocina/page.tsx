"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ItemCuenta } from "@/types";
import { formatCOP } from "@/lib/format";
import { useBakeryId } from "@/lib/use-bakery-id";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";

type ItemConMesa = ItemCuenta & {
  cuentas_mesa?: { panaderia_id?: string; mesas?: { nombre: string } | null } | null;
};

const ESTADO_COLOR: Record<string, "default" | "warning" | "info" | "success"> = {
  pendiente: "warning",
  pendiente_confirmacion: "info",
  en_preparacion: "info",
  listo: "success",
  entregado: "default",
};

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  pendiente_confirmacion: "Confirmar",
  en_preparacion: "Preparando",
  listo: "Listo",
  entregado: "Entregado",
};

export default function CocinaPage() {
  const { panaderiaId } = useBakeryId();
  const [items, setItems] = useState<ItemConMesa[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

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
    load();
  }

  async function bulk(estado: string, ids: string[]) {
    await Promise.all(ids.map((id) => updateEstado(id, estado)));
    setSelected({});
  }

  const byMesa = useMemo(() => {
    const map: Record<string, { nombre: string; items: ItemConMesa[] }> = {};
    for (const item of items) {
      const nombre = item.cuentas_mesa?.mesas?.nombre ?? "Mostrador / sin mesa";
      const key = nombre;
      (map[key] ??= { nombre, items: [] }).items.push(item);
    }
    return Object.values(map);
  }, [items]);

  function toggleMesa(mesaItems: ItemConMesa[], checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      for (const i of mesaItems) next[i.id] = checked;
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Cocina</h1>
          <p className="text-sm text-stone-500">Pedidos agrupados por mesa</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              bulk(
                "en_preparacion",
                Object.keys(selected).filter((id) => selected[id]),
              )
            }
          >
            Preparar seleccionados
          </Button>
          <Button
            size="sm"
            variant="success"
            onClick={() =>
              bulk(
                "listo",
                Object.keys(selected).filter((id) => selected[id]),
              )
            }
          >
            Marcar listos
          </Button>
        </div>
      </div>

      {byMesa.length === 0 ? (
        <p className="text-stone-500">Sin pedidos activos</p>
      ) : (
        byMesa.map((grupo) => {
          const allChecked = grupo.items.every((i) => selected[i.id]);
          return (
            <Card key={grupo.nombre} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => toggleMesa(grupo.items, e.target.checked)}
                  />
                  {grupo.nombre}
                  <Badge>{grupo.items.length}</Badge>
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      bulk(
                        "en_preparacion",
                        grupo.items.filter((i) => i.estado === "pendiente").map((i) => i.id),
                      )
                    }
                  >
                    Preparar mesa
                  </Button>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() =>
                      bulk(
                        "listo",
                        grupo.items
                          .filter((i) => ["pendiente", "en_preparacion"].includes(i.estado))
                          .map((i) => i.id),
                      )
                    }
                  >
                    Toda la mesa lista
                  </Button>
                </div>
              </div>
              <ul className="divide-y dark:divide-stone-800">
                {grupo.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!selected[item.id]}
                        onChange={(e) =>
                          setSelected((s) => ({ ...s, [item.id]: e.target.checked }))
                        }
                      />
                      <div>
                        <p className="font-semibold">
                          {item.cantidad}× {item.productos?.nombre}
                        </p>
                        <p className="text-xs text-stone-500">
                          {formatCOP(item.precio_al_momento * item.cantidad)}
                        </p>
                      </div>
                    </label>
                    <div className="flex items-center gap-2">
                      <Badge color={ESTADO_COLOR[item.estado]}>
                        {ESTADO_LABEL[item.estado]}
                      </Badge>
                      {item.estado === "pendiente_confirmacion" && (
                        <Button size="sm" onClick={() => updateEstado(item.id, "pendiente")}>
                          Aprobar
                        </Button>
                      )}
                      {item.estado === "pendiente" && (
                        <Button size="sm" onClick={() => updateEstado(item.id, "en_preparacion")}>
                          Preparar
                        </Button>
                      )}
                      {item.estado === "en_preparacion" && (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => updateEstado(item.id, "listo")}
                        >
                          <Check className="mr-1 h-4 w-4" /> Listo
                        </Button>
                      )}
                      {item.estado === "listo" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateEstado(item.id, "entregado")}
                        >
                          Entregado
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })
      )}
    </div>
  );
}
