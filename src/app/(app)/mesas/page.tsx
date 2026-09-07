"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useBakeryId } from "@/lib/use-bakery-id";
import type { Mesa } from "@/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MesaQrLink } from "@/components/app/mesa-qr-link";

type MesaRow = Mesa & {
  cuentas_mesa?: { id: string; estado: string; hora_apertura: string }[];
};

export default function MesasPage() {
  const { panaderiaId, ready } = useBakeryId();
  const [mesas, setMesas] = useState<MesaRow[]>([]);
  const [nombre, setNombre] = useState("");
  const [zona, setZona] = useState("Salón");
  const [showInactive, setShowInactive] = useState(false);
  const [msg, setMsg] = useState("");
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
    setMesas((data as MesaRow[]) ?? []);
    setQrOn(!!pan?.pedido_directo_habilitado);
  }

  useEffect(() => {
    if (ready) load();
  }, [panaderiaId, ready]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!panaderiaId || !nombre.trim()) return;
    const supabase = createClient();
    const { error } = await supabase.from("mesas").insert({
      panaderia_id: panaderiaId,
      nombre: nombre.trim(),
      zona: zona.trim() || "Salón",
      estado: "libre",
      qr_habilitado: true,
      activa: true,
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    setNombre("");
    setMsg("Mesa creada");
    load();
  }

  async function toggleActiva(mesa: MesaRow) {
    const supabase = createClient();
    const next = !(mesa.activa ?? true);
    const { error } = await supabase.from("mesas").update({ activa: next }).eq("id", mesa.id);
    if (error) {
      // columna activa puede no existir aún
      setMsg(
        error.message.includes("activa")
          ? "Ejecuta la migración 20260907020000 (columna mesas.activa)"
          : error.message,
      );
      return;
    }
    load();
  }

  async function eliminar(mesa: MesaRow) {
    if (!confirm(`¿Eliminar ${mesa.nombre}? Solo si no tiene cuentas históricas críticas.`)) return;
    const supabase = createClient();
    const abierta = mesa.cuentas_mesa?.some((c) => c.estado === "abierta");
    if (abierta) {
      setMsg("Cierra la cuenta de la mesa antes de eliminarla");
      return;
    }
    const { error } = await supabase.from("mesas").delete().eq("id", mesa.id);
    if (error) {
      setMsg(error.message.includes("foreign") ? "Tiene historial; desactívala en su lugar" : error.message);
      return;
    }
    setMsg("Mesa eliminada");
    load();
  }

  const visible = mesas.filter((m) => showInactive || (m.activa ?? true));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mesas</h1>
        <p className="text-sm text-stone-500">
          Crea, activa o desactiva mesas según el local. Links QR por mesa.
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

      {msg && <p className="text-sm text-stone-600 dark:text-stone-300">{msg}</p>}

      <Card className="max-w-xl space-y-3 p-4">
        <p className="font-semibold">Nueva mesa</p>
        <form onSubmit={crear} className="flex flex-wrap gap-2">
          <Input
            className="min-w-[10rem] flex-1"
            placeholder="Nombre (Mesa 11)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
          <Input
            className="w-32"
            placeholder="Zona"
            value={zona}
            onChange={(e) => setZona(e.target.value)}
          />
          <Button type="submit">Crear</Button>
        </form>
        <label className="flex items-center gap-2 text-sm text-stone-500">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Mostrar mesas desactivadas
        </label>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((mesa) => {
          const cuentaAbierta = mesa.cuentas_mesa?.find((c) => c.estado === "abierta");
          const activa = mesa.activa ?? true;
          return (
            <Card key={mesa.id} className={`flex flex-col justify-between ${!activa ? "opacity-60" : ""}`}>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{mesa.nombre}</h3>
                  <div className="flex flex-col items-end gap-1">
                    <Badge color={mesa.estado === "libre" ? "success" : "warning"}>{mesa.estado}</Badge>
                    <Badge color={activa ? "info" : "danger"}>{activa ? "Activa" : "Off"}</Badge>
                  </div>
                </div>
                <p className="text-sm text-stone-500">{mesa.zona}</p>
                {cuentaAbierta && (
                  <p className="mt-2 text-xs text-orange-700 dark:text-orange-300">Cuenta abierta</p>
                )}
                {mesa.qr_habilitado && activa && (
                  <MesaQrLink mesaId={mesa.id} mesaNombre={mesa.nombre} />
                )}
              </div>
              <div className="mt-4 flex flex-col gap-2">
                {activa && (
                  <Link href={`/mesas/${mesa.id}`}>
                    <Button className="w-full" variant={cuentaAbierta ? "primary" : "secondary"}>
                      {cuentaAbierta ? "Ver cuenta" : "Abrir mesa"}
                    </Button>
                  </Link>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => toggleActiva(mesa)}>
                    {activa ? "Desactivar" : "Activar"}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => eliminar(mesa)}>
                    Eliminar
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
