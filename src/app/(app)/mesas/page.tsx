"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useBakeryId } from "@/lib/use-bakery-id";
import type { Mesa } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MesaQrLink } from "@/components/app/mesa-qr-link";
import { Armchair } from "lucide-react";

type MesaRow = Mesa & {
  cuentas_mesa?: { id: string; estado: string; hora_apertura: string }[];
};

export default function MesasPage() {
  const { panaderiaId, ready } = useBakeryId();
  const [mesas, setMesas] = useState<MesaRow[]>([]);
  const [qrOn, setQrOn] = useState(false);

  async function load() {
    if (!panaderiaId) return;
    const supabase = createClient();
    const [{ data }, { data: pan }] = await Promise.all([
      supabase
        .from("mesas")
        .select("*, cuentas_mesa(id, estado, hora_apertura)")
        .eq("panaderia_id", panaderiaId)
        .order("nombre"),
      supabase
        .from("panaderias")
        .select("pedido_directo_habilitado")
        .eq("id", panaderiaId)
        .single(),
    ]);
    const rows = ((data as MesaRow[]) ?? []).filter((m) => m.activa ?? true);
    setMesas(rows);
    setQrOn(!!pan?.pedido_directo_habilitado);
  }

  useEffect(() => {
    if (ready) load();
  }, [panaderiaId, ready]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mesas</h1>
        <p className="text-sm text-stone-500">
          Abre cuentas y atiende mesas activas. La creación y desactivación está en Gestionar mesas.
        </p>
        {!qrOn && (
          <p className="mt-2 text-sm text-orange-700 dark:text-orange-300">
            Pedido QR desactivado.{" "}
            <Link href="/configuracion" className="underline">
              Configuración
            </Link>
          </p>
        )}
      </div>

      {mesas.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <Armchair className="h-8 w-8 text-stone-400" />
          <p className="text-sm text-stone-500">No hay mesas activas.</p>
          <Link href="/mesas/gestion">
            <Button variant="secondary">Ir a gestionar mesas</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mesas.map((mesa) => {
            const cuentaAbierta = mesa.cuentas_mesa?.find((c) => c.estado === "abierta");
            return (
              <Card key={mesa.id} className="flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold">{mesa.nombre}</h3>
                    <Badge color={mesa.estado === "libre" ? "success" : "warning"}>{mesa.estado}</Badge>
                  </div>
                  <p className="text-sm text-stone-500">{mesa.zona}</p>
                  {cuentaAbierta && (
                    <p className="mt-2 text-xs text-orange-700 dark:text-orange-300">Cuenta abierta</p>
                  )}
                  {mesa.qr_habilitado && (
                    <MesaQrLink mesaId={mesa.id} mesaNombre={mesa.nombre} />
                  )}
                </div>
                <div className="mt-4">
                  <Link href={`/mesas/${mesa.id}`}>
                    <Button className="w-full" variant={cuentaAbierta ? "primary" : "secondary"}>
                      {cuentaAbierta ? "Ver cuenta" : "Abrir mesa"}
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
