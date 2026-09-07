"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCOP } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TortaOption = { id: string; nombre: string; precio: number };

export default function EncargarPage() {
  const [tortas, setTortas] = useState<TortaOption[]>([]);
  const [panaderiaId, setPanaderiaId] = useState<string | null>(null);
  const [productoId, setProductoId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fecha, setFecha] = useState("");
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: panaderia } = await supabase
        .from("panaderias")
        .select("id")
        .eq("slug", "bakerychiky02")
        .maybeSingle();
      if (!panaderia) return;
      setPanaderiaId(panaderia.id);

      // Prefer products marked encargable
      const { data: marked, error: markErr } = await supabase
        .from("productos")
        .select("id, nombre, precio")
        .eq("panaderia_id", panaderia.id)
        .eq("disponible", true)
        .eq("encargable", true)
        .order("nombre");

      if (!markErr && marked && marked.length > 0) {
        setTortas(marked);
        return;
      }

      // Fallback: tortas by category / name until migration is applied
      const { data: cats } = await supabase
        .from("categorias")
        .select("id, nombre")
        .eq("panaderia_id", panaderia.id)
        .ilike("nombre", "%torta%");

      let list: TortaOption[] = [];
      if (cats && cats.length > 0) {
        const { data } = await supabase
          .from("productos")
          .select("id, nombre, precio")
          .eq("panaderia_id", panaderia.id)
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
          .eq("panaderia_id", panaderia.id)
          .eq("disponible", true)
          .or("nombre.ilike.%torta%,nombre.ilike.%ponqué%,nombre.ilike.%milky%")
          .order("nombre");
        list = all ?? [];
      }
      setTortas(list);
    })();
  }, []);

  const selected = tortas.find((t) => t.id === productoId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-10 md:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-700">
        Dulce Bonanza
      </p>
      <h1 className="mt-3 text-3xl font-bold text-stone-900">Encargar torta</h1>
      <p className="mt-2 text-stone-600">
        Elige un producto disponible para encargo e indica la fecha de entrega.
      </p>

      <form onSubmit={submit} className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-stone-700">Torta / producto</label>
          <select
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900"
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
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
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-stone-700">Notas</label>
          <Input
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Opcional"
          />
        </div>

        <div className="sm:col-span-2 space-y-3">
          {selected && (
            <p className="text-sm text-orange-700">
              Valor referencia: {formatCOP(selected.precio)}
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          {ok && (
            <p className="text-sm text-emerald-700">
              Encargo enviado. Te contactaremos para confirmar.
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
      </p>
    </main>
  );
}
