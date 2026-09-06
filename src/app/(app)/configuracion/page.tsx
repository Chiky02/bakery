"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ConfigNegocio } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<ConfigNegocio | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("config_negocio")
      .select("*")
      .eq("id", 1)
      .single()
      .then(({ data }) => setConfig(data as ConfigNegocio));
  }, []);

  async function guardar() {
    if (!config) return;
    const supabase = createClient();
    await supabase.from("config_negocio").update({
      nombre: config.nombre,
      pedido_directo_habilitado: config.pedido_directo_habilitado,
      requiere_aprobacion_mesero: config.requiere_aprobacion_mesero,
    }).eq("id", 1);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!config) return <p>Cargando...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-stone-500">Ajustes del negocio y pedido por QR</p>
      </div>

      <Card className="max-w-lg space-y-4">
        <div>
          <label className="text-sm font-medium">Nombre del negocio</label>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
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
              Los pedidos QR quedan pendientes hasta aprobación del mesero
            </p>
          </div>
        </label>

        <Button onClick={guardar}>{saved ? "✓ Guardado" : "Guardar cambios"}</Button>
      </Card>

      <Card className="max-w-lg">
        <CardTitle>Enlaces QR por mesa</CardTitle>
        <p className="mt-2 text-sm text-stone-500">
          Cada mesa tiene un enlace del tipo:{" "}
          <code className="rounded bg-stone-100 px-1">/qr/[id-mesa]</code>
        </p>
        <p className="mt-2 text-xs text-stone-400">
          Imprime el QR apuntando a esa URL para cada mesa desde el panel de mesas.
        </p>
      </Card>
    </div>
  );
}
