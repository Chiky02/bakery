"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBakeryId } from "@/lib/use-bakery-id";
import type { Producto } from "@/types";
import { formatCOP, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Mov = {
  id: string;
  tipo: string;
  cantidad: number;
  stock_despues: number;
  notas?: string | null;
  created_at: string;
  producto_id: string;
  productos?: { nombre?: string } | null;
};

export function InventarioClient({
  initialProductos,
}: {
  initialProductos: Producto[];
}) {
  const { panaderiaId } = useBakeryId();
  const [productos, setProductos] = useState(initialProductos);
  const [q, setQ] = useState("");
  const [soloBajos, setSoloBajos] = useState(false);
  const [msg, setMsg] = useState("");
  const [ajusteId, setAjusteId] = useState<string | null>(null);
  const [ajusteQty, setAjusteQty] = useState("");
  const [ajusteNotas, setAjusteNotas] = useState("");
  const [minId, setMinId] = useState<string | null>(null);
  const [minVal, setMinVal] = useState("");
  const [movs, setMovs] = useState<Mov[]>([]);
  const [kardexProducto, setKardexProducto] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return productos.filter((p) => {
      if (!p.control_stock) return false;
      if (soloBajos && Number(p.stock ?? 0) > Number(p.stock_minimo ?? 0)) return false;
      if (!term) return true;
      return (
        p.nombre.toLowerCase().includes(term) ||
        (p.codigo_barras ?? "").includes(term)
      );
    });
  }, [productos, q, soloBajos]);

  const bajos = useMemo(
    () =>
      productos.filter(
        (p) =>
          p.control_stock && Number(p.stock ?? 0) <= Number(p.stock_minimo ?? 0),
      ),
    [productos],
  );

  async function reload() {
    if (!panaderiaId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("productos")
      .select("*, categorias(nombre)")
      .eq("panaderia_id", panaderiaId)
      .eq("control_stock", true)
      .order("nombre");
    setProductos((data as Producto[]) ?? []);
  }

  async function loadKardex(productoId?: string) {
    if (!panaderiaId) return;
    const supabase = createClient();
    let query = supabase
      .from("stock_movimientos")
      .select("id, tipo, cantidad, stock_despues, notas, created_at, producto_id, productos(nombre)")
      .eq("panaderia_id", panaderiaId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (productoId) query = query.eq("producto_id", productoId);
    const { data } = await query;
    setMovs((data as Mov[]) ?? []);
  }

  useEffect(() => {
    void loadKardex();
  }, [panaderiaId]);

  async function aplicarAjuste() {
    if (!ajusteId) return;
    const qty = Number(ajusteQty);
    if (!Number.isFinite(qty) || qty === 0) {
      setMsg("Indica una cantidad distinta de 0 (+ entrada / − salida)");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.rpc("ajustar_stock", {
      p_producto: ajusteId,
      p_cantidad: qty,
      p_tipo: qty > 0 ? "entrada" : "ajuste",
      p_notas: ajusteNotas.trim() || "Ajuste inventario",
    });
    if (error) {
      setMsg(error.message);
      return;
    }
    setAjusteId(null);
    setAjusteQty("");
    setAjusteNotas("");
    setMsg("Stock actualizado");
    await reload();
    await loadKardex(kardexProducto || undefined);
  }

  async function guardarMinimo() {
    if (!minId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("productos")
      .update({ stock_minimo: Number(minVal) || 0 })
      .eq("id", minId);
    if (error) {
      setMsg(
        /stock_minimo/i.test(error.message)
          ? "Aplica la migración (npm run db:push) para stock mínimo"
          : error.message,
      );
      return;
    }
    setMinId(null);
    setMsg("Stock mínimo guardado");
    await reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventario</h1>
        <p className="text-sm text-stone-500">
          Stock controlado, alertas de mínimo y kardex de movimientos
        </p>
      </div>

      {msg && <p className="text-sm text-orange-700">{msg}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-stone-500">Con control de stock</p>
          <p className="text-2xl font-bold">{productos.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">En o bajo mínimo</p>
          <p className="text-2xl font-bold text-amber-700">{bajos.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Movimientos recientes</p>
          <p className="text-2xl font-bold">{movs.length}</p>
        </Card>
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <label className="text-xs font-medium">Buscar</label>
            <Input
              className="mt-1"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre o código…"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={soloBajos}
              onChange={(e) => setSoloBajos(e.target.checked)}
            />
            Solo bajos
          </label>
        </div>

        <ul className="divide-y">
          {filtered.map((p) => {
            const stock = Number(p.stock ?? 0);
            const min = Number(p.stock_minimo ?? 0);
            const bajo = stock <= min;
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{p.nombre}</p>
                  <p className="text-xs text-stone-500">
                    {p.tipo === "materia_prima" ? "Insumo" : "Venta"}
                    {p.codigo_barras ? ` · ${p.codigo_barras}` : ""}
                    {p.precio ? ` · ${formatCOP(p.precio)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color={bajo ? "warning" : "success"}>
                    Stock {stock}
                    {min > 0 ? ` / mín ${min}` : ""}
                  </Badge>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setKardexProducto(p.id);
                      void loadKardex(p.id);
                    }}
                  >
                    Kardex
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setMinId(p.id);
                      setMinVal(String(p.stock_minimo ?? 0));
                    }}
                  >
                    Mínimo
                  </Button>
                  <Button size="sm" onClick={() => setAjusteId(p.id)}>
                    Ajustar
                  </Button>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="py-4 text-stone-500">
              No hay productos con control de stock
              {soloBajos ? " bajo el mínimo" : ""}. Actívalo en Productos o Insumos.
            </li>
          )}
        </ul>
      </Card>

      {ajusteId && (
        <Card className="space-y-3">
          <CardTitle>Ajuste de stock</CardTitle>
          <p className="text-xs text-stone-500">
            Positivo = entrada · Negativo = salida/ajuste (ej. −2)
          </p>
          <Input
            type="text"
            inputMode="decimal"
            placeholder="Cantidad (+/−)"
            value={ajusteQty}
            onChange={(e) => setAjusteQty(e.target.value.replace(",", "."))}
          />
          <Input
            placeholder="Motivo (opcional)"
            value={ajusteNotas}
            onChange={(e) => setAjusteNotas(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={() => void aplicarAjuste()}>Aplicar</Button>
            <Button variant="ghost" onClick={() => setAjusteId(null)}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {minId && (
        <Card className="space-y-3">
          <CardTitle>Stock mínimo (alerta)</CardTitle>
          <Input
            type="text"
            inputMode="decimal"
            value={minVal}
            onChange={(e) => setMinVal(e.target.value.replace(",", "."))}
          />
          <div className="flex gap-2">
            <Button onClick={() => void guardarMinimo()}>Guardar</Button>
            <Button variant="ghost" onClick={() => setMinId(null)}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Kardex reciente</CardTitle>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setKardexProducto("");
              void loadKardex();
            }}
          >
            Ver todos
          </Button>
        </div>
        <ul className="mt-3 max-h-96 divide-y overflow-y-auto text-sm">
          {movs.map((m) => (
            <li key={m.id} className="py-2">
              <div className="flex justify-between gap-2">
                <span className="font-medium">
                  {m.productos?.nombre ?? "Producto"}
                </span>
                <span className={Number(m.cantidad) < 0 ? "text-red-600" : "text-emerald-700"}>
                  {Number(m.cantidad) > 0 ? "+" : ""}
                  {m.cantidad} · queda {m.stock_despues}
                </span>
              </div>
              <p className="text-xs text-stone-400">
                {m.tipo} · {formatDateTime(m.created_at)}
                {m.notas ? ` · ${m.notas}` : ""}
              </p>
            </li>
          ))}
          {movs.length === 0 && (
            <li className="py-3 text-stone-500">Sin movimientos aún</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
