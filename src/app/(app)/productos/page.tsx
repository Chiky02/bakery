"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Categoria, Producto } from "@/types";
import { formatCOP } from "@/lib/format";
import { useBakeryId } from "@/lib/use-bakery-id";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EyeOff, Eye, Pencil, Trash2, Cake } from "lucide-react";

type ProductForm = {
  id?: string;
  nombre: string;
  precio: string;
  categoria_id: string;
  disponible: boolean;
  encargable: boolean;
  orden: string;
  codigo_barras: string;
};

const emptyProduct = (categoriaId = ""): ProductForm => ({
  nombre: "",
  precio: "",
  categoria_id: categoriaId,
  disponible: true,
  encargable: false,
  orden: "0",
  codigo_barras: "",
});

export default function ProductosPage() {
  const { panaderiaId } = useBakeryId();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"productos" | "categorias">("productos");
  const [form, setForm] = useState<ProductForm>(emptyProduct());
  const [catNombre, setCatNombre] = useState("");
  const [catMedida, setCatMedida] = useState("unidad");
  const [editingCat, setEditingCat] = useState<Categoria | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!panaderiaId) return;
    const supabase = createClient();
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase
        .from("categorias")
        .select("*")
        .eq("panaderia_id", panaderiaId)
        .order("orden"),
      supabase
        .from("productos")
        .select("*, categorias(*)")
        .eq("panaderia_id", panaderiaId)
        .order("orden"),
    ]);
    setCategorias((cats as Categoria[]) ?? []);
    const all = (prods as Producto[]) ?? [];
    setProductos(all.filter((p) => (p.tipo ?? "venta") !== "materia_prima"));
    if (!form.categoria_id && cats?.[0]) {
      setForm((f) => ({ ...f, categoria_id: cats[0].id }));
    }
  }

  useEffect(() => {
    load();
  }, [panaderiaId]);

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!panaderiaId || !form.nombre.trim() || !form.categoria_id) return;
    setError("");
    const supabase = createClient();
    const payload = {
      panaderia_id: panaderiaId,
      nombre: form.nombre.trim(),
      precio: Math.max(0, Math.round(Number(form.precio) || 0)),
      categoria_id: form.categoria_id,
      disponible: form.disponible,
      encargable: form.encargable,
      orden: Number(form.orden) || 0,
      codigo_barras: form.codigo_barras.trim() || null,
      tipo: "venta" as const,
      updated_at: new Date().toISOString(),
    };

    if (form.id) {
      const { error: err } = await supabase.from("productos").update(payload).eq("id", form.id);
      if (err) {
        if (err.message.includes("encargable")) {
          const { encargable: _e, ...without } = payload;
          const { error: err2 } = await supabase.from("productos").update(without).eq("id", form.id);
          if (err2) {
            setError(err2.message);
            return;
          }
        } else {
          setError(err.message);
          return;
        }
      }
      setMsg("Producto actualizado");
    } else {
      const { error: err } = await supabase.from("productos").insert(payload);
      if (err) {
        if (err.message.includes("encargable")) {
          const { encargable: _e, ...without } = payload;
          const { error: err2 } = await supabase.from("productos").insert(without);
          if (err2) {
            setError(err2.message);
            return;
          }
        } else {
          setError(err.message);
          return;
        }
      }
      setMsg("Producto creado");
    }
    setForm(emptyProduct(form.categoria_id));
    await load();
  }

  async function editProduct(p: Producto) {
    setForm({
      id: p.id,
      nombre: p.nombre,
      precio: String(p.precio),
      categoria_id: p.categoria_id,
      disponible: p.disponible,
      encargable: !!p.encargable,
      orden: String(p.orden),
      codigo_barras: p.codigo_barras ?? "",
    });
    setTab("productos");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteProduct(id: string) {
    if (!confirm("¿Eliminar este producto?")) return;
    const supabase = createClient();
    const { error: err } = await supabase.from("productos").delete().eq("id", id);
    if (err) {
      setError(err.message);
      return;
    }
    setMsg("Producto eliminado");
    await load();
  }

  async function toggleDisponible(id: string, disponible: boolean) {
    const supabase = createClient();
    await supabase.from("productos").update({ disponible: !disponible }).eq("id", id);
    await load();
  }

  async function toggleEncargable(id: string, encargable: boolean) {
    const supabase = createClient();
    const { error: err } = await supabase
      .from("productos")
      .update({ encargable: !encargable })
      .eq("id", id);
    if (err) {
      setError(
        err.message.includes("encargable")
          ? "Ejecuta la migración 20260907030000 (columna productos.encargable)"
          : err.message,
      );
      return;
    }
    await load();
  }

  async function saveCategoria(e: React.FormEvent) {
    e.preventDefault();
    if (!panaderiaId || !catNombre.trim()) return;
    setError("");
    const supabase = createClient();
    if (editingCat) {
      const { error: err } = await supabase
        .from("categorias")
        .update({ nombre: catNombre.trim(), medida: catMedida })
        .eq("id", editingCat.id);
      if (err) {
        setError(err.message);
        return;
      }
      setMsg("Categoría actualizada");
    } else {
      const { error: err } = await supabase.from("categorias").insert({
        panaderia_id: panaderiaId,
        nombre: catNombre.trim(),
        medida: catMedida,
        orden: categorias.length + 1,
      });
      if (err) {
        setError(err.message);
        return;
      }
      setMsg("Categoría creada");
    }
    setCatNombre("");
    setCatMedida("unidad");
    setEditingCat(null);
    await load();
  }

  async function deleteCategoria(id: string) {
    if (!confirm("¿Eliminar categoría? Debe estar sin productos.")) return;
    const supabase = createClient();
    const { error: err } = await supabase.from("categorias").delete().eq("id", id);
    if (err) {
      setError(err.message.includes("foreign") ? "Hay productos en esa categoría" : err.message);
      return;
    }
    setMsg("Categoría eliminada");
    await load();
  }

  const filtered = productos.filter(
    (p) =>
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      (p.codigo_barras ?? "").includes(search),
  );

  const byCat = filtered.reduce<Record<string, Producto[]>>((acc, p) => {
    const cat = p.categorias?.nombre ?? "Otros";
    (acc[cat] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-sm text-stone-500">CRUD de catálogo y categorías de esta panadería</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={tab === "productos" ? "primary" : "secondary"}
            onClick={() => setTab("productos")}
          >
            Productos
          </Button>
          <Button
            variant={tab === "categorias" ? "primary" : "secondary"}
            onClick={() => setTab("categorias")}
          >
            Categorías
          </Button>
        </div>
      </div>

      {(msg || error) && (
        <p className={`text-sm ${error ? "text-red-600" : "text-emerald-700"}`}>
          {error || msg}
        </p>
      )}

      {tab === "categorias" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3">
            <CardTitle>{editingCat ? "Editar categoría" : "Nueva categoría"}</CardTitle>
            <form onSubmit={saveCategoria} className="space-y-3">
              <Input
                placeholder="Nombre"
                value={catNombre}
                onChange={(e) => setCatNombre(e.target.value)}
                required
              />
              <Input
                placeholder="Medida (unidad, litro…)"
                value={catMedida}
                onChange={(e) => setCatMedida(e.target.value)}
              />
              <div className="flex gap-2">
                <Button type="submit">{editingCat ? "Guardar" : "Crear"}</Button>
                {editingCat && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingCat(null);
                      setCatNombre("");
                      setCatMedida("unidad");
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </Card>
          <Card>
            <CardTitle>Listado ({categorias.length})</CardTitle>
            <ul className="mt-3 divide-y dark:divide-stone-800">
              {categorias.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <p className="font-medium">{c.nombre}</p>
                    <p className="text-xs text-stone-500">{c.medida}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      title="Editar"
                      aria-label="Editar"
                      onClick={() => {
                        setEditingCat(c);
                        setCatNombre(c.nombre);
                        setCatMedida(c.medida);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      title="Borrar"
                      aria-label="Borrar"
                      onClick={() => deleteCategoria(c.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {tab === "productos" && (
        <>
          <Card className="space-y-3">
            <CardTitle>{form.id ? "Editar producto" : "Nuevo producto"}</CardTitle>
            <form onSubmit={saveProduct} className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Input
                placeholder="Nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
              <Input
                type="number"
                min={0}
                placeholder="Precio (COP)"
                value={form.precio}
                onChange={(e) => setForm({ ...form, precio: e.target.value })}
                required
              />
              <Input
                placeholder="Código de barras"
                value={form.codigo_barras}
                onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })}
              />
              <select
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm dark:border-stone-600 dark:bg-stone-800"
                value={form.categoria_id}
                onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}
                required
              >
                <option value="">Categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                placeholder="Orden"
                value={form.orden}
                onChange={(e) => setForm({ ...form, orden: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.disponible}
                  onChange={(e) => setForm({ ...form, disponible: e.target.checked })}
                />
                Disponible
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.encargable}
                  onChange={(e) => setForm({ ...form, encargable: e.target.checked })}
                />
                Encargable (tortas / especiales)
              </label>
              <div className="flex gap-2">
                <Button type="submit">{form.id ? "Actualizar" : "Crear"}</Button>
                {form.id && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setForm(emptyProduct(categorias[0]?.id ?? ""))}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </form>
          </Card>

          <Input
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {Object.entries(byCat).map(([cat, items]) => (
            <Card key={cat}>
              <CardTitle>{cat}</CardTitle>
              <ul className="mt-4 divide-y dark:divide-stone-800">
                {items.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium">{p.nombre}</p>
                      <p className="text-sm text-stone-500">
                        {formatCOP(p.precio)}
                        {p.codigo_barras ? ` · ${p.codigo_barras}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge color={p.disponible ? "success" : "danger"}>
                        {p.disponible ? "Disponible" : "Agotado"}
                      </Badge>
                      {p.encargable && <Badge color="info">Encargable</Badge>}
                      <Button
                        size="sm"
                        variant="secondary"
                        title={p.disponible ? "Agotar" : "Disponible"}
                        aria-label={p.disponible ? "Agotar" : "Disponible"}
                        onClick={() => toggleDisponible(p.id, p.disponible)}
                      >
                        {p.disponible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant={p.encargable ? "primary" : "secondary"}
                        title={p.encargable ? "Quitar encargable" : "Marcar encargable"}
                        aria-label="Encargable"
                        onClick={() => toggleEncargable(p.id, !!p.encargable)}
                      >
                        <Cake className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        title="Editar"
                        aria-label="Editar"
                        onClick={() => editProduct(p)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        title="Borrar"
                        aria-label="Borrar"
                        onClick={() => deleteProduct(p.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
