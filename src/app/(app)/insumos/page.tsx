"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Categoria, Producto } from "@/types";
import { useBakeryId } from "@/lib/use-bakery-id";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function InsumosPage() {
  const { panaderiaId } = useBakeryId();
  const [items, setItems] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState("");
  const [barras, setBarras] = useState("");
  const [stock, setStock] = useState("0");
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
    const payload = {
      panaderia_id: panaderiaId,
      nombre: nombre.trim(),
      categoria_id: categoriaId,
      precio: 0,
      disponible: true,
      tipo: "materia_prima" as const,
      codigo_barras: barras.trim() || null,
      orden: 0,
      control_stock: true,
      stock: Number(stock) || 0,
    };
    let { error } = await supabase.from("productos").insert(payload);
    if (error && (error.message.includes("control_stock") || error.message.includes("stock"))) {
      const { control_stock: _c, stock: _s, ...without } = payload;
      ({ error } = await supabase.from("productos").insert(without));
    }
    if (error) {
      setMsg(error.message);
      return;
    }
    setNombre("");
    setBarras("");
    setStock("0");
    setMsg("Insumo creado con control de stock");
    load();
  }

  async function ajustar(id: string, delta: number) {
    const supabase = createClient();
    const { error } = await supabase.rpc("ajustar_stock", {
      p_producto: id,
      p_cantidad: delta,
      p_tipo: delta >= 0 ? "entrada" : "ajuste",
      p_notas: "Ajuste manual insumos",
    });
    if (error) {
      setMsg(
        error.message.includes("ajustar_stock")
          ? "Aplica la migración (npm run db:push) para stock"
          : error.message,
      );
      return;
    }
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
          Harina, huevos, levadura, masa… No aparece en menú QR ni al mesero. Las recepciones
          suman stock automáticamente.
        </p>
      </div>

      <Card className="w-full space-y-3">
        <CardTitle>Nuevo insumo</CardTitle>
        <form onSubmit={crear} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
          <Input
            type="number"
            step="0.001"
            placeholder="Stock inicial"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
          <select
            className="rounded-lg border px-3 py-2 text-sm"
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
        <ul className="mt-3 divide-y">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div>
                <p className="font-medium">{i.nombre}</p>
                <p className="text-xs text-stone-500">
                  {i.categorias?.nombre}
                  {i.codigo_barras ? ` · ${i.codigo_barras}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge color="info">Stock {i.stock ?? 0}</Badge>
                <Button size="sm" variant="secondary" onClick={() => ajustar(i.id, 1)}>
                  +1
                </Button>
                <Button size="sm" variant="secondary" onClick={() => ajustar(i.id, -1)}>
                  −1
                </Button>
                <Button size="sm" variant="danger" onClick={() => borrar(i.id)}>
                  Borrar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
