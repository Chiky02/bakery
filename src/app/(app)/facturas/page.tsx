import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCOP, formatDateTime } from "@/lib/format";
import {
  bogotaTodayInput,
  parseBogotaDateInput,
  bogotaParts,
} from "@/lib/timezone";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { Factura } from "@/types";

type Search = { desde?: string; hasta?: string; q?: string; origen?: string };

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { panaderia } = await requireFeature("facturas");
  const supabase = await createClient();
  const sp = await searchParams;

  const hoy = bogotaTodayInput();
  const { year, month } = bogotaParts();
  const mesStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const desdeInput = sp.desde || mesStart;
  const hastaInput = sp.hasta || hoy;
  const desdeIso = parseBogotaDateInput(desdeInput, false);
  const hastaIso = parseBogotaDateInput(hastaInput, true);
  const q = (sp.q ?? "").trim();
  const origen = (sp.origen ?? "").trim();

  let query = supabase
    .from("facturas")
    .select(
      "id, numero, origen, cliente_nombre, cliente_documento, total, medio_pago, created_at, iva, subtotal",
    )
    .eq("panaderia_id", panaderia.id)
    .gte("created_at", desdeIso)
    .lte("created_at", hastaIso)
    .order("created_at", { ascending: false })
    .limit(100);

  if (origen) query = query.eq("origen", origen);
  if (q) {
    query = query.or(
      `numero.ilike.%${q}%,cliente_nombre.ilike.%${q}%,cliente_documento.ilike.%${q}%`,
    );
  }

  const { data } = await query;
  const facturas = (data ?? []) as Factura[];
  const total = facturas.reduce((s, f) => s + (f.total ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Facturas</h1>
          <p className="text-sm text-stone-500">
            Documentos comerciales de venta · reimpresión y búsqueda
          </p>
        </div>
        <Link href="/caja">
          <Button variant="secondary">Ir a caja</Button>
        </Link>
      </div>

      <Card>
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div>
            <label htmlFor="fac-desde" className="text-xs font-medium">
              Desde
            </label>
            <input
              id="fac-desde"
              name="desde"
              type="date"
              defaultValue={desdeInput}
              className="mt-1 block rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="fac-hasta" className="text-xs font-medium">
              Hasta
            </label>
            <input
              id="fac-hasta"
              name="hasta"
              type="date"
              defaultValue={hastaInput}
              className="mt-1 block rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="fac-origen" className="text-xs font-medium">
              Origen
            </label>
            <select
              id="fac-origen"
              name="origen"
              defaultValue={origen}
              className="mt-1 block rounded-lg border border-stone-300 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="mostrador">Mostrador</option>
              <option value="mesa">Mesa</option>
              <option value="encargo">Encargo</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="fac-q" className="text-xs font-medium">
              Buscar
            </label>
            <input
              id="fac-q"
              name="q"
              defaultValue={q}
              placeholder="Número, cliente, NIT…"
              className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit">Filtrar</Button>
        </form>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-stone-500">Documentos en rango</p>
          <p className="text-2xl font-bold">{facturas.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Total facturado</p>
          <p className="text-2xl font-bold text-orange-700">{formatCOP(total)}</p>
        </Card>
      </div>

      <Card>
        <CardTitle>Listado</CardTitle>
        <ul className="mt-3 divide-y text-sm">
          {facturas.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div>
                <p className="font-medium">
                  {f.numero} · {f.cliente_nombre}
                </p>
                <p className="text-xs text-stone-500">
                  {formatDateTime(f.created_at)}
                  {f.cliente_documento ? ` · ${f.cliente_documento}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{f.origen}</Badge>
                <span className="font-semibold">{formatCOP(f.total)}</span>
                <Link href={`/facturas/${f.id}`} target="_blank">
                  <Button size="sm" variant="secondary">
                    Abrir
                  </Button>
                </Link>
              </div>
            </li>
          ))}
          {facturas.length === 0 && (
            <li className="py-4 text-stone-500">Sin facturas en el rango</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
