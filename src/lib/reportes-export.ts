import * as XLSX from "xlsx";
import { aporteEfectivo, aporteElectronico } from "@/lib/pago-split";
import type { ProductoAgregado, VentaLineaDetalle } from "@/lib/reportes-detalle";

type VentaRow = {
  id: string;
  total?: number | null;
  fecha_hora?: string | null;
  medio_pago?: string | null;
  monto_efectivo?: number | null;
  monto_electronico?: number | null;
};

type MesaRow = {
  id: string;
  total_final?: number | null;
  medio_pago?: string | null;
  hora_cierre?: string | null;
  monto_efectivo?: number | null;
  monto_electronico?: number | null;
  mesas?: { nombre?: string } | null;
};

type MovCaja = {
  tipo?: string | null;
  monto_efectivo?: number | null;
  monto_electronico?: number | null;
  referencia_id?: string | null;
  notas?: string | null;
  created_at?: string | null;
};

type TurnoRow = {
  estado?: string | null;
  apertura_at?: string | null;
  cierre_at?: string | null;
  fondo_inicial?: number | null;
  efectivo_contado?: number | null;
  electronico_contado?: number | null;
  efectivo_esperado?: number | null;
  electronico_esperado?: number | null;
};

type FacturaRow = {
  numero?: string | null;
  origen?: string | null;
  cliente_nombre?: string | null;
  cliente_documento?: string | null;
  total?: number | null;
  medio_pago?: string | null;
  created_at?: string | null;
};

type EncargoRow = {
  cliente_nombre?: string | null;
  fecha_entrega?: string | null;
  estado?: string | null;
  estado_pago?: string | null;
  valor?: number | null;
  abono?: number | null;
};

type StockMov = {
  tipo?: string | null;
  cantidad?: number | null;
  stock_despues?: number | null;
  referencia?: string | null;
  notas?: string | null;
  created_at?: string | null;
  productos?: { nombre?: string } | null;
};

type StockBajo = {
  nombre?: string | null;
  stock?: number | null;
  stock_minimo?: number | null;
};

export type ReportesExportInput = {
  panaderiaNombre: string;
  desde: string;
  hasta: string;
  ventas: VentaRow[];
  mesas: MesaRow[];
  movsCaja: MovCaja[];
  turnos: TurnoRow[];
  facturas: FacturaRow[];
  encargos: EncargoRow[];
  stockMovs: StockMov[];
  stockBajos: StockBajo[];
  lineasDetalle: VentaLineaDetalle[];
  porProducto: ProductoAgregado[];
  totales: {
    mostrador: number;
    mesas: number;
    encargos: number;
    facturas: number;
    general: number;
  };
};

function sheet(rows: (string | number | null | undefined)[][]) {
  return XLSX.utils.aoa_to_sheet(
    rows.map((r) => r.map((c) => (c == null ? "" : c))),
  );
}

/** Genera un .xlsx con hojas por sección del reporte. */
export function buildReportesWorkbook(input: ReportesExportInput): Buffer {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    sheet([
      ["Negocio", input.panaderiaNombre],
      ["Desde", input.desde],
      ["Hasta", input.hasta],
      [],
      ["Concepto", "Total"],
      ["Ventas mostrador", input.totales.mostrador],
      ["Ventas mesas", input.totales.mesas],
      ["Encargos / caja", input.totales.encargos],
      ["Facturas (suma)", input.totales.facturas],
      ["Total general", input.totales.general],
      ["Unidades vendidas", input.porProducto.reduce((s, p) => s + p.cantidad, 0)],
      ["Productos distintos", input.porProducto.length],
    ]),
    "Resumen",
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet([
      ["Producto", "Categoría", "Cantidad", "Total"],
      ...input.porProducto.map((p) => [
        p.producto,
        p.categoria,
        p.cantidad,
        p.subtotal,
      ]),
    ]),
    "Por producto",
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet([
      [
        "Fecha/hora",
        "Producto",
        "Categoría",
        "Cantidad",
        "Precio unit.",
        "Subtotal",
        "Canal",
        "Referencia",
      ],
      ...input.lineasDetalle.map((l) => [
        l.fecha_hora,
        l.producto,
        l.categoria,
        l.cantidad,
        l.precio_unit,
        l.subtotal,
        l.canal,
        l.referencia,
      ]),
    ]),
    "Detalle items",
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet([
      [
        "Tipo",
        "Fecha",
        "Detalle",
        "Medio pago",
        "Efectivo",
        "Electrónico",
        "Total",
      ],
      ...input.ventas.map((v) => [
        "mostrador",
        v.fecha_hora ?? "",
        `venta ${v.id}`,
        v.medio_pago ?? "",
        aporteEfectivo(v),
        aporteElectronico(v),
        v.total ?? 0,
      ]),
      ...input.mesas.map((c) => [
        "mesa",
        c.hora_cierre ?? "",
        c.mesas?.nombre ?? "mesa",
        c.medio_pago ?? "",
        aporteEfectivo({ ...c, total: c.total_final }),
        aporteElectronico({ ...c, total: c.total_final }),
        c.total_final ?? 0,
      ]),
    ]),
    "Tickets",
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet([
      [
        "Tipo",
        "Fecha",
        "Detalle",
        "Efectivo",
        "Electrónico",
        "Total",
        "Estado turno",
      ],
      ...input.movsCaja.map((m) => [
        m.tipo ?? "movimiento",
        m.created_at ?? "",
        m.notas ?? m.referencia_id ?? "",
        m.monto_efectivo ?? 0,
        m.monto_electronico ?? 0,
        (Number(m.monto_efectivo) || 0) + (Number(m.monto_electronico) || 0),
        "",
      ]),
      ...input.turnos.map((t) => [
        "turno",
        t.apertura_at ?? "",
        `fondo ${t.fondo_inicial ?? 0}`,
        t.efectivo_contado ?? "",
        t.electronico_contado ?? "",
        "",
        t.estado ?? "",
      ]),
    ]),
    "Caja",
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet([
      ["Número", "Origen", "Fecha", "Cliente", "Documento", "Medio pago", "Total"],
      ...input.facturas.map((f) => [
        f.numero ?? "",
        f.origen ?? "",
        f.created_at ?? "",
        f.cliente_nombre ?? "",
        f.cliente_documento ?? "",
        f.medio_pago ?? "",
        f.total ?? 0,
      ]),
    ]),
    "Facturas",
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet([
      ["Cliente", "Entrega", "Estado", "Estado pago", "Valor", "Abono"],
      ...input.encargos.map((e) => [
        e.cliente_nombre ?? "",
        e.fecha_entrega ?? "",
        e.estado ?? "",
        e.estado_pago ?? "",
        e.valor ?? 0,
        e.abono ?? 0,
      ]),
    ]),
    "Encargos",
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet([
      ["Fecha", "Producto", "Tipo", "Cantidad", "Stock después", "Referencia", "Notas"],
      ...input.stockMovs.map((m) => [
        m.created_at ?? "",
        m.productos?.nombre ?? "",
        m.tipo ?? "",
        m.cantidad ?? 0,
        m.stock_despues ?? "",
        m.referencia ?? "",
        m.notas ?? "",
      ]),
    ]),
    "Inventario",
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet([
      ["Producto", "Stock", "Mínimo"],
      ...input.stockBajos.map((p) => [
        p.nombre ?? "",
        p.stock ?? 0,
        p.stock_minimo ?? 0,
      ]),
    ]),
    "Stock bajo",
  );

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
