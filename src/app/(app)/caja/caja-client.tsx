"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatCOP, formatDateTime } from "@/lib/format";
import {
  emptyConteo,
  resumenConteo,
  totalConteo,
  type ConteoDenominaciones,
} from "@/lib/caja-denominaciones";
import type { Factura, MedioPago, TurnoCaja } from "@/types";
import { CashCounter } from "@/components/app/cash-counter";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

function todayInputLocal() {
  const d = new Date();
  // Mostrar fechas en UI; el API filtra con Bogotá
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthStartInputLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

type CuentaRow = {
  id: string;
  hora_apertura: string;
  mesas?: { nombre?: string; id?: string } | null;
};

type VentaRow = {
  id: string;
  fecha_hora: string;
  total: number;
  medio_pago: MedioPago;
  detalle: {
    nombre: string;
    cantidad: number;
    precio: number;
    subtotal: number;
    producto_id?: string;
  }[];
  factura_id?: string | null;
  anulado?: boolean;
};

type MesaCerradaRow = {
  id: string;
  hora_cierre: string;
  total: number;
  medio_pago: MedioPago | null;
  mesa_nombre: string;
  detalle: { producto_id?: string; nombre: string; cantidad: number; precio: number }[];
};

type FacturaRow = {
  id: string;
  numero: string;
  cliente_nombre: string;
  total: number;
  created_at: string;
  origen: string;
};

type FacturaTarget =
  | { kind: "mostrador"; venta: VentaRow }
  | { kind: "mesa"; mesa: MesaCerradaRow };

export function CajaClient({
  cuentas,
  ventasHoy,
  mesasCerradasHoy,
  facturasRecientes,
  turnoInicial,
  totalMesasAbiertas,
}: {
  cuentas: CuentaRow[];
  ventasHoy: VentaRow[];
  mesasCerradasHoy: MesaCerradaRow[];
  facturasRecientes: FacturaRow[];
  turnoInicial: TurnoCaja | null;
  totalMesasAbiertas: number;
}) {
  const [ventas, setVentas] = useState(ventasHoy);
  const [turno, setTurno] = useState<TurnoCaja | null>(turnoInicial);
  const [conteoApertura, setConteoApertura] = useState<ConteoDenominaciones>(() => emptyConteo());
  const [conteoCierre, setConteoCierre] = useState<ConteoDenominaciones>(() => emptyConteo());
  const [electronicoContado, setElectronicoContado] = useState("0");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState<FacturaTarget | null>(null);
  const [cliente, setCliente] = useState({
    nombre: "",
    documento: "",
    email: "",
    telefono: "",
    direccion: "",
  });
  const [ivaPct, setIvaPct] = useState("0");
  const [histDesde, setHistDesde] = useState(monthStartInputLocal);
  const [histHasta, setHistHasta] = useState(todayInputLocal);
  const [historial, setHistorial] = useState<TurnoCaja[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [histMsg, setHistMsg] = useState("");

  async function cargarHistorial(desde = histDesde, hasta = histHasta) {
    setHistLoading(true);
    setHistMsg("");
    const res = await fetch(
      `/api/caja/turnos?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`,
    );
    const body = await res.json().catch(() => ({}));
    setHistLoading(false);
    if (!res.ok) {
      setHistMsg(body.error ?? "No se pudo cargar el historial");
      setHistorial([]);
      return;
    }
    setHistorial((body.turnos as TurnoCaja[]) ?? []);
    if (body.error) setHistMsg(body.error);
  }

  useEffect(() => {
    void cargarHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial
  }, []);

  const totalMostrador = useMemo(
    () => ventas.reduce((s, v) => s + v.total, 0),
    [ventas],
  );
  const totalMesasHoy = useMemo(
    () => mesasCerradasHoy.reduce((s, m) => s + m.total, 0),
    [mesasCerradasHoy],
  );
  const porMedio = useMemo(() => {
    const m: Record<string, number> = {};
    ventas.forEach((v) => {
      m[v.medio_pago] = (m[v.medio_pago] ?? 0) + v.total;
    });
    mesasCerradasHoy.forEach((c) => {
      const key = c.medio_pago ?? "mesa";
      m[key] = (m[key] ?? 0) + c.total;
    });
    return m;
  }, [ventas, mesasCerradasHoy]);

  const esperadoEfectivoPreview = useMemo(() => {
    let e = turno?.fondo_inicial ?? 0;
    ventas.forEach((v) => {
      if (v.medio_pago === "efectivo") e += v.total;
      else if (v.medio_pago === "mixto") e += Math.round(v.total / 2);
    });
    mesasCerradasHoy.forEach((c) => {
      if (c.medio_pago === "efectivo") e += c.total;
      else if (c.medio_pago === "mixto") e += Math.round(c.total / 2);
    });
    return e;
  }, [turno, ventas, mesasCerradasHoy]);

  const esperadoElectronicoPreview = useMemo(() => {
    let e = 0;
    ventas.forEach((v) => {
      if (v.medio_pago === "electronico") e += v.total;
      else if (v.medio_pago === "mixto") e += v.total - Math.round(v.total / 2);
    });
    mesasCerradasHoy.forEach((c) => {
      if (c.medio_pago === "electronico") e += c.total;
      else if (c.medio_pago === "mixto") e += c.total - Math.round(c.total / 2);
    });
    return e;
  }, [ventas, mesasCerradasHoy]);

  async function anularVenta(id: string) {
    if (!confirm("¿Anular esta venta? Se quitará de reportes y se revertirá stock controlado.")) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/ventas/${id}/anular`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(body.error ?? "No se pudo anular");
      return;
    }
    setVentas((prev) => prev.filter((v) => v.id !== id));
    setMsg("Venta anulada");
  }

  async function abrirTurno() {
    setBusy(true);
    setMsg("");
    const fondo = totalConteo(conteoApertura);
    const res = await fetch("/api/caja/turno", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fondo_inicial: fondo,
        detalle_apertura: conteoApertura,
        notas_apertura: resumenConteo(conteoApertura),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(body.error ?? "No se pudo abrir turno");
      return;
    }
    setTurno(body as TurnoCaja);
    setConteoApertura(emptyConteo());
    setMsg(`Turno abierto · fondo ${formatCOP(fondo)}`);
    void cargarHistorial();
  }

  async function cerrarTurno() {
    setBusy(true);
    setMsg("");
    const efectivo = totalConteo(conteoCierre);
    const res = await fetch("/api/caja/turno/cerrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        efectivo_contado: efectivo,
        electronico_contado: Number(electronicoContado) || 0,
        detalle_cierre: conteoCierre,
        notas_cierre: resumenConteo(conteoCierre),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(body.error ?? "No se pudo cerrar");
      return;
    }
    setTurno(null);
    setConteoCierre(emptyConteo());
    const difEf =
      body.diferencia_efectivo ??
      body._diferencia_efectivo ??
      totalConteo(conteoCierre) - esperadoEfectivoPreview;
    const difEl =
      body.diferencia_electronico ??
      body._diferencia_electronico ??
      (Number(electronicoContado) || 0) - esperadoElectronicoPreview;
    setMsg(
      `Turno cerrado · dif. efectivo ${formatCOP(difEf)} · dif. electrónico ${formatCOP(difEl)}`,
    );
    void cargarHistorial();
  }

  async function emitirFactura() {
    if (!target) return;
    if (!cliente.nombre.trim()) {
      setMsg("Indica el nombre / razón social del cliente");
      return;
    }
    setBusy(true);
    setMsg("");

    const detalle =
      target.kind === "mostrador"
        ? target.venta.detalle.map((d) => ({
            producto_id: d.producto_id,
            nombre: d.nombre,
            cantidad: d.cantidad,
            precio: d.precio,
          }))
        : target.mesa.detalle.map((d) => ({
            producto_id: d.producto_id,
            nombre: d.nombre,
            cantidad: d.cantidad,
            precio: d.precio,
          }));

    if (!detalle.length) {
      setBusy(false);
      setMsg("La venta no tiene ítems para facturar");
      return;
    }

    const res = await fetch("/api/facturas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origen: target.kind === "mostrador" ? "mostrador" : "mesa",
        venta_id: target.kind === "mostrador" ? target.venta.id : null,
        cuenta_mesa_id: target.kind === "mesa" ? target.mesa.id : null,
        cliente_nombre: cliente.nombre.trim(),
        cliente_documento: cliente.documento.trim() || null,
        cliente_email: cliente.email.trim() || null,
        cliente_telefono: cliente.telefono.trim() || null,
        cliente_direccion: cliente.direccion.trim() || null,
        medio_pago:
          target.kind === "mostrador"
            ? target.venta.medio_pago
            : target.mesa.medio_pago,
        iva_porcentaje: Number(ivaPct) || 0,
        detalle,
        notas: "Documento comercial de venta (no es factura electrónica DIAN).",
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(body.error ?? "No se emitió la factura");
      return;
    }
    const f = body as Factura;
    setTarget(null);
    setCliente({ nombre: "", documento: "", email: "", telefono: "", direccion: "" });
    window.open(`/facturas/${f.id}`, "_blank");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Caja</h1>
        <p className="text-sm text-stone-500">
          Turno del día, mesas y facturas de venta imprimibles (sin FE DIAN)
        </p>
      </div>

      {msg && <p className="text-sm text-orange-700">{msg}</p>}

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Turno de caja</CardTitle>
          {turno ? (
            <Badge color="success">Abierto</Badge>
          ) : (
            <Badge color="warning">Sin turno</Badge>
          )}
        </div>
        {turno ? (
          <>
            <p className="text-sm text-stone-500">
              Desde {formatDateTime(turno.apertura_at)} · Fondo {formatCOP(turno.fondo_inicial)}
            </p>
            {turno.detalle_apertura && (
              <p className="text-xs text-stone-400">{resumenConteo(turno.detalle_apertura)}</p>
            )}
            {!turno.detalle_apertura && turno.notas_apertura && (
              <p className="text-xs text-stone-400">{turno.notas_apertura}</p>
            )}
            <CashCounter
              idPrefix="cierre"
              title="Arqueo — billetes y monedas"
              value={conteoCierre}
              onChange={setConteoCierre}
            />
            <div>
              <label htmlFor="caja-electronico" className="text-xs font-medium">
                Electrónico contado (datáfono / transfer)
              </label>
              <Input
                id="caja-electronico"
                name="caja-electronico"
                type="number"
                className="mt-1"
                value={electronicoContado}
                onChange={(e) => setElectronicoContado(e.target.value)}
              />
            </div>
            <p className="text-xs text-stone-400">
              Esperado turno: efectivo {formatCOP(esperadoEfectivoPreview)} · electrónico{" "}
              {formatCOP(esperadoElectronicoPreview)} (fondo + ventas del turno / hoy)
            </p>
            <p className="text-xs text-stone-400">
              App hoy: efectivo {formatCOP(porMedio.efectivo ?? 0)} · electrónico{" "}
              {formatCOP(porMedio.electronico ?? 0)} · mixto {formatCOP(porMedio.mixto ?? 0)} ·
              mesas {formatCOP(totalMesasHoy)}
            </p>
            <p className="text-xs font-medium text-stone-600">
              Diferencia preview: efectivo{" "}
              {formatCOP(totalConteo(conteoCierre) - esperadoEfectivoPreview)} · electrónico{" "}
              {formatCOP((Number(electronicoContado) || 0) - esperadoElectronicoPreview)}
            </p>
            <Button variant="danger" disabled={busy} onClick={cerrarTurno}>
              Cerrar turno / arqueo
            </Button>
          </>
        ) : (
          <>
            <CashCounter
              idPrefix="apertura"
              title="Fondo inicial — billetes y monedas"
              value={conteoApertura}
              onChange={setConteoApertura}
            />
            <Button disabled={busy} onClick={abrirTurno}>
              Abrir turno · {formatCOP(totalConteo(conteoApertura))}
            </Button>
          </>
        )}
      </Card>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Historial de aperturas / cierres</CardTitle>
          <Link href="/reportes" className="text-xs text-orange-700 underline">
            Ver en reportes
          </Link>
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void cargarHistorial();
          }}
        >
          <div>
            <label htmlFor="caja-hist-desde" className="text-xs font-medium">
              Desde
            </label>
            <Input
              id="caja-hist-desde"
              name="caja-hist-desde"
              type="date"
              className="mt-1"
              value={histDesde}
              onChange={(e) => setHistDesde(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="caja-hist-hasta" className="text-xs font-medium">
              Hasta
            </label>
            <Input
              id="caja-hist-hasta"
              name="caja-hist-hasta"
              type="date"
              className="mt-1"
              value={histHasta}
              onChange={(e) => setHistHasta(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" disabled={histLoading}>
            {histLoading ? "Cargando..." : "Filtrar"}
          </Button>
        </form>
        {histMsg && <p className="text-xs text-orange-700">{histMsg}</p>}
        {!historial.length ? (
          <p className="text-sm text-stone-500">Sin turnos en el rango</p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto text-sm">
            {historial.map((t) => (
              <li key={t.id} className="space-y-1 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge color={t.estado === "abierto" ? "success" : "default"}>
                      {t.estado}
                    </Badge>
                    <span>{formatDateTime(t.apertura_at)}</span>
                  </div>
                  <span className="font-medium tabular-nums">
                    Fondo {formatCOP(t.fondo_inicial)}
                  </span>
                </div>
                {t.detalle_apertura && (
                  <p className="text-xs text-stone-400">
                    Apertura: {resumenConteo(t.detalle_apertura)}
                  </p>
                )}
                {t.estado === "cerrado" && (
                  <p className="text-xs text-stone-500">
                    Cierre {t.cierre_at ? formatDateTime(t.cierre_at) : "—"} · Ef.{" "}
                    {formatCOP(t.efectivo_contado ?? 0)} · El.{" "}
                    {formatCOP(t.electronico_contado ?? 0)}
                    {t.diferencia_efectivo != null
                      ? ` · Dif.ef ${formatCOP(t.diferencia_efectivo)}`
                      : ""}
                    {t.diferencia_electronico != null
                      ? ` · Dif.el ${formatCOP(t.diferencia_electronico)}`
                      : ""}
                    {t.detalle_cierre ? ` · ${resumenConteo(t.detalle_cierre)}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Mesas abiertas ({cuentas.length})</CardTitle>
          {!cuentas.length ? (
            <p className="mt-4 text-sm text-stone-500">Todas las mesas están libres</p>
          ) : (
            <ul className="mt-4 divide-y">
              {cuentas.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-medium">{c.mesas?.nombre ?? "Mesa"}</p>
                    <p className="text-xs text-stone-500">
                      Abierta {formatDateTime(c.hora_apertura)}
                    </p>
                  </div>
                  <Link href={`/mesas/${c.mesas?.id ?? ""}`}>
                    <Button size="sm">Cobrar</Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-stone-400">
            Total referencia mesas abiertas (conteo): {totalMesasAbiertas}
          </p>
        </Card>

        <Card>
          <CardTitle>Mostrador hoy · {formatCOP(totalMostrador)}</CardTitle>
          {!ventas.length ? (
            <p className="mt-4 text-sm text-stone-500">Sin ventas registradas</p>
          ) : (
            <ul className="mt-4 max-h-80 divide-y overflow-y-auto">
              {ventas.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p>{formatDateTime(v.fecha_hora)}</p>
                    <p className="capitalize text-stone-500">{v.medio_pago}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <span className="font-semibold">{formatCOP(v.total)}</span>
                    <Link href={`/ventas/${v.id}/ticket`} target="_blank">
                      <Button size="sm" variant="secondary">
                        Ticket
                      </Button>
                    </Link>
                    {v.factura_id ? (
                      <Link href={`/facturas/${v.factura_id}`} target="_blank">
                        <Button size="sm" variant="secondary">
                          Factura
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setTarget({ kind: "mostrador", venta: v })}
                      >
                        Factura
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy}
                      onClick={() => void anularVenta(v.id)}
                    >
                      Anular
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle>Mesas cerradas hoy · {formatCOP(totalMesasHoy)}</CardTitle>
        {!mesasCerradasHoy.length ? (
          <p className="mt-4 text-sm text-stone-500">Sin mesas cerradas hoy</p>
        ) : (
          <ul className="mt-4 max-h-72 divide-y overflow-y-auto">
            {mesasCerradasHoy.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <p className="font-medium">{m.mesa_nombre}</p>
                  <p className="text-xs text-stone-500">
                    {m.hora_cierre ? formatDateTime(m.hora_cierre) : "—"}
                    {m.medio_pago ? ` · ${m.medio_pago}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatCOP(m.total)}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!m.detalle.length}
                    onClick={() => setTarget({ kind: "mesa", mesa: m })}
                  >
                    Factura
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {facturasRecientes.length > 0 && (
        <Card>
          <CardTitle>Facturas recientes</CardTitle>
          <ul className="mt-4 divide-y">
            {facturasRecientes.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <p className="font-medium">
                    {f.numero} · {f.cliente_nombre}
                  </p>
                  <p className="text-xs capitalize text-stone-500">
                    {f.origen} · {formatDateTime(f.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span>{formatCOP(f.total)}</span>
                  <Link href={`/facturas/${f.id}`} target="_blank">
                    <Button size="sm" variant="secondary">
                      Abrir
                    </Button>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {target && (
        <Card className="space-y-3">
          <CardTitle>Emitir factura de venta (impresa)</CardTitle>
          <p className="text-xs text-stone-500">
            Documento comercial para empresas. No constituye factura electrónica DIAN.
            {target.kind === "mesa"
              ? ` Mesa: ${target.mesa.mesa_nombre}`
              : ` Venta mostrador ${formatCOP(target.venta.total)}`}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              id="factura-nombre"
              name="factura-nombre"
              placeholder="Razón social / nombre *"
              value={cliente.nombre}
              onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
            />
            <Input
              id="factura-documento"
              name="factura-documento"
              placeholder="NIT / CC"
              value={cliente.documento}
              onChange={(e) => setCliente({ ...cliente, documento: e.target.value })}
            />
            <Input
              id="factura-email"
              name="factura-email"
              type="email"
              placeholder="Email"
              value={cliente.email}
              onChange={(e) => setCliente({ ...cliente, email: e.target.value })}
            />
            <Input
              id="factura-telefono"
              name="factura-telefono"
              placeholder="Teléfono"
              value={cliente.telefono}
              onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
            />
            <Input
              id="factura-direccion"
              name="factura-direccion"
              className="sm:col-span-2"
              placeholder="Dirección"
              value={cliente.direccion}
              onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })}
            />
            <div>
              <label htmlFor="factura-iva" className="text-xs">
                IVA % (0 si no aplica)
              </label>
              <Input
                id="factura-iva"
                name="factura-iva"
                type="number"
                value={ivaPct}
                onChange={(e) => setIvaPct(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button disabled={busy} onClick={() => void emitirFactura()}>
              Emitir e imprimir
            </Button>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
