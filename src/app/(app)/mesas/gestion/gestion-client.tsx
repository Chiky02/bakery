"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Mesa } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MesaQrLink } from "@/components/app/mesa-qr-link";
import { Power, PowerOff, Trash2 } from "lucide-react";

type MesaRow = Mesa & {
  cuentas_mesa?: { id: string; estado: string; hora_apertura: string }[];
};

export function MesasGestionClient({
  panaderiaId,
  initialMesas,
}: {
  panaderiaId: string;
  initialMesas: MesaRow[];
}) {
  const [mesas, setMesas] = useState<MesaRow[]>(initialMesas);
  const [nombre, setNombre] = useState("");
  const [zona, setZona] = useState("Salón");
  const [showInactive, setShowInactive] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "error">("ok");

  function notify(text: string, tone: "ok" | "error" = "ok") {
    setMsg(text);
    setMsgTone(tone);
  }

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("mesas")
      .select(
        "id, panaderia_id, nombre, zona, estado, qr_habilitado, activa, cuentas_mesa(id, estado, hora_apertura)",
      )
      .eq("panaderia_id", panaderiaId)
      .order("nombre");
    setMesas((data as MesaRow[]) ?? []);
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
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
      notify(error.message, "error");
      return;
    }
    setNombre("");
    notify("Mesa creada");
    void load();
  }

  async function toggleActiva(mesa: MesaRow) {
    const supabase = createClient();
    const next = !(mesa.activa ?? true);
    const { error } = await supabase.from("mesas").update({ activa: next }).eq("id", mesa.id);
    if (error) {
      notify(
        error.message.includes("activa")
          ? "Ejecuta la migración 20260907020000 (columna mesas.activa)"
          : error.message,
        "error",
      );
      return;
    }
    notify(next ? `${mesa.nombre} activada` : `${mesa.nombre} desactivada`);
    void load();
  }

  function isFkBlock(message: string) {
    const m = message.toLowerCase();
    return (
      m.includes("foreign") ||
      m.includes("23503") ||
      m.includes("referenced") ||
      m.includes("cuentas_mesa") ||
      m.includes("violates") ||
      m.includes("restrict")
    );
  }

  async function eliminar(mesa: MesaRow) {
    if (!confirm(`¿Eliminar ${mesa.nombre}?`)) return;
    const abierta = mesa.cuentas_mesa?.some((c) => c.estado === "abierta");
    if (abierta) {
      notify(
        `No se puede eliminar ${mesa.nombre}: tiene una cuenta abierta. Ciérrala primero o desactívala para ocultarla del listado.`,
        "error",
      );
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("mesas").delete().eq("id", mesa.id);
    if (error) {
      if (isFkBlock(error.message)) {
        notify(
          `No se puede eliminar ${mesa.nombre}: ya tiene ventas o cuentas asociadas y se conserva el historial. Usa Desactivar para que no aparezca en mesas activas.`,
          "error",
        );
        return;
      }
      notify(error.message, "error");
      return;
    }
    notify("Mesa eliminada");
    void load();
  }

  const visible = mesas.filter((m) => showInactive || (m.activa ?? true));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/mesas" className="text-sm text-orange-700 hover:underline">
          ← Volver a mesas
        </Link>
        <h1 className="text-2xl font-bold">Gestionar mesas</h1>
        <p className="text-sm text-stone-500">
          Crear, activar, desactivar o eliminar mesas (dueño/gerente).
        </p>
      </div>

      {msg && (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            msgTone === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {msg}
        </p>
      )}

      <Card className="w-full max-w-4xl space-y-3 p-4">
        <CardTitle>Nueva mesa</CardTitle>
        <form onSubmit={crear} className="grid gap-2 sm:grid-cols-3">
          <Input
            placeholder="Nombre (Mesa 11)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
          <Input placeholder="Zona" value={zona} onChange={(e) => setZona(e.target.value)} />
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((mesa) => {
          const activa = mesa.activa ?? true;
          const cuentaAbierta = mesa.cuentas_mesa?.find((c) => c.estado === "abierta");
          return (
            <Card
              key={mesa.id}
              className={`flex flex-col justify-between ${!activa ? "opacity-60" : ""}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{mesa.nombre}</h3>
                  <div className="flex flex-col items-end gap-1">
                    <Badge color={mesa.estado === "libre" ? "success" : "warning"}>
                      {mesa.estado}
                    </Badge>
                    <Badge color={activa ? "info" : "danger"}>
                      {activa ? "Activa" : "Off"}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-stone-500">{mesa.zona}</p>
                {cuentaAbierta && (
                  <p className="mt-2 text-xs text-orange-700">Cuenta abierta</p>
                )}
                {mesa.qr_habilitado && activa && (
                  <MesaQrLink mesaId={mesa.id} mesaNombre={mesa.nombre} />
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 gap-1"
                  onClick={() => void toggleActiva(mesa)}
                  title={activa ? "Desactivar" : "Activar"}
                >
                  {activa ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  {activa ? "Desactivar" : "Activar"}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => void eliminar(mesa)}
                  title="Eliminar"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
