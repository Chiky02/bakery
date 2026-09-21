import { NextResponse } from "next/server";
import { requireApiFeature } from "@/lib/api-context";
import { parseBogotaDateInput } from "@/lib/timezone";
import { buildReportesWorkbook } from "@/lib/reportes-export";
import { buildCategoriaMap, expandVentasDetalle } from "@/lib/reportes-detalle";

function encargoCobrado(e: {
  valor?: number | null;
  abono?: number | null;
  estado_pago?: string | null;
}) {
  if (e.estado_pago === "pagado") return e.valor ?? 0;
  if (e.estado_pago === "abonado") return e.abono ?? 0;
  return 0;
}

export async function GET(request: Request) {
  const result = await requireApiFeature("reportes");
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;
  const pid = ctx.panaderia.id;

  const url = new URL(request.url);
  const desde = url.searchParams.get("desde");
  const hasta = url.searchParams.get("hasta");
  if (!desde || !hasta || !/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return NextResponse.json({ error: "Parámetros desde/hasta inválidos" }, { status: 400 });
  }

  const desdeIso = parseBogotaDateInput(desde, false);
  const hastaIso = parseBogotaDateInput(hasta, true);

  const [
    ventasRes,
    mesasRes,
    movsRes,
    turnosRes,
    facturasRes,
    encargosRes,
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
      .from("movimientos_caja")
      .select(
        "id, tipo, monto_efectivo, monto_electronico, referencia_id, notas, created_at",
      )
      .eq("panaderia_id", pid)
      .gte("created_at", desdeIso)
      .lte("created_at", hastaIso)
      .order("created_at", { ascending: false }),
    supabase
      .from("turnos_caja")
      .select(
        "estado, apertura_at, cierre_at, fondo_inicial, efectivo_contado, electronico_contado, efectivo_esperado, electronico_esperado",
      )
      .eq("panaderia_id", pid)
      .gte("apertura_at", desdeIso)
      .lte("apertura_at", hastaIso)
      .order("apertura_at", { ascending: false }),
    supabase
      .from("facturas")
      .select(
        "numero, origen, cliente_nombre, cliente_documento, total, medio_pago, created_at",
      )
      .eq("panaderia_id", pid)
      .gte("created_at", desdeIso)
      .lte("created_at", hastaIso)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("encargos")
      .select("cliente_nombre, fecha_entrega, estado, estado_pago, valor, abono")
      .eq("panaderia_id", pid)
      .gte("fecha_entrega", desde)
      .lte("fecha_entrega", hasta)
      .order("fecha_entrega"),
    supabase
      .from("stock_movimientos")
      .select(
        "tipo, cantidad, stock_despues, referencia, notas, created_at, productos(nombre)",
      )
      .eq("panaderia_id", pid)
      .gte("created_at", desdeIso)
      .lte("created_at", hastaIso)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("productos")
      .select("nombre, stock, stock_minimo, control_stock")
      .eq("panaderia_id", pid)
      .eq("control_stock", true)
      .order("nombre")
      .limit(500),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ventas: any[] = ventasRes.data ?? [];
  if (ventasRes.error) {
    const { data } = await supabase
      .from("ventas_mostrador")
      .select("id, total, detalle, fecha_hora, medio_pago")
      .eq("panaderia_id", pid)
      .eq("anulado", false)
      .gte("fecha_hora", desdeIso)
      .lte("fecha_hora", hastaIso);
    ventas = data ?? [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mesas: any[] = mesasRes.data ?? [];
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
    mesas = data ?? [];
  }

  const movsCaja = /movimientos_caja|relation/i.test(movsRes.error?.message ?? "")
    ? []
    : (movsRes.data ?? []);
  const facturas = /facturas|relation/i.test(facturasRes.error?.message ?? "")
    ? []
    : (facturasRes.data ?? []);
  const turnos = turnosRes.data ?? [];
  const encargos = encargosRes.data ?? [];
  const stockMovs = stockMovsRes.data ?? [];
  const stockBajos = (stockBajosRes.data ?? []).filter(
    (p) => Number(p.stock ?? 0) <= Number(p.stock_minimo ?? 0),
  );

  const totalMostrador = ventas.reduce((s, v) => s + (v.total ?? 0), 0);
  const totalMesas = mesas.reduce((s, c) => s + (c.total_final ?? 0), 0);
  const totalEncargosCaja = movsCaja.reduce(
    (s, m) => s + (Number(m.monto_efectivo) || 0) + (Number(m.monto_electronico) || 0),
    0,
  );
  const totalEncargosFallback = encargos.reduce((s, e) => s + encargoCobrado(e), 0);
  const totalEncargos = movsCaja.length > 0 ? totalEncargosCaja : totalEncargosFallback;
  const totalFacturas = facturas.reduce((s, f) => s + (f.total ?? 0), 0);

  const { data: productosCat } = await supabase
    .from("productos")
    .select("id, categorias(nombre)")
    .eq("panaderia_id", pid);
  const catMap = buildCategoriaMap(productosCat ?? []);
  const { lineas: lineasDetalle, porProducto } = expandVentasDetalle({
    ventas,
    mesas,
    catMap,
  });

  const buffer = buildReportesWorkbook({
    panaderiaNombre: ctx.panaderia.nombre,
    desde,
    hasta,
    ventas,
    mesas,
    movsCaja,
    turnos,
    facturas,
    encargos,
    stockMovs: (stockMovs as Array<Record<string, unknown>>).map((m) => ({
      tipo: m.tipo as string | null,
      cantidad: m.cantidad as number | null,
      stock_despues: m.stock_despues as number | null,
      referencia: m.referencia as string | null,
      notas: m.notas as string | null,
      created_at: m.created_at as string | null,
      productos: Array.isArray(m.productos)
        ? (m.productos[0] as { nombre?: string } | undefined)
        : (m.productos as { nombre?: string } | null),
    })),
    stockBajos,
    lineasDetalle,
    porProducto,
    totales: {
      mostrador: totalMostrador,
      mesas: totalMesas,
      encargos: totalEncargos,
      facturas: totalFacturas,
      general: totalMostrador + totalMesas + totalEncargos,
    },
  });

  const filename = `reporte-${desde}-${hasta}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
