import { formatCOP, formatDate } from "@/lib/format";
import {
  bogotaParts,
  bogotaTodayInput,
  endOfPrevBogotaMonth,
  parseBogotaDateInput,
  startOfBogotaMonth,
  startOfPrevBogotaMonth,
} from "@/lib/timezone";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Search = { desde?: string; hasta?: string };

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { panaderia } = await requireFeature("reportes");
  const supabase = await createClient();
  const pid = panaderia.id;
  const sp = await searchParams;

  const hoy = bogotaTodayInput();
  const { year, month } = bogotaParts();
  const mesStartDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const prevMesStart = `${prev.y}-${String(prev.m).padStart(2, "0")}-01`;
  const prevMesEndDay = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const prevMesEnd = `${prev.y}-${String(prev.m).padStart(2, "0")}-${String(prevMesEndDay).padStart(2, "0")}`;

  const desdeInput = sp.desde || mesStartDate;
  const hastaInput = sp.hasta || hoy;
  const desdeIso = parseBogotaDateInput(desdeInput, false);
  const hastaIso = parseBogotaDateInput(hastaInput, true);

  const inicioMes = startOfBogotaMonth();
  const inicioMesAnt = startOfPrevBogotaMonth();
  const finMesAnt = endOfPrevBogotaMonth();

  const [
    { data: ventasPeriodo },
    { data: mesasPeriodo },
    { data: encargosPeriodo },
    { data: ventasMes },
    { data: ventasMesAnt },
    { data: mesasMes },
    { data: mesasMesAnt },
    { data: encargosMes },
    { data: encargosMesAnt },
  ] = await Promise.all([
    supabase
      .from("ventas_mostrador")
      .select("id, total, detalle, fecha_hora, medio_pago")
      .eq("panaderia_id", pid)
      .gte("fecha_hora", desdeIso)
      .lte("fecha_hora", hastaIso),
    supabase
      .from("cuentas_mesa")
      .select("id, total_final, medio_pago, hora_cierre, mesas(nombre)")
      .eq("panaderia_id", pid)
      .eq("estado", "cerrada")
      .gte("hora_cierre", desdeIso)
      .lte("hora_cierre", hastaIso),
    supabase
      .from("encargos")
      .select("id, valor, abono, estado, estado_pago, fecha_entrega, cliente_nombre")
      .eq("panaderia_id", pid)
      .gte("fecha_entrega", desdeInput)
      .lte("fecha_entrega", hastaInput),
    supabase
      .from("ventas_mostrador")
      .select("total")
      .eq("panaderia_id", pid)
      .gte("fecha_hora", inicioMes),
    supabase
      .from("ventas_mostrador")
      .select("total")
      .eq("panaderia_id", pid)
      .gte("fecha_hora", inicioMesAnt)
      .lte("fecha_hora", finMesAnt),
    supabase
      .from("cuentas_mesa")
      .select("total_final")
      .eq("panaderia_id", pid)
      .eq("estado", "cerrada")
      .gte("hora_cierre", inicioMes),
    supabase
      .from("cuentas_mesa")
      .select("total_final")
      .eq("panaderia_id", pid)
      .eq("estado", "cerrada")
      .gte("hora_cierre", inicioMesAnt)
      .lte("hora_cierre", finMesAnt),
    supabase
      .from("encargos")
      .select("valor, estado_pago, abono")
      .eq("panaderia_id", pid)
      .gte("fecha_entrega", mesStartDate),
    supabase
      .from("encargos")
      .select("valor, estado_pago, abono")
      .eq("panaderia_id", pid)
      .gte("fecha_entrega", prevMesStart)
      .lte("fecha_entrega", prevMesEnd),
  ]);

  function encargoCobrado(e: { valor: number; abono?: number | null; estado_pago?: string | null }) {
    if (e.estado_pago === "pagado") return e.valor ?? 0;
    if (e.estado_pago === "abonado") return e.abono ?? 0;
    return 0;
  }

  const totalMostrador = ventasPeriodo?.reduce((s, v) => s + v.total, 0) ?? 0;
  const totalMesas = mesasPeriodo?.reduce((s, c) => s + (c.total_final ?? 0), 0) ?? 0;
  const totalEncargos = encargosPeriodo?.reduce((s, e) => s + encargoCobrado(e), 0) ?? 0;
  const totalPeriodo = totalMostrador + totalMesas + totalEncargos;

  const mesActual =
    (ventasMes?.reduce((s, v) => s + v.total, 0) ?? 0) +
    (mesasMes?.reduce((s, c) => s + (c.total_final ?? 0), 0) ?? 0) +
    (encargosMes?.reduce((s, e) => s + encargoCobrado(e), 0) ?? 0);
  const mesAnterior =
    (ventasMesAnt?.reduce((s, v) => s + v.total, 0) ?? 0) +
    (mesasMesAnt?.reduce((s, c) => s + (c.total_final ?? 0), 0) ?? 0) +
    (encargosMesAnt?.reduce((s, e) => s + encargoCobrado(e), 0) ?? 0);
  const variacion = mesAnterior > 0 ? ((mesActual - mesAnterior) / mesAnterior) * 100 : 0;

  const porMedio: Record<string, number> = {};
  ventasPeriodo?.forEach((v) => {
    porMedio[v.medio_pago] = (porMedio[v.medio_pago] ?? 0) + v.total;
  });
  mesasPeriodo?.forEach((c) => {
    const m = c.medio_pago ?? "mesa";
    porMedio[m] = (porMedio[m] ?? 0) + (c.total_final ?? 0);
  });

  const productCounts: Record<string, { nombre: string; qty: number; total: number }> = {};
  ventasPeriodo?.forEach((v) => {
    const items = v.detalle as { nombre: string; cantidad: number; subtotal: number }[];
    items?.forEach((i) => {
      if (!productCounts[i.nombre]) productCounts[i.nombre] = { nombre: i.nombre, qty: 0, total: 0 };
      productCounts[i.nombre].qty += i.cantidad;
      productCounts[i.nombre].total += i.subtotal ?? 0;
    });
  });
  const topProductos = Object.values(productCounts)
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  const csvRows = [
    ["tipo", "fecha", "detalle", "medio_pago", "total"].join(","),
    ...(ventasPeriodo ?? []).map((v) =>
      ["mostrador", v.fecha_hora, `"venta ${v.id}"`, v.medio_pago, v.total].join(","),
    ),
    ...(mesasPeriodo ?? []).map((c) => {
      const mesa = c.mesas as { nombre?: string } | null;
      return [
        "mesa",
        c.hora_cierre ?? "",
        `"${(mesa?.nombre ?? "mesa").replace(/"/g, "")}"`,
        c.medio_pago ?? "",
        c.total_final ?? 0,
      ].join(",");
    }),
    ...(encargosPeriodo ?? []).map((e) =>
      [
        "encargo",
        e.fecha_entrega,
        `"${(e.cliente_nombre ?? "").replace(/"/g, "")}"`,
        e.estado_pago ?? "",
        encargoCobrado(e),
      ].join(","),
    ),
  ].join("\n");

  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csvRows)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-sm text-stone-500">
            Mostrador + mesas + encargos cobrados · horario Bogotá · flujo app (no fiscal DIAN)
          </p>
        </div>
        <a href={csvHref} download={`reporte-${desdeInput}-${hastaInput}.csv`}>
          <Button variant="secondary">Exportar CSV</Button>
        </a>
      </div>

      <Card>
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div>
            <label className="text-xs font-medium">Desde</label>
            <input
              type="date"
              name="desde"
              defaultValue={desdeInput}
              className="mt-1 block rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Hasta</label>
            <input
              type="date"
              name="hasta"
              defaultValue={hastaInput}
              className="mt-1 block rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit">Filtrar</Button>
        </form>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-stone-500">Total periodo</p>
          <p className="text-2xl font-bold text-amber-700">{formatCOP(totalPeriodo)}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Mostrador</p>
          <p className="text-2xl font-bold">{formatCOP(totalMostrador)}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Mesas cerradas</p>
          <p className="text-2xl font-bold">{formatCOP(totalMesas)}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Encargos cobrados</p>
          <p className="text-2xl font-bold">{formatCOP(totalEncargos)}</p>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-sm text-stone-500">Mes actual (combinado)</p>
          <p className="text-2xl font-bold">{formatCOP(mesActual)}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Var. vs mes anterior</p>
          <p className={`text-2xl font-bold ${variacion >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {variacion >= 0 ? "+" : ""}
            {variacion.toFixed(1)}%
          </p>
          <p className="text-xs text-stone-400">Anterior: {formatCOP(mesAnterior)}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Por medio de pago</CardTitle>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries(porMedio).map(([k, v]) => (
              <li key={k} className="flex justify-between capitalize">
                <span>{k}</span>
                <span className="font-medium">{formatCOP(v)}</span>
              </li>
            ))}
            {Object.keys(porMedio).length === 0 && (
              <li className="text-stone-500">Sin datos en el rango</li>
            )}
          </ul>
        </Card>
        <Card>
          <CardTitle>Top productos (mostrador)</CardTitle>
          <ul className="mt-3 space-y-2 text-sm">
            {topProductos.map((p) => (
              <li key={p.nombre} className="flex justify-between gap-2">
                <span className="truncate">
                  {p.nombre} · {p.qty} u
                </span>
                <span className="font-medium">{formatCOP(p.total)}</span>
              </li>
            ))}
            {topProductos.length === 0 && (
              <li className="text-stone-500">Sin ventas de mostrador</li>
            )}
          </ul>
        </Card>
      </div>

      <Card>
        <CardTitle>Encargos en el rango</CardTitle>
        <ul className="mt-3 divide-y text-sm">
          {(encargosPeriodo ?? []).slice(0, 30).map((e) => (
            <li key={e.id} className="flex justify-between py-2">
              <span>
                {e.cliente_nombre} · {formatDate(e.fecha_entrega)} · {e.estado_pago ?? e.estado}
              </span>
              <span className="font-medium">{formatCOP(encargoCobrado(e))}</span>
            </li>
          ))}
          {(encargosPeriodo ?? []).length === 0 && (
            <li className="py-2 text-stone-500">Sin encargos</li>
          )}
        </ul>
        <p className="mt-3 text-xs text-stone-400">
          Mesas cerradas en rango: {(mesasPeriodo ?? []).length}. Detalle completo en CSV.
        </p>
        <Link href="/caja" className="mt-2 inline-block text-sm text-orange-700 underline">
          Ir a caja / facturas
        </Link>
      </Card>
    </div>
  );
}
