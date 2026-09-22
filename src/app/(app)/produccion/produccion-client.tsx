"use client";

import { useCallback, useEffect, useState } from "react";
import { hasPermiso } from "@/lib/permissions";
import { useBakery } from "@/lib/use-bakery-id";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type ProdRow = {
  id: string;
  nombre: string;
  stock?: number | null;
};

type Registro = {
  id: string;
  cantidad: number;
  notas?: string | null;
  created_at: string;
  productos?: { nombre?: string } | null;
};

type Insumo = { id: string; nombre: string; stock?: number | null };

type RecetaLine = { insumo_id: string; cantidad_por_unidad: string };

type Tab = "registrar" | "historial" | "receta";

export function ProduccionClient() {
  const { permisos, rol } = useBakery();
  const canCreate = hasPermiso("produccion_crear", permisos, rol);
  const canRecipes = hasPermiso("produccion_recetas", permisos, rol);

  const [tab, setTab] = useState<Tab>(canCreate ? "registrar" : "historial");
  const [productos, setProductos] = useState<ProdRow[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [notas, setNotas] = useState("");
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [lineas, setLineas] = useState<RecetaLine[]>([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/produccion");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "No se pudo cargar producción");
      return;
    }
    setProductos(body.productos ?? []);
    setRegistros(body.registros ?? []);
    setProductoId((prev) => prev || body.productos?.[0]?.id || "");
  }, []);

  const loadReceta = useCallback(async (id: string) => {
    if (!id) {
      setLineas([]);
      setInsumos([]);
      return;
    }
    const res = await fetch(`/api/produccion/recetas?producto_id=${encodeURIComponent(id)}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "No se pudo cargar la receta");
      return;
    }
    setInsumos(body.insumos ?? []);
    const items = (body.items ?? []) as { insumo_id: string; cantidad_por_unidad: number }[];
    setLineas(
      items.length
        ? items.map((i) => ({
            insumo_id: i.insumo_id,
            cantidad_por_unidad: String(i.cantidad_por_unidad),
          }))
        : [{ insumo_id: "", cantidad_por_unidad: "" }],
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === "receta" && productoId) void loadReceta(productoId);
  }, [tab, productoId, loadReceta]);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    setError("");
    setMsg("");
    setLoading(true);
    const res = await fetch("/api/produccion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        producto_id: productoId,
        cantidad: Number(cantidad),
        notas: notas.trim() || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "No se pudo registrar");
      return;
    }
    setCantidad("");
    setNotas("");
    setMsg("Producción registrada. El stock del producto ya subió.");
    await load();
    setTab("historial");
  }

  async function guardarReceta(e: React.FormEvent) {
    e.preventDefault();
    if (!canRecipes || !productoId) return;
    setError("");
    setMsg("");
    const items = lineas
      .filter((l) => l.insumo_id && Number(l.cantidad_por_unidad) > 0)
      .map((l) => ({
        insumo_id: l.insumo_id,
        cantidad_por_unidad: Number(l.cantidad_por_unidad),
      }));
    setLoading(true);
    const res = await fetch("/api/produccion/recetas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ producto_id: productoId, items }),
    });
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "No se pudo guardar la receta");
      return;
    }
    setMsg("Receta guardada. Al producir se descontarán estos insumos.");
    await loadReceta(productoId);
  }

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "historial", label: "Historial", show: true },
    { id: "registrar", label: "Registrar", show: canCreate },
    { id: "receta", label: "Receta", show: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Producción</h1>
        <p className="text-sm text-stone-500">
          Pan, galletas y lo que se elabora en el local. Al registrar una tanda sube el stock del
          producto y, si hay receta, baja la materia prima.
        </p>
      </div>

      <div className="flex gap-2 border-b border-stone-200 pb-px">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setError("");
                setTab(t.id);
              }}
              className={
                tab === t.id
                  ? "border-b-2 border-orange-600 px-3 py-2 text-sm font-semibold text-orange-900"
                  : "px-3 py-2 text-sm font-medium text-stone-500 hover:text-stone-800"
              }
            >
              {t.label}
            </button>
          ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-emerald-700">{msg}</p>}

      {tab === "registrar" && canCreate && (
        <Card className="space-y-3">
          <CardTitle>Registrar tanda</CardTitle>
          {productos.length === 0 ? (
            <p className="text-sm text-stone-500">
              No hay productos marcados como “se produce en el local”. Márcalos en Productos.
            </p>
          ) : (
            <form onSubmit={registrar} className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Producto</label>
                <select
                  className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                  value={productoId}
                  onChange={(e) => setProductoId(e.target.value)}
                  required
                >
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                      {p.stock != null ? ` · stock ${p.stock}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Cantidad producida</label>
                <Input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Notas</label>
                <Input
                  placeholder="Turno mañana, horno 2…"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading} className="sm:col-span-2 w-fit">
                {loading ? "Registrando…" : "Registrar y subir stock"}
              </Button>
            </form>
          )}
        </Card>
      )}

      {tab === "historial" && (
        <Card>
          <CardTitle>Tandas recientes</CardTitle>
          {registros.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">Aún no hay producción registrada.</p>
          ) : (
            <ul className="mt-3 divide-y text-sm">
              {registros.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium">{r.productos?.nombre ?? "Producto"}</p>
                    <p className="text-xs text-stone-500">
                      {new Date(r.created_at).toLocaleString("es-CO", {
                        timeZone: "America/Bogota",
                      })}
                      {r.notas ? ` · ${r.notas}` : ""}
                    </p>
                  </div>
                  <Badge color="success">+{r.cantidad}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "receta" && (
        <Card className="space-y-3">
          <CardTitle>Receta por unidad</CardTitle>
          <p className="text-sm text-stone-500">
            Cantidad de cada insumo que se gasta por 1 unidad producida. Si no hay receta, solo sube
            el stock del producto.
          </p>
          {productos.length === 0 ? (
            <p className="text-sm text-stone-500">Primero marca productos como producibles.</p>
          ) : (
            <form onSubmit={guardarReceta} className="space-y-3">
              <select
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                value={productoId}
                onChange={(e) => setProductoId(e.target.value)}
              >
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              {lineas.map((line, idx) => (
                <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
                  <select
                    className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                    value={line.insumo_id}
                    disabled={!canRecipes}
                    onChange={(e) => {
                      const next = [...lineas];
                      next[idx] = { ...line, insumo_id: e.target.value };
                      setLineas(next);
                    }}
                  >
                    <option value="">Insumo</option>
                    {insumos.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.nombre}
                        {i.stock != null ? ` · stock ${i.stock}` : ""}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    placeholder="Por unidad"
                    value={line.cantidad_por_unidad}
                    disabled={!canRecipes}
                    onChange={(e) => {
                      const next = [...lineas];
                      next[idx] = { ...line, cantidad_por_unidad: e.target.value };
                      setLineas(next);
                    }}
                  />
                  {canRecipes && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setLineas(lineas.filter((_, i) => i !== idx))}
                    >
                      Quitar
                    </Button>
                  )}
                </div>
              ))}
              {canRecipes && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      setLineas([...lineas, { insumo_id: "", cantidad_por_unidad: "" }])
                    }
                  >
                    Agregar insumo
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Guardando…" : "Guardar receta"}
                  </Button>
                </div>
              )}
              {!canRecipes && (
                <p className="text-xs text-stone-500">Puedes consultar la receta, no editarla.</p>
              )}
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
