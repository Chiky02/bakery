"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Encargo } from "@/types";
import { formatCOP, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const ESTADO_COLOR: Record<string, "warning" | "success" | "info" | "danger"> = {
  pendiente: "warning",
  entregado: "info",
  cobrado: "success",
  cancelado: "danger",
};

export default function EncargosPage() {
  const [encargos, setEncargos] = useState<Encargo[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    descripcion: "",
    cliente_nombre: "",
    cliente_telefono: "",
    fecha_entrega: "",
    valor: "",
    notas: "",
  });

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("encargos")
      .select("*")
      .order("fecha_entrega");
    setEncargos((data as Encargo[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/encargos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        valor: parseInt(form.valor, 10),
      }),
    });
    setForm({
      descripcion: "",
      cliente_nombre: "",
      cliente_telefono: "",
      fecha_entrega: "",
      valor: "",
      notas: "",
    });
    setShowForm(false);
    load();
  }

  async function cambiarEstado(id: string, estado: string) {
    await fetch(`/api/encargos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    load();
  }

  const proximos = encargos.filter((e) => e.estado === "pendiente");
  const otros = encargos.filter((e) => e.estado !== "pendiente");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Encargos y pedidos especiales</h1>
          <p className="text-sm text-stone-500">Fechas de entrega y seguimiento</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancelar" : "Nuevo encargo"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardTitle>Nuevo encargo</CardTitle>
          <form onSubmit={crear} className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Descripción (ej: Torta 3 leches 20 pers.)"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              required
              className="sm:col-span-2"
            />
            <Input
              placeholder="Cliente"
              value={form.cliente_nombre}
              onChange={(e) => setForm({ ...form, cliente_nombre: e.target.value })}
            />
            <Input
              placeholder="Teléfono"
              value={form.cliente_telefono}
              onChange={(e) => setForm({ ...form, cliente_telefono: e.target.value })}
            />
            <Input
              type="date"
              value={form.fecha_entrega}
              onChange={(e) => setForm({ ...form, fecha_entrega: e.target.value })}
              required
            />
            <Input
              type="number"
              placeholder="Valor"
              value={form.valor}
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
              required
            />
            <Input
              placeholder="Notas"
              value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              className="sm:col-span-2"
            />
            <Button type="submit" className="sm:col-span-2">
              Guardar encargo
            </Button>
          </form>
        </Card>
      )}

      <Card>
        <CardTitle>Próximas entregas</CardTitle>
        {proximos.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">Sin encargos pendientes</p>
        ) : (
          <ul className="mt-4 divide-y">
            {proximos.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-4">
                <div>
                  <p className="font-medium">{e.descripcion}</p>
                  <p className="text-sm text-stone-500">
                    {e.cliente_nombre} · {formatDate(e.fecha_entrega)}
                  </p>
                  <p className="font-semibold text-amber-700">{formatCOP(e.valor)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => cambiarEstado(e.id, "entregado")}>
                    Entregado
                  </Button>
                  <Button size="sm" onClick={() => cambiarEstado(e.id, "cobrado")}>
                    Cobrado
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {otros.length > 0 && (
        <Card>
          <CardTitle>Historial</CardTitle>
          <ul className="mt-4 divide-y">
            {otros.map((e) => (
              <li key={e.id} className="flex justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{e.descripcion}</p>
                  <p className="text-stone-500">{e.cliente_nombre}</p>
                </div>
                <div className="text-right">
                  <Badge color={ESTADO_COLOR[e.estado]}>{e.estado}</Badge>
                  <p className="mt-1">{formatCOP(e.valor)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
