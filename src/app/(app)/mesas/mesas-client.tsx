"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Mesa } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MesaQrLink } from "@/components/app/mesa-qr-link";
import { Armchair } from "lucide-react";

export type MesaRow = Mesa & {
  cuentas_mesa?: { id: string; estado: string; hora_apertura: string }[];
};

export function MesasClient({ mesas, qrOn }: { mesas: MesaRow[]; qrOn: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function entrar(mesa: MesaRow) {
    const cuentaAbierta = mesa.cuentas_mesa?.find((c) => c.estado === "abierta");
    if (cuentaAbierta) {
      router.push(`/mesas/${mesa.id}`);
      return;
    }
    setBusyId(mesa.id);
    const res = await fetch(`/api/mesas/${mesa.id}/abrir`, { method: "POST" });
    setBusyId(null);
    if (!res.ok) return;
    router.push(`/mesas/${mesa.id}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mesas</h1>
        <p className="text-sm text-stone-500">
          Abre cuentas y atiende mesas activas. La creación y desactivación está en Gestionar mesas.
        </p>
        {!qrOn && (
          <p className="mt-2 text-sm text-orange-700">
            Pedido QR desactivado.{" "}
            <Link href="/configuracion" className="underline">
              Configuración
            </Link>
          </p>
        )}
      </div>

      {mesas.length === 0 ? (
        <Card className="flex min-h-[12rem] flex-col items-center justify-center gap-3 p-8 text-center">
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
              <Card key={mesa.id} className="flex min-h-[11rem] flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold">{mesa.nombre}</h3>
                    <Badge color={mesa.estado === "libre" ? "success" : "warning"}>
                      {mesa.estado}
                    </Badge>
                  </div>
                  <p className="text-sm text-stone-500">{mesa.zona}</p>
                  {cuentaAbierta && (
                    <p className="mt-2 text-xs text-orange-700">Cuenta abierta</p>
                  )}
                  {qrOn && mesa.qr_habilitado && (
                    <MesaQrLink mesaId={mesa.id} mesaNombre={mesa.nombre} />
                  )}
                </div>
                <div className="mt-4">
                  <Button
                    className="w-full"
                    variant={cuentaAbierta ? "primary" : "secondary"}
                    disabled={busyId === mesa.id}
                    onClick={() => entrar(mesa)}
                  >
                    {busyId === mesa.id
                      ? "Abriendo..."
                      : cuentaAbierta
                        ? "Ver cuenta"
                        : "Abrir mesa"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
