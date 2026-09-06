"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ItemCuenta } from "@/types";
import { formatCOP } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  const [items, setItems] = useState<ItemCuenta[]>([]);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("items_cuenta")
      .select("*, productos(*), cuentas_mesa(mesas(nombre))")
      .in("estado", ["pendiente", "pendiente_confirmacion", "en_preparacion", "listo"])
      .order("created_at");
    setItems((data as ItemCuenta[]) ?? []);
  }

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel("cocina")
      .on("postgres_changes", { event: "*", schema: "public", table: "items_cuenta" }, () =>
        load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function updateEstado(id: string, estado: string) {
    await fetch(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    load();
  }

  async function confirmar(id: string) {
    await updateEstado(id, "pendiente");
  }

  const pendientes = items.filter((i) => i.estado === "pendiente_confirmacion");
  const activos = items.filter((i) =>
    ["pendiente", "en_preparacion", "listo"].includes(i.estado),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Cocina</h1>
        <p className="text-sm text-stone-500">Pedidos de mostrador y mesas en tiempo real</p>
      </div>

      {pendientes.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold text-blue-700">Pendientes de confirmación (QR)</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {pendientes.map((item) => (
              <Card key={item.id} className="border-blue-200">
                <div className="flex justify-between">
                  <span className="font-medium">
                    {item.cantidad}x {item.productos?.nombre}
                  </span>
                  <Badge color="info">QR</Badge>
                </div>
                <Button className="mt-3 w-full" size="sm" onClick={() => confirmar(item.id)}>
                  Aprobar → cocina
                </Button>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold">En cola</h2>
        {activos.length === 0 ? (
          <p className="text-stone-500">Sin pedidos activos</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {activos.map((item) => (
              <Card key={item.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-lg font-bold">
                      {item.cantidad}x {item.productos?.nombre}
                    </p>
                    <p className="text-sm text-stone-500">
                      {(item as ItemCuenta & { cuentas_mesa?: { mesas?: { nombre: string } } })
                        .cuentas_mesa?.mesas?.nombre ?? "Mostrador"}
                    </p>
                  </div>
                  <Badge color={ESTADO_COLOR[item.estado]}>
                    {ESTADO_LABEL[item.estado]}
                  </Badge>
                </div>
                <p className="mt-1 text-sm">{formatCOP(item.precio_al_momento * item.cantidad)}</p>
                <div className="mt-3 flex gap-2">
                  {item.estado === "pendiente" && (
                    <Button size="sm" className="flex-1" onClick={() => updateEstado(item.id, "en_preparacion")}>
                      Preparar
                    </Button>
                  )}
                  {item.estado === "en_preparacion" && (
                    <Button size="sm" variant="success" className="flex-1" onClick={() => updateEstado(item.id, "listo")}>
                      Listo
                    </Button>
                  )}
                  {item.estado === "listo" && (
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => updateEstado(item.id, "entregado")}>
                      Entregado
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
