import { formatCOP, formatDate, formatDateTime } from "@/lib/format";
import {
  bogotaParts,
  bogotaTodayInput,
  endOfPrevBogotaMonth,
  parseBogotaDateInput,
  startOfBogotaMonth,
  startOfPrevBogotaMonth,
} from "@/lib/timezone";
import { resumenConteo } from "@/lib/caja-denominaciones";
import { aporteEfectivo, aporteElectronico } from "@/lib/pago-split";
import { buildCategoriaMap, expandVentasDetalle } from "@/lib/reportes-detalle";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TurnoCaja } from "@/types";

type Search = { desde?: string; hasta?: string };

function addDaysInput(yyyyMmDd: string, delta: number): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function encargoCobrado(e: {
  valor: number;
  abono?: number | null;
  estado_pago?: string | null;
}) {
  if (e.estado_pago === "pagado") return e.valor ?? 0;
  if (e.estado_pago === "abonado") return e.abono ?? 0;
  return 0;
}

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
  const semanaDesde = addDaysInput(hoy, -6);

  const desdeInput = sp.desde || mesStartDate;
  const hastaInput = sp.hasta || hoy;
  const desdeIso = parseBogotaDateInput(desdeInput, false);
  const hastaIso = parseBogotaDateInput(hastaInput, true);

  const inicioMes = startOfBogotaMonth();
  const inicioMesAnt = startOfPrevBogotaMonth();
  const finMesAnt = endOfPrevBogotaMonth();

  const [
    ventasRes,
    mesasRes,
    encargosEntregaRes,
    turnosRes,
    movsRes,
    facturasRes,
    ventasMesRes,
    ventasMesAntRes,
    mesasMesRes,
    mesasMesAntRes,
    ventasAnuladasRes,
    mesasCanceladasRes,
    stockMovsRes,
    stockBajosRes,
  ] = await Promise.all([
    supabase
      .from("ventas_mostrador")
      .select("id, total, detalle, fecha_hora, medio_pago, monto_efectivo, monto_electronico")
      .eq("panaderia_id", pid)
      .eq("anulado", false)
      .gte("fecha_hora", desdeIso)
      .lte("fecha_hora", hastaIso),
    supabase
      .from("cuentas_mesa")
      .select(
        "id, total_final, medio_pago, hora_cierre, monto_efectivo, monto_electronico, mesas(nombre), items_cuenta(cantidad, precio_al_momento, estado, producto_id, productos(nombre, categorias(nombre)))",
      )
      .eq("panaderia_id", pid)
      .eq("estado", "cerrada")
      .gt("total_final", 0)
      .gte("hora_cierre", desdeIso)
      .lte("hora_cierre", hastaIso),
    supabase
      .from("encargos")
      .select("id, valor, abono, estado, estado_pago, fecha_entrega, cliente_nombre")
      .eq("panaderia_id", pid)
      .gte("fecha_entrega", desdeInput)
      .lte("fecha_entrega", hastaInput)
      .order("fecha_entrega"),
    supabase
      .from("turnos_caja")
      .select("*")
      .eq("panaderia_id", pid)
      .gte("apertura_at", desdeIso)
      .lte("apertura_at", hastaIso)
      .order("apertura_at", { ascending: false }),
    supabase
      .from("movimientos_caja")
      .select(
        "id, tipo, monto_efectivo, monto_electronico, referencia_id, notas, created_at",
      )
      .eq("panaderia_id", pid)
      .gte("created_at", desdeIso)
      .lte("created_at", hastaIso)
      .order("created_at", { ascending: false }),
    supabase
      .from("facturas")
      .select(
        "id, numero, origen, cliente_nombre, cliente_documento, total, medio_pago, created_at",
      )
      .eq("panaderia_id", pid)
      .gte("created_at", desdeIso)
      .lte("created_at", hastaIso)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("ventas_mostrador")
      .select("total")
      .eq("panaderia_id", pid)
      .eq("anulado", false)
      .gte("fecha_hora", inicioMes),
    supabase
      .from("ventas_mostrador")
      .select("total")
      .eq("panaderia_id", pid)
      .eq("anulado", false)
      .gte("fecha_hora", inicioMesAnt)
      .lte("fecha_hora", finMesAnt),
    supabase
      .from("cuentas_mesa")
      .select("total_final")
      .eq("panaderia_id", pid)
      .eq("estado", "cerrada")
      .gt("total_final", 0)
      .gte("hora_cierre", inicioMes),
    supabase
      .from("cuentas_mesa")
      .select("total_final")
      .eq("panaderia_id", pid)
      .eq("estado", "cerrada")
      .gt("total_final", 0)
      .gte("hora_cierre", inicioMesAnt)
      .lte("hora_cierre", finMesAnt),
    supabase
      .from("ventas_mostrador")
      .select("id, total, fecha_hora, medio_pago")
      .eq("panaderia_id", pid)
      .eq("anulado", true)
      .gte("fecha_hora", desdeIso)
      .lte("fecha_hora", hastaIso)
      .order("fecha_hora", { ascending: false })
      .limit(40),
    supabase
      .from("cuentas_mesa")
      .select("id, hora_cierre, mesas(nombre)")
      .eq("panaderia_id", pid)
      .eq("estado", "cancelada")
      .gte("hora_cierre", desdeIso)
      .lte("hora_cierre", hastaIso)
      .order("hora_cierre", { ascending: false })
      .limit(40),
    supabase
      .from("stock_movimientos")
      .select(
        "id, tipo, cantidad, stock_despues, referencia, notas, created_at, productos(nombre)",
      )
      .eq("panaderia_id", pid)
      .gte("created_at", desdeIso)
      .lte("created_at", hastaIso)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("productos")
      .select("id, nombre, stock, stock_minimo, control_stock")
      .eq("panaderia_id", pid)
      .eq("control_stock", true)
      .order("nombre")
      .limit(200),
  ]);

  const movsCaja = /movimientos_caja|relation/i.test(movsRes.error?.message ?? "")
    ? []
    : (movsRes.data ?? []);
  const facturas = /facturas|relation/i.test(facturasRes.error?.message ?? "")
    ? []
    : (facturasRes.data ?? []);

  // Si falló el select con montos/ítems anidados, reintentar liviano
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ventasPeriodo: any[] = ventasRes.data ?? [];
  if (ventasRes.error) {
    const { data } = await supabase
      .from("ventas_mostrador")
      .select("id, total, detalle, fecha_hora, medio_pago")
      .eq("panaderia_id", pid)
      .eq("anulado", false)
      .gte("fecha_hora", desdeIso)
      .lte("fecha_hora", hastaIso);
    ventasPeriodo = data ?? [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mesasPeriodo: any[] = mesasRes.data ?? [];
  if (mesasRes.error) {
    const { data } = await supabase
      .from("cuentas_mesa")
      .select(
        "id, total_final, medio_pago, hora_cierre, mesas(nombre), items_cuenta(cantidad, precio_al_momento, estado, producto_id, productos(nombre, categorias(nombre)))",
      )
      .eq("panaderia_id", pid)
      .eq("estado", "cerrada")
      .gt("total_final", 0)
      .gte("hora_cierre", desdeIso)
      .lte("hora_cierre", hastaIso);
    mesasPeriodo = data ?? [];
  }

  const encargosEntrega = encargosEntregaRes.data ?? [];
  const turnos = (turnosRes.data ?? []) as TurnoCaja[];
  const ventasAnuladas = ventasAnuladasRes.data ?? [];
  const mesasCanceladas = mesasCanceladasRes.data ?? [];
  const stockMovs = stockMovsRes.data ?? [];
  const stockBajos = (stockBajosRes.data ?? []).filter(
    (p) => Number(p.stock ?? 0) <= Number(p.stock_minimo ?? 0),
  );

  const totalMostrador = ventasPeriodo.reduce((s, v) => s + (v.total ?? 0), 0);
  const totalMesas = mesasPeriodo.reduce((s, c) => s + (c.total_final ?? 0), 0);
  const totalEncargosCobrados = movsCaja.reduce(
    (s, m) => s + (Number(m.monto_efectivo) || 0) + (Number(m.monto_electronico) || 0),
    0,
  );
  const totalEncargosFallback = encargosEntrega.reduce((s, e) => s + encargoCobrado(e), 0);
  const totalEncargos = /movimientos_caja|relation/i.test(movsRes.error?.message ?? "")
    ? totalEncargosFallback
    : totalEncargosCobrados;
  const totalPeriodo = totalMostrador + totalMesas + totalEncargos;

  const nTickets = ventasPeriodo.length + mesasPeriodo.length;
  const ticketPromedio = nTickets > 0 ? Math.round(totalMostrador + totalMesas) / nTickets : 0;

  let ventasEfectivo = 0;
  let ventasElectronico = 0;
  for (const v of ventasPeriodo) {
    ventasEfectivo += aporteEfectivo(v);
    ventasElectronico += aporteElectronico(v);
  }
  for (const c of mesasPeriodo) {
    ventasEfectivo += aporteEfectivo({ ...c, total: c.total_final });
    ventasElectronico += aporteElectronico({ ...c, total: c.total_final });
  }
  for (const m of movsCaja) {
    ventasEfectivo += Number(m.monto_efectivo) || 0;
    ventasElectronico += Number(m.monto_electronico) || 0;
  }

  const porMedio: Record<string, number> = {
    efectivo: ventasEfectivo,
    electronico: ventasElectronico,
  };

  const turnosCerrados = turnos.filter((t) => t.estado === "cerrado");
  const turnosAbiertos = turnos.filter((t) => t.estado === "abierto").length;
  const fondosApertura = turnos.reduce((s, t) => s + (t.fondo_inicial ?? 0), 0);
  const efectivoContado = turnosCerrados.reduce((s, t) => s + (t.efectivo_contado ?? 0), 0);
  const electronicoContado = turnosCerrados.reduce(
    (s, t) => s + (t.electronico_contado ?? 0),
    0,
  );
  const esperadoEfectivoTurnos = turnosCerrados.reduce(
    (s, t) => s + (t.esperado_efectivo ?? 0),
    0,
  );
  const esperadoElectronicoTurnos = turnosCerrados.reduce(
    (s, t) => s + (t.esperado_electronico ?? 0),
    0,
  );
  const difEfectivo = turnosCerrados.reduce(
    (s, t) =>
      s +
      (t.diferencia_efectivo ??
        (t.efectivo_contado ?? 0) - (t.esperado_efectivo ?? 0)),
    0,
  );
  const difElectronico = turnosCerrados.reduce(
    (s, t) =>
      s +
      (t.diferencia_electronico ??
        (t.electronico_contado ?? 0) - (t.esperado_electronico ?? 0)),
    0,
  );

  const mesActual =
    (ventasMesRes.data?.reduce((s, v) => s + v.total, 0) ?? 0) +
    (mesasMesRes.data?.reduce((s, c) => s + (c.total_final ?? 0), 0) ?? 0);
  const mesAnterior =
    (ventasMesAntRes.data?.reduce((s, v) => s + v.total, 0) ?? 0) +
    (mesasMesAntRes.data?.reduce((s, c) => s + (c.total_final ?? 0), 0) ?? 0);
  const variacion = mesAnterior > 0 ? ((mesActual - mesAnterior) / mesAnterior) * 100 : 0;

  const { data: productosCat } = await supabase
    .from("productos")
    .select("id, categorias(nombre)")
    .eq("panaderia_id", pid);

  const catMap = buildCategoriaMap(productosCat ?? []);
  const { lineas: lineasVenta, porProducto, porCategoria } = expandVentasDetalle({
    ventas: ventasPeriodo,
    mesas: mesasPeriodo,
    catMap,
  });

  const totalFacturas = facturas.reduce((s, f) => s + (f.total ?? 0), 0);
  const unidadesVendidas = porProducto.reduce((s, p) => s + p.cantidad, 0);
  const encargosPendientesEntrega = encargosEntrega.filter((e) => e.estado === "pendiente");
  const encargosPorCobrar = encargosEntrega.filter((e) => {
    const pagado = encargoCobrado(e);
    return (e.valor ?? 0) > pagado && e.estado !== "cancelado";
  });

  const excelHref = `/api/reportes/export?desde=${encodeURIComponent(desdeInput)}&hasta=${encodeURIComponent(hastaInput)}`;

  const qHoy = `?desde=${hoy}&hasta=${hoy}`;
  const qSemana = `?desde=${semanaDesde}&hasta=${hoy}`;
  const qMes = `?desde=${mesStartDate}&hasta=${hoy}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reportes</h1>
          <p className="text-sm text-stone-500">
            Detalle por producto · cantidades · caja · encargos · Excel
          </p>
        </div>
        <a href={excelHref}>
          <Button variant="secondary">Exportar Excel</Button>
        </a>
      </div>

      <Card>
        <form className="flex flex-wrap items-end gap-3" method="get">
          <div>
            <label htmlFor="rep-desde" className="text-xs font-medium">
              Desde
            </label>
            <input
              id="rep-desde"
              type="date"
              name="desde"
              defaultValue={desdeInput}
              className="mt-1 block rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="rep-hasta" className="text-xs font-medium">
              Hasta
            </label>
            <input
              id="rep-hasta"
              type="date"
              name="hasta"
              defaultValue={hastaInput}
              className="mt-1 block rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <Button type="submit">Filtrar</Button>
          <div className="flex flex-wrap gap-2 pb-0.5">
            <Link href={`/reportes${qHoy}`}>
              <Button type="button" variant="ghost" size="sm">
                Hoy
              </Button>
            </Link>
            <Link href={`/reportes${qSemana}`}>
              <Button type="button" variant="ghost" size="sm">
                7 días
              </Button>
            </Link>
            <Link href={`/reportes${qMes}`}>
              <Button type="button" variant="ghost" size="sm">
                Mes
              </Button>
            </Link>
          </div>
        </form>
        <nav className="mt-3 flex flex-wrap gap-3 border-t border-stone-100 pt-3 text-sm">
          <a href="#detalle" className="text-orange-800 underline-offset-2 hover:underline">
            Detalle productos
          </a>
          <a href="#ventas" className="text-orange-800 underline-offset-2 hover:underline">
            Ventas
          </a>
          <a href="#caja" className="text-orange-800 underline-offset-2 hover:underline">
            Caja
          </a>
          <a href="#encargos" className="text-orange-800 underline-offset-2 hover:underline">
            Encargos
          </a>
          <a href="#facturas" className="text-orange-800 underline-offset-2 hover:underline">
            Facturas
          </a>
          <a href="#inventario" className="text-orange-800 underline-offset-2 hover:underline">
            Inventario
          </a>
        </nav>
      </Card>

      {/* ─── VENTAS ─────────────────────────────────────────────── */}
      <section id="ventas" className="scroll-mt-20 space-y-4">
        <h2 className="text-lg font-semibold text-stone-800">Ventas</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card>
            <p className="text-sm text-stone-500">Total periodo</p>
            <p className="text-2xl font-bold text-amber-700">{formatCOP(totalPeriodo)}</p>
          </Card>
          <Card>
            <p className="text-sm text-stone-500">Mostrador</p>
            <p className="text-2xl font-bold">{formatCOP(totalMostrador)}</p>
            <p className="text-xs text-stone-400">{ventasPeriodo.length} ventas</p>
          </Card>
          <Card>
            <p className="text-sm text-stone-500">Mesas</p>
            <p className="text-2xl font-bold">{formatCOP(totalMesas)}</p>
            <p className="text-xs text-stone-400">{mesasPeriodo.length} cierres</p>
          </Card>
          <Card>
            <p className="text-sm text-stone-500">Encargos cobrados*</p>
            <p className="text-2xl font-bold">{formatCOP(totalEncargos)}</p>
            <p className="text-xs text-stone-400">
              {movsCaja.length > 0 || !movsRes.error
                ? "Por fecha de cobro"
                : "Est. por entrega"}
            </p>
          </Card>
          <Card>
            <p className="text-sm text-stone-500">Ticket promedio</p>
            <p className="text-2xl font-bold">{formatCOP(Math.round(ticketPromedio))}</p>
            <p className="text-xs text-stone-400">{nTickets} tickets (sin encargos)</p>
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <p className="text-sm text-stone-500">Mes actual (mostrador + mesas)</p>
            <p className="text-2xl font-bold">{formatCOP(mesActual)}</p>
          </Card>
          <Card>
            <p className="text-sm text-stone-500">Var. vs mes anterior</p>
            <p
              className={`text-2xl font-bold ${variacion >= 0 ? "text-emerald-600" : "text-red-600"}`}
            >
              {variacion >= 0 ? "+" : ""}
              {variacion.toFixed(1)}%
            </p>
            <p className="text-xs text-stone-400">Anterior: {formatCOP(mesAnterior)}</p>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>Ingreso por medio (desglose real)</CardTitle>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between">
                <span>Efectivo</span>
                <span className="font-medium">{formatCOP(ventasEfectivo)}</span>
              </li>
              <li className="flex justify-between">
                <span>Electrónico</span>
                <span className="font-medium">{formatCOP(ventasElectronico)}</span>
              </li>
              {Object.keys(porMedio).length === 0 && (
                <li className="text-stone-500">Sin datos</li>
              )}
            </ul>
            <p className="mt-2 text-xs text-stone-400">
              Usa montos de mixto y cobros de encargo del turno cuando existen.
            </p>
          </Card>
          <Card>
            <CardTitle>Por categoría</CardTitle>
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
              {porCategoria.map((c) => (
                <li key={c.categoria} className="flex justify-between gap-2">
                  <span className="truncate">
                    {c.categoria} · {c.cantidad} u
                  </span>
                  <span className="shrink-0 font-medium">{formatCOP(c.subtotal)}</span>
                </li>
              ))}
              {porCategoria.length === 0 && (
                <li className="text-stone-500">Sin ventas en el rango</li>
              )}
            </ul>
          </Card>
        </div>

        <Card>
          <CardTitle>Anulaciones / liberaciones sin cobro</CardTitle>
          <ul className="mt-3 max-h-64 divide-y overflow-y-auto text-sm">
            {ventasAnuladas.map((v) => (
              <li key={v.id} className="flex justify-between gap-2 py-2">
                <span>
                  Venta anulada · {formatDateTime(v.fecha_hora)} · {v.medio_pago}
                </span>
                <span className="text-red-600">{formatCOP(v.total)}</span>
              </li>
            ))}
            {mesasCanceladas.map((c) => {
              const mesa = c.mesas as { nombre?: string } | null;
              return (
                <li key={c.id} className="flex justify-between gap-2 py-2">
                  <span>
                    Mesa sin venta · {mesa?.nombre ?? "mesa"} ·{" "}
                    {c.hora_cierre ? formatDateTime(c.hora_cierre) : "—"}
                  </span>
                  <Badge color="warning">cancelada</Badge>
                </li>
              );
            })}
            {ventasAnuladas.length === 0 && mesasCanceladas.length === 0 && (
              <li className="py-2 text-stone-500">Sin anulaciones en el rango</li>
            )}
          </ul>
        </Card>
      </section>

      {/* ─── DETALLE PRODUCTOS ─────────────────────────────────── */}
      <section id="detalle" className="scroll-mt-20 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-stone-800">
              Qué se vendió (detalle)
            </h2>
            <p className="text-sm text-stone-500">
              {unidadesVendidas} unidades · {porProducto.length} productos ·{" "}
              {lineasVenta.length} líneas · mostrador + mesas
            </p>
          </div>
        </div>

        <Card>
          <CardTitle>Resumen por producto</CardTitle>
          <p className="mt-1 text-xs text-stone-500">
            Cantidad total vendida en el rango, con categoría e importe
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                  <th className="py-2 pr-3 font-medium">Producto</th>
                  <th className="py-2 pr-3 font-medium">Categoría</th>
                  <th className="py-2 pr-3 font-medium text-right">Cantidad</th>
                  <th className="py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {porProducto.map((p) => (
                  <tr key={p.key}>
                    <td className="py-2 pr-3 font-medium text-stone-900">{p.producto}</td>
                    <td className="py-2 pr-3 text-stone-500">{p.categoria}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{p.cantidad}</td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {formatCOP(p.subtotal)}
                    </td>
                  </tr>
                ))}
                {porProducto.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-stone-500">
                      No hay ítems de venta en este rango
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardTitle>Líneas de venta (fecha / hora)</CardTitle>
          <p className="mt-1 text-xs text-stone-500">
            Cada ítem cobrado: cuándo, de qué canal, categoría y cantidad
          </p>
          <div className="mt-3 max-h-[32rem] overflow-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                  <th className="py-2 pr-3 font-medium">Fecha / hora</th>
                  <th className="py-2 pr-3 font-medium">Producto</th>
                  <th className="py-2 pr-3 font-medium">Categoría</th>
                  <th className="py-2 pr-3 font-medium text-right">Cant.</th>
                  <th className="py-2 pr-3 font-medium">Canal</th>
                  <th className="py-2 font-medium text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {lineasVenta.map((l, idx) => (
                  <tr key={`${l.fecha_hora}-${l.producto}-${idx}`}>
                    <td className="whitespace-nowrap py-2 pr-3 text-stone-600">
                      {l.fecha_hora ? formatDateTime(l.fecha_hora) : "—"}
                    </td>
                    <td className="py-2 pr-3 font-medium text-stone-900">{l.producto}</td>
                    <td className="py-2 pr-3 text-stone-500">{l.categoria}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{l.cantidad}</td>
                    <td className="py-2 pr-3 text-xs text-stone-500">
                      {l.canal === "mostrador" ? "Mostrador" : "Mesa"}
                      <span className="block text-stone-400">{l.referencia}</span>
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {formatCOP(l.subtotal)}
                    </td>
                  </tr>
                ))}
                {lineasVenta.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-stone-500">
                      Sin líneas de venta en el rango
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* ─── CAJA ──────────────────────────────────────────────── */}
      <section id="caja" className="scroll-mt-20 space-y-4">
        <h2 className="text-lg font-semibold text-stone-800">Caja / arqueo</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <p className="text-sm text-stone-500">Turnos</p>
            <p className="text-2xl font-bold">{turnos.length}</p>
            <p className="text-xs text-stone-400">
              {turnosCerrados.length} cerrados · {turnosAbiertos} abiertos
            </p>
          </Card>
          <Card>
            <p className="text-sm text-stone-500">Fondos apertura</p>
            <p className="text-2xl font-bold">{formatCOP(fondosApertura)}</p>
          </Card>
          <Card>
            <p className="text-sm text-stone-500">Contado (cierres)</p>
            <p className="text-lg font-bold">
              Ef. {formatCOP(efectivoContado)}
            </p>
            <p className="text-lg font-bold">El. {formatCOP(electronicoContado)}</p>
          </Card>
          <Card>
            <p className="text-sm text-stone-500">Diferencia arqueos</p>
            <p
              className={`text-lg font-bold ${difEfectivo === 0 ? "" : difEfectivo > 0 ? "text-emerald-700" : "text-red-600"}`}
            >
              Ef. {formatCOP(difEfectivo)}
            </p>
            <p
              className={`text-lg font-bold ${difElectronico === 0 ? "" : difElectronico > 0 ? "text-emerald-700" : "text-red-600"}`}
            >
              El. {formatCOP(difElectronico)}
            </p>
            {(esperadoEfectivoTurnos > 0 || esperadoElectronicoTurnos > 0) && (
              <p className="mt-1 text-xs text-stone-400">
                Esperado Ef. {formatCOP(esperadoEfectivoTurnos)} · El.{" "}
                {formatCOP(esperadoElectronicoTurnos)}
              </p>
            )}
          </Card>
        </div>

        <Card>
          <CardTitle>Aperturas y cierres</CardTitle>
          {turnos.length === 0 ? (
            <p className="mt-3 text-sm text-stone-500">Sin turnos en el rango</p>
          ) : (
            <ul className="mt-3 max-h-96 divide-y overflow-y-auto text-sm">
              {turnos.map((t) => (
                <li key={t.id} className="space-y-1 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge color={t.estado === "abierto" ? "success" : "default"}>
                        {t.estado}
                      </Badge>
                      <span className="font-medium">
                        Apertura {formatDateTime(t.apertura_at)}
                      </span>
                    </div>
                    <span className="tabular-nums">Fondo {formatCOP(t.fondo_inicial)}</span>
                  </div>
                  {t.detalle_apertura && (
                    <p className="text-xs text-stone-400">
                      Apertura: {resumenConteo(t.detalle_apertura)}
                    </p>
                  )}
                  {t.estado === "cerrado" && (
                    <div className="text-xs text-stone-500">
                      Cierre {t.cierre_at ? formatDateTime(t.cierre_at) : "—"} · Contado Ef.{" "}
                      {formatCOP(t.efectivo_contado ?? 0)} / El.{" "}
                      {formatCOP(t.electronico_contado ?? 0)}
                      {t.esperado_efectivo != null && (
                        <>
                          {" "}
                          · Esperado Ef. {formatCOP(t.esperado_efectivo)} / El.{" "}
                          {formatCOP(t.esperado_electronico ?? 0)}
                        </>
                      )}
                      {(t.diferencia_efectivo != null || t.diferencia_electronico != null) && (
                        <>
                          {" "}
                          · Dif. Ef. {formatCOP(t.diferencia_efectivo ?? 0)} / El.{" "}
                          {formatCOP(t.diferencia_electronico ?? 0)}
                        </>
                      )}
                      {t.detalle_cierre ? ` · ${resumenConteo(t.detalle_cierre)}` : ""}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link href="/caja" className="mt-3 inline-block text-sm text-orange-700 underline">
            Ir a caja
          </Link>
        </Card>

        {movsCaja.length > 0 && (
          <Card>
            <CardTitle>Cobros registrados en caja (encargos)</CardTitle>
            <ul className="mt-3 max-h-64 divide-y overflow-y-auto text-sm">
              {movsCaja.map((m) => (
                <li key={m.id} className="flex justify-between gap-2 py-2">
                  <span>
                    {m.tipo.replace("encargo_", "")} · {formatDateTime(m.created_at)}
                    {m.notas ? ` · ${m.notas}` : ""}
                  </span>
                  <span className="font-medium">
                    {formatCOP(
                      (Number(m.monto_efectivo) || 0) + (Number(m.monto_electronico) || 0),
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* ─── ENCARGOS ──────────────────────────────────────────── */}
      <section id="encargos" className="scroll-mt-20 space-y-4">
        <h2 className="text-lg font-semibold text-stone-800">Encargos</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-sm text-stone-500">Entregas en rango</p>
            <p className="text-2xl font-bold">{encargosEntrega.length}</p>
          </Card>
          <Card>
            <p className="text-sm text-stone-500">Pendientes de entrega</p>
            <p className="text-2xl font-bold">{encargosPendientesEntrega.length}</p>
          </Card>
          <Card>
            <p className="text-sm text-stone-500">Con saldo por cobrar</p>
            <p className="text-2xl font-bold">{encargosPorCobrar.length}</p>
          </Card>
        </div>
        <Card>
          <CardTitle>Por fecha de entrega</CardTitle>
          <ul className="mt-3 max-h-80 divide-y overflow-y-auto text-sm">
            {encargosEntrega.slice(0, 40).map((e) => (
              <li key={e.id} className="flex justify-between gap-2 py-2">
                <span>
                  {e.cliente_nombre} · {formatDate(e.fecha_entrega)} ·{" "}
                  {e.estado_pago ?? e.estado}
                </span>
                <span className="font-medium">
                  {formatCOP(encargoCobrado(e))}
                  {(e.valor ?? 0) > encargoCobrado(e) && (
                    <span className="ml-1 text-xs text-stone-400">
                      / {formatCOP(e.valor)}
                    </span>
                  )}
                </span>
              </li>
            ))}
            {encargosEntrega.length === 0 && (
              <li className="py-2 text-stone-500">Sin encargos en el rango</li>
            )}
          </ul>
          <p className="mt-2 text-xs text-stone-400">
            * El dinero en “Total periodo” usa cobros reales de caja cuando existen; esta lista
            es por fecha de entrega (producción).
          </p>
        </Card>
      </section>

      {/* ─── FACTURAS ──────────────────────────────────────────── */}
      <section id="facturas" className="scroll-mt-20 space-y-4">
        <h2 className="text-lg font-semibold text-stone-800">Facturas comerciales</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <p className="text-sm text-stone-500">Documentos emitidos</p>
            <p className="text-2xl font-bold">{facturas.length}</p>
          </Card>
          <Card>
            <p className="text-sm text-stone-500">Total facturado</p>
            <p className="text-2xl font-bold text-amber-700">{formatCOP(totalFacturas)}</p>
          </Card>
        </div>
        <Card>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Listado</CardTitle>
            <Link href="/facturas" className="text-sm text-orange-700 underline">
              Ver módulo
            </Link>
          </div>
          <ul className="mt-3 max-h-80 divide-y overflow-y-auto text-sm">
            {facturas.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <p className="font-medium">
                    {f.numero} · {f.cliente_nombre}
                  </p>
                  <p className="text-xs text-stone-500">
                    {formatDateTime(f.created_at)} · {f.origen}
                    {f.cliente_documento ? ` · ${f.cliente_documento}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
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
              <li className="py-2 text-stone-500">Sin facturas en el rango</li>
            )}
          </ul>
        </Card>
      </section>

      {/* ─── INVENTARIO ────────────────────────────────────────── */}
      <section id="inventario" className="scroll-mt-20 space-y-4">
        <h2 className="text-lg font-semibold text-stone-800">Inventario</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>Stock bajo mínimo ({stockBajos.length})</CardTitle>
              <Link href="/inventario" className="text-sm text-orange-700 underline">
                Inventario
              </Link>
            </div>
            <ul className="mt-3 max-h-72 divide-y overflow-y-auto text-sm">
              {stockBajos.map((p) => (
                <li key={p.id} className="flex justify-between gap-2 py-2">
                  <span>{p.nombre}</span>
                  <span className="font-medium text-amber-800">
                    {p.stock ?? 0} / mín {p.stock_minimo ?? 0}
                  </span>
                </li>
              ))}
              {stockBajos.length === 0 && (
                <li className="py-2 text-stone-500">Sin alertas de stock mínimo</li>
              )}
            </ul>
          </Card>
          <Card>
            <CardTitle>Kardex del periodo</CardTitle>
            <ul className="mt-3 max-h-72 divide-y overflow-y-auto text-sm">
              {stockMovs.map((m) => {
                const prod = m.productos as { nombre?: string } | null;
                return (
                  <li key={m.id} className="py-2">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{prod?.nombre ?? "Producto"}</span>
                      <span
                        className={
                          Number(m.cantidad) < 0 ? "text-red-600" : "text-emerald-700"
                        }
                      >
                        {Number(m.cantidad) > 0 ? "+" : ""}
                        {m.cantidad} · stock {m.stock_despues}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400">
                      {m.tipo} · {formatDateTime(m.created_at)}
                      {m.notas ? ` · ${m.notas}` : ""}
                    </p>
                  </li>
                );
              })}
              {stockMovs.length === 0 && (
                <li className="py-2 text-stone-500">Sin movimientos en el rango</li>
              )}
            </ul>
          </Card>
        </div>
      </section>
    </div>
  );
}
