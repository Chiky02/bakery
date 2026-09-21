"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Categoria, Producto } from "@/types";
import { formatCOP } from "@/lib/format";
import { useBakery, useBakeryId } from "@/lib/use-bakery-id";
import { hasPermiso } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EyeOff, Eye, Pencil, Trash2, Cake } from "lucide-react";

const PAGE_SIZE = 20;

type Tab = "listado" | "crear" | "categorias";
type TriFilter = "" | "si" | "no";

type ProductForm = {
  id?: string;
  nombre: string;
  precio: string;
  categoria_id: string;
  disponible: boolean;
  encargable: boolean;
  control_stock: boolean;
  stock: string;
  stock_minimo: string;
  orden: string;
  codigo_barras: string;
};

const emptyProduct = (categoriaId = ""): ProductForm => ({
  nombre: "",
  precio: "",
  categoria_id: categoriaId,
  disponible: true,
  encargable: false,
  control_stock: false,
  stock: "0",
  stock_minimo: "0",
  orden: "0",
  codigo_barras: "",
});

const selectClass =
  "rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";

export default function ProductosPage() {
  const { panaderiaId } = useBakeryId();
  const { permisos, rol } = useBakery();
  const canList = hasPermiso("productos", permisos, rol);
  const canCreate = hasPermiso("productos_crear", permisos, rol);
  const canCategorias = hasPermiso("productos_categorias", permisos, rol);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [search, setSearch] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [disponibleFiltro, setDisponibleFiltro] = useState<TriFilter>("");
  const [encargableFiltro, setEncargableFiltro] = useState<TriFilter>("");
  const [stockFiltro, setStockFiltro] = useState<TriFilter>("");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>(canList ? "listado" : canCreate ? "crear" : "categorias");
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

  useEffect(() => {
    setPage(1);
  }, [search, categoriaFiltro, disponibleFiltro, encargableFiltro, stockFiltro]);

  function clearFeedback() {
    setMsg("");
    setError("");
  }

  function goCrear(reset = true) {
    clearFeedback();
    if (reset) setForm(emptyProduct(categorias[0]?.id ?? form.categoria_id));
    setTab("crear");
  }

  function goListado() {
    clearFeedback();
    setTab("listado");
  }

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
      control_stock: form.control_stock,
      stock: Number(form.stock) || 0,
      stock_minimo: Number(form.stock_minimo) || 0,
      orden: Number(form.orden) || 0,
      codigo_barras: form.codigo_barras.trim() || null,
      tipo: "venta" as const,
      updated_at: new Date().toISOString(),
    };

    async function persist(
      op: "update" | "insert",
      data: typeof payload,
    ): Promise<string | null> {
      const res =
        op === "update"
          ? await supabase.from("productos").update(data).eq("id", form.id!)
          : await supabase.from("productos").insert(data);
      if (!res.error) return null;
      if (
        res.error.message.includes("encargable") ||
        res.error.message.includes("control_stock") ||
        res.error.message.includes("stock_minimo") ||
        res.error.message.includes("stock")
      ) {
        const {
          encargable: _e,
          control_stock: _c,
          stock: _s,
          stock_minimo: _m,
          ...without
        } = data;
        const res2 =
          op === "update"
            ? await supabase.from("productos").update(without).eq("id", form.id!)
            : await supabase.from("productos").insert(without);
        return res2.error?.message ?? null;
      }
      return res.error.message;
    }

    if (form.id) {
      const errMsg = await persist("update", payload);
      if (errMsg) {
        setError(errMsg);
        return;
      }
      setMsg("Producto actualizado");
    } else {
      const errMsg = await persist("insert", payload);
      if (errMsg) {
        setError(errMsg);
        return;
      }
      setMsg("Producto creado");
    }
    setForm(emptyProduct(form.categoria_id));
    await load();
    setTab("listado");
  }

  function editProduct(p: Producto) {
    clearFeedback();
    setForm({
      id: p.id,
      nombre: p.nombre,
      precio: String(p.precio),
      categoria_id: p.categoria_id,
      disponible: p.disponible,
      encargable: !!p.encargable,
      control_stock: !!p.control_stock,
      stock: String(p.stock ?? 0),
      stock_minimo: String(p.stock_minimo ?? 0),
      orden: String(p.orden),
      codigo_barras: p.codigo_barras ?? "",
    });
    setTab("crear");
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productos.filter((p) => {
      if (categoriaFiltro && p.categoria_id !== categoriaFiltro) return false;
      if (disponibleFiltro === "si" && !p.disponible) return false;
      if (disponibleFiltro === "no" && p.disponible) return false;
      if (encargableFiltro === "si" && !p.encargable) return false;
      if (encargableFiltro === "no" && p.encargable) return false;
      if (stockFiltro === "si" && !p.control_stock) return false;
      if (stockFiltro === "no" && p.control_stock) return false;
      if (!q) return true;
      return (
        p.nombre.toLowerCase().includes(q) || (p.codigo_barras ?? "").includes(search.trim())
      );
    });
  }, [
    productos,
    search,
    categoriaFiltro,
    disponibleFiltro,
    encargableFiltro,
    stockFiltro,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const hasActiveFilters =
    !!search ||
    !!categoriaFiltro ||
    !!disponibleFiltro ||
    !!encargableFiltro ||
    !!stockFiltro;

  function clearFilters() {
    setSearch("");
    setCategoriaFiltro("");
    setDisponibleFiltro("");
    setEncargableFiltro("");
    setStockFiltro("");
  }

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "listado", label: "Listado", show: canList },
    { id: "crear", label: form.id ? "Editar" : "Crear", show: canCreate },
    { id: "categorias", label: "Categorías", show: canCategorias },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-sm text-stone-500">
            Catálogo de venta: crea en un apartado y consulta con filtros en otro
          </p>
        </div>
        {tab === "listado" && canCreate && (
          <Button type="button" onClick={() => goCrear(true)}>
            Nuevo producto
          </Button>
        )}
      </div>

      <div className="flex gap-2 border-b border-stone-200 pb-px">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              if (t.id === "crear") goCrear(!form.id);
              else if (t.id === "listado") goListado();
              else {
                clearFeedback();
                setTab("categorias");
              }
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

      {(msg || error) && (
        <p className={`text-sm ${error ? "text-red-600" : "text-emerald-700"}`}>
          {error || msg}
        </p>
      )}

      {tab === "categorias" && canCategorias && (
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
            <ul className="mt-3 divide-y ">
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

      {tab === "crear" && canCreate && (
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
              className={selectClass}
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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.control_stock}
                onChange={(e) => setForm({ ...form, control_stock: e.target.checked })}
              />
              Controlar stock
            </label>
            {form.control_stock && (
              <>
                <Input
                  type="number"
                  step="0.001"
                  placeholder="Stock actual"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
                <Input
                  type="number"
                  step="0.001"
                  placeholder="Stock mínimo (alerta)"
                  value={form.stock_minimo}
                  onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })}
                />
              </>
            )}
            <div className="flex flex-wrap gap-2 md:col-span-2 lg:col-span-3">
              <Button type="submit">{form.id ? "Actualizar" : "Crear"}</Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setForm(emptyProduct(categorias[0]?.id ?? ""));
                  goListado();
                }}
              >
                Volver al listado
              </Button>
            </div>
          </form>
        </Card>
      )}

      {tab === "listado" && canList && (
        <>
          <Card className="space-y-3">
            <CardTitle>Filtros</CardTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <Input
                className="sm:col-span-2 lg:col-span-1 xl:col-span-2"
                placeholder="Buscar nombre o código…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className={selectClass}
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                aria-label="Filtrar por categoría"
              >
                <option value="">Todas las categorías</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <select
                className={selectClass}
                value={disponibleFiltro}
                onChange={(e) => setDisponibleFiltro(e.target.value as TriFilter)}
                aria-label="Filtrar por disponibilidad"
              >
                <option value="">Disponibilidad: todas</option>
                <option value="si">Solo disponibles</option>
                <option value="no">Solo agotados</option>
              </select>
              <select
                className={selectClass}
                value={encargableFiltro}
                onChange={(e) => setEncargableFiltro(e.target.value as TriFilter)}
                aria-label="Filtrar por encargable"
              >
                <option value="">Encargable: todos</option>
                <option value="si">Solo encargables</option>
                <option value="no">No encargables</option>
              </select>
              <select
                className={selectClass}
                value={stockFiltro}
                onChange={(e) => setStockFiltro(e.target.value as TriFilter)}
                aria-label="Filtrar por control de stock"
              >
                <option value="">Stock: todos</option>
                <option value="si">Con control de stock</option>
                <option value="no">Sin control de stock</option>
              </select>
            </div>
            {hasActiveFilters && (
              <div className="flex justify-end">
                <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              </div>
            )}
          </Card>

          <Card>
            <CardTitle>
              Productos ({filtered.length}
              {filtered.length !== productos.length ? ` de ${productos.length}` : ""})
            </CardTitle>
            <ul className="mt-4 divide-y">
              {pageItems.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{p.nombre}</p>
                    <p className="text-sm text-stone-500">
                      {p.categorias?.nombre ?? "Sin categoría"} · {formatCOP(p.precio)}
                      {p.codigo_barras ? ` · ${p.codigo_barras}` : ""}
                      {p.control_stock ? ` · stock ${p.stock ?? 0}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Badge color={p.disponible ? "success" : "danger"}>
                      {p.disponible ? "Disponible" : "Agotado"}
                    </Badge>
                    {p.encargable && <Badge color="info">Encargable</Badge>}
                    {p.control_stock && <Badge color="warning">Stock</Badge>}
                    {canCreate && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          title={p.disponible ? "Agotar" : "Disponible"}
                          aria-label={p.disponible ? "Agotar" : "Disponible"}
                          onClick={() => toggleDisponible(p.id, p.disponible)}
                        >
                          {p.disponible ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
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
                      </>
                    )}
                  </div>
                </li>
              ))}
              {pageItems.length === 0 && (
                <li className="py-4 text-sm text-stone-500">
                  {productos.length === 0
                    ? "Aún no hay productos. Crea el primero en la pestaña Crear."
                    : "Ningún producto coincide con los filtros."}
                </li>
              )}
            </ul>

            {totalPages > 1 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
                <p className="text-xs text-stone-500">
                  Página {currentPage} de {totalPages} · {PAGE_SIZE} por página
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={currentPage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
