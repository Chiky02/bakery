"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCOP } from "@/lib/format";
import { bakeryDisplayName } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Phone } from "lucide-react";

type TortaOption = { id: string; nombre: string; precio: number };
type LocalOption = {
  id: string;
  nombre: string;
  nombre_publico?: string | null;
  slug: string;
  telefono?: string | null;
  direccion?: string | null;
};

export default function EncargarForm() {
  const searchParams = useSearchParams();
  const [locales, setLocales] = useState<LocalOption[]>([]);
  const [panaderiaId, setPanaderiaId] = useState<string | null>(null);
  const [brand, setBrand] = useState("");
  const [tortas, setTortas] = useState<TortaOption[]>([]);
  const [productoId, setProductoId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fecha, setFecha] = useState("");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");
  const [loadingLocales, setLoadingLocales] = useState(true);

  const loadProductos = useCallback(async (bakeryId: string) => {
    const supabase = createClient();
    const { data: marked, error: markErr } = await supabase
      .from("productos")
      .select("id, nombre, precio")
      .eq("panaderia_id", bakeryId)
      .eq("disponible", true)
      .eq("encargable", true)
      .order("nombre");

    if (!markErr && marked && marked.length > 0) {
      setTortas(marked);
      return;
    }

    const { data: cats } = await supabase
      .from("categorias")
      .select("id, nombre")
      .eq("panaderia_id", bakeryId)
      .ilike("nombre", "%torta%");

    let list: TortaOption[] = [];
    if (cats && cats.length > 0) {
      const { data } = await supabase
        .from("productos")
        .select("id, nombre, precio")
        .eq("panaderia_id", bakeryId)
        .eq("disponible", true)
        .in(
          "categoria_id",
          cats.map((c) => c.id),
        )
        .order("nombre");
      list = data ?? [];
    }
    if (list.length === 0) {
      const { data: all } = await supabase
        .from("productos")
        .select("id, nombre, precio")
        .eq("panaderia_id", bakeryId)
        .eq("disponible", true)
        .or("nombre.ilike.%torta%,nombre.ilike.%ponqué%,nombre.ilike.%milky%")
        .order("nombre");
      list = all ?? [];
    }
    setTortas(list);
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingLocales(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("panaderias")
        .select("id, nombre, nombre_publico, slug, telefono, direccion")
        .eq("activa", true)
        .order("nombre");
      const list = (data as LocalOption[]) ?? [];
      setLocales(list);
      setLoadingLocales(false);

      const q = searchParams.get("negocio");
      const fromQuery = q ? list.find((l) => l.slug === q) : null;
      const initial = fromQuery ?? (list.length === 1 ? list[0] : null);
      if (initial) {
        setPanaderiaId(initial.id);
        setBrand(bakeryDisplayName(initial));
        await loadProductos(initial.id);
      }
    })();
  }, [searchParams, loadProductos]);

  async function onSelectLocal(id: string) {
    setPanaderiaId(id || null);
    setProductoId("");
    setOk(false);
    setError("");
    const local = locales.find((l) => l.id === id);
    setBrand(local ? bakeryDisplayName(local) : "");
    if (id) await loadProductos(id);
    else setTortas([]);
  }

  const selected = tortas.find((t) => t.id === productoId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!panaderiaId) {
      setError("Elige el negocio al que quieres encargar");
      return;
    }
    setLoading(true);
    setError("");
    setOk(false);

    const desc =
      descripcion.trim() ||
      (selected ? `Encargo: ${selected.nombre}` : "");

    const res = await fetch("/api/public/encargos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        panaderia_id: panaderiaId,
        producto_id: productoId || null,
        descripcion: desc,
        cliente_nombre: cliente,
        cliente_telefono: telefono,
        fecha_entrega: fecha,
        valor: selected?.precio ?? 0,
        notas: notas || null,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo enviar el encargo");
      return;
    }
    setOk(true);
    setDescripcion("");
    setCliente("");
    setTelefono("");
    setFecha("");
    setNotas("");
    setProductoId("");
  }

  const selectedLocal = locales.find((l) => l.id === panaderiaId);

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-10 md:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-700">
        {brand || "Encargos"}
      </p>
      <h1 className="mt-3 text-3xl font-bold text-stone-900">Encargar torta</h1>
      <p className="mt-2 text-stone-600">
        Primero elige el negocio. Luego el producto y la fecha de entrega.
      </p>

      <form onSubmit={submit} className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-stone-700">
            Negocio / local
          </label>
          <select
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
            value={panaderiaId ?? ""}
            onChange={(e) => onSelectLocal(e.target.value)}
            required
            disabled={loadingLocales}
          >
            <option value="">
              {loadingLocales ? "Cargando locales..." : "— Elige un negocio —"}
            </option>
            {locales.map((l) => (
              <option key={l.id} value={l.id}>
                {bakeryDisplayName(l)}
              </option>
            ))}
          </select>
          {brand && <p className="mt-1 text-xs text-stone-500">Pedido para: {brand}</p>}
          {selectedLocal?.direccion && (
            <p className="mt-1 flex items-start gap-1.5 text-xs text-stone-500">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {selectedLocal.direccion}
            </p>
          )}
          {selectedLocal?.telefono && (
            <a
              href={`tel:${selectedLocal.telefono.replace(/[^\d+]/g, "")}`}
              className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-orange-700 hover:underline"
            >
              <Phone className="h-3.5 w-3.5" />
              {selectedLocal.telefono}
            </a>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-stone-700">Torta / producto</label>
          <select
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 disabled:opacity-50"
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
            disabled={!panaderiaId}
          >
            <option value="">— Personalizada / otra —</option>
            {tortas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre} · {formatCOP(t.precio)}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-stone-700">
            Descripción del pedido
          </label>
          <Input
            placeholder="Ej. Tres leches 20 personas, decoración cumpleaños"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            required={!productoId}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Tu nombre</label>
          <Input value={cliente} onChange={(e) => setCliente(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Teléfono</label>
          <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Fecha de entrega</label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Notas</label>
          <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" />
        </div>

        <div className="space-y-3 sm:col-span-2">
          {selected && (
            <p className="text-sm text-orange-700">
              Valor referencia: {formatCOP(selected.precio)}
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {ok && (
            <p className="text-sm text-emerald-700">
              Encargo enviado a {brand || "el local"}. Te contactarán para confirmar.
            </p>
          )}

          <Button type="submit" className="w-full sm:w-auto" disabled={loading || !panaderiaId}>
            {loading ? "Enviando..." : "Enviar encargo"}
          </Button>
        </div>
      </form>

      <p className="mt-8 text-center text-sm text-stone-500">
        <Link href="/" className="text-orange-700 hover:underline">
          Volver al inicio
        </Link>
        <span className="mt-3 block text-xs">© {new Date().getFullYear()} Chiky02</span>
      </p>
    </main>
  );
}
