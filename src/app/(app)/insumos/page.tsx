"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Categoria, Producto } from "@/types";
import { useBakeryId } from "@/lib/use-bakery-id";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function InsumosPage() {
  const { panaderiaId } = useBakeryId();
  const [items, setItems] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState("");
  const [barras, setBarras] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    if (!panaderiaId) return;
    const supabase = createClient();
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from("categorias").select("*").eq("panaderia_id", panaderiaId).order("nombre"),
      supabase
        .from("productos")
        .select("*, categorias(*)")
        .eq("panaderia_id", panaderiaId)
        .eq("tipo", "materia_prima")
        .order("nombre"),
    ]);
    setCategorias((cats as Categoria[]) ?? []);
    setItems((prods as Producto[]) ?? []);
    if (!categoriaId && cats?.[0]) setCategoriaId(cats[0].id);
  }

  useEffect(() => {
    load();
  }, [panaderiaId]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!panaderiaId || !nombre.trim() || !categoriaId) return;
    const supabase = createClient();
    const { error } = await supabase.from("productos").insert({
      panaderia_id: panaderiaId,
      nombre: nombre.trim(),
      categoria_id: categoriaId,
      precio: 0,
      disponible: true,
      tipo: "materia_prima",
      codigo_barras: barras.trim() || null,
      orden: 0,
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    setNombre("");
    setBarras("");
    setMsg("Insumo creado (solo visible para bodega/admin)");
    load();
  }

  async function borrar(id: string) {
    if (!confirm("¿Eliminar insumo?")) return;
    const supabase = createClient();
    await supabase.from("productos").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Materia prima</h1>
        <p className="text-sm text-stone-500">
          Harina, huevos, levadura, masa… No aparece en menú QR ni al mesero.
        </p>
      </div>

      <Card className="w-full space-y-3">
        <CardTitle>Nuevo insumo</CardTitle>
        <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Nombre (ej. Harina 50kg)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
          <Input
            placeholder="Código de barras"
            value={barras}
            onChange={(e) => setBarras(e.target.value)}
          />
          <select
            className="rounded-lg border px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-900 lg:col-span-1"
            value={categoriaId}
            onChange={(e) => setCategoriaId(e.target.value)}
          >
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <Button type="submit">Guardar</Button>
        </form>
        {msg && <p className="text-sm text-stone-500">{msg}</p>}
      </Card>

      <Card>
        <CardTitle>Inventario de insumos ({items.length})</CardTitle>
        <ul className="mt-3 divide-y dark:divide-stone-800">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium">{i.nombre}</p>
                <p className="text-xs text-stone-500">
                  {i.categorias?.nombre}
                  {i.codigo_barras ? ` · ${i.codigo_barras}` : ""}
                </p>
              </div>
              <Button size="sm" variant="danger" onClick={() => borrar(i.id)}>
                Borrar
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
