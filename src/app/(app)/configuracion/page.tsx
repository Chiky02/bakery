"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Panaderia } from "@/types";
import { useBakeryId } from "@/lib/use-bakery-id";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

export default function ConfiguracionPage() {
  const { panaderiaId, ready } = useBakeryId();
  const [config, setConfig] = useState<Panaderia | null>(null);
  const [saved, setSaved] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!panaderiaId) return;
    const supabase = createClient();
    supabase
      .from("panaderias")
      .select("*")
      .eq("id", panaderiaId)
      .single()
      .then(({ data }) => setConfig(data as Panaderia));
  }, [panaderiaId]);

  async function guardar() {
    if (!config || !panaderiaId) return;
    const supabase = createClient();
    await supabase
      .from("panaderias")
      .update({
        nombre: config.nombre,
        pedido_directo_habilitado: config.pedido_directo_habilitado,
        requiere_aprobacion_mesero: config.requiere_aprobacion_mesero,
        updated_at: new Date().toISOString(),
      })
      .eq("id", panaderiaId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!ready || !config) return <p>Cargando...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-stone-500">Ajustes de esta panadería y pedido por QR</p>
      </div>

      <Card className="max-w-lg space-y-4">
        <CardTitle>BakeryChiky02 · local</CardTitle>
        <div>
          <label className="text-sm font-medium">Nombre del negocio</label>
          <input
            className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
            value={config.nombre}
            onChange={(e) => setConfig({ ...config, nombre: e.target.value })}
          />
        </div>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={config.pedido_directo_habilitado}
            onChange={(e) =>
              setConfig({ ...config, pedido_directo_habilitado: e.target.checked })
            }
          />
          <div>
            <p className="font-medium">Pedido directo por QR</p>
            <p className="text-xs text-stone-500">
              Permite que clientes pidan escaneando el QR de la mesa
            </p>
          </div>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={config.requiere_aprobacion_mesero}
            onChange={(e) =>
              setConfig({ ...config, requiere_aprobacion_mesero: e.target.checked })
            }
          />
          <div>
            <p className="font-medium">Mesero como filtro</p>
            <p className="text-xs text-stone-500">
              Pedidos QR quedan pendientes de confirmación del mesero
            </p>
          </div>
        </label>

        <Button onClick={guardar}>Guardar</Button>
        {saved && <p className="text-sm text-green-600">Guardado</p>}
      </Card>

      {config.pedido_directo_habilitado && (
        <Card className="max-w-lg space-y-2">
          <CardTitle>Links de pedido QR</CardTitle>
          <p className="text-sm text-stone-500">
            Copia el link de cada mesa en{" "}
            <a href="/mesas" className="text-orange-700 underline dark:text-orange-300">
              Mesas
            </a>
            .
          </p>
          <code className="block break-all rounded-lg bg-stone-100 p-3 text-xs dark:bg-stone-800">
            {origin}/qr/[id-de-mesa]
          </code>
          <p className="text-xs text-stone-400">
            Genera el código QR con ese URL e imprímelo en la mesa.
          </p>
        </Card>
      )}
    </div>
  );
}
