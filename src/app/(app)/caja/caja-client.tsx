"use client";

import { useMemo, useState } from "react";
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

  const totalMostrador = useMemo(
    () => ventasHoy.reduce((s, v) => s + v.total, 0),
    [ventasHoy],
  );
  const totalMesasHoy = useMemo(
    () => mesasCerradasHoy.reduce((s, m) => s + m.total, 0),
    [mesasCerradasHoy],
  );
  const porMedio = useMemo(() => {
    const m: Record<string, number> = {};
    ventasHoy.forEach((v) => {
      m[v.medio_pago] = (m[v.medio_pago] ?? 0) + v.total;
    });
    mesasCerradasHoy.forEach((c) => {
      const key = c.medio_pago ?? "mesa";
      m[key] = (m[key] ?? 0) + c.total;
    });
    return m;
  }, [ventasHoy, mesasCerradasHoy]);

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
    setMsg(`Turno cerrado · efectivo ${formatCOP(efectivo)}`);
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
              title="Arqueo — cuenta billetes y monedas"
              value={conteoCierre}
              onChange={setConteoCierre}
            />
            <div>
              <label className="text-xs font-medium">Electrónico contado (datáfono / transfer)</label>
              <Input
                type="number"
                className="mt-1"
                value={electronicoContado}
                onChange={(e) => setElectronicoContado(e.target.value)}
              />
            </div>
            <p className="text-xs text-stone-400">
              App hoy: efectivo {formatCOP(porMedio.efectivo ?? 0)} · electrónico{" "}
              {formatCOP(porMedio.electronico ?? 0)} · mixto {formatCOP(porMedio.mixto ?? 0)} ·
              mesas {formatCOP(totalMesasHoy)}
            </p>
            <Button variant="danger" disabled={busy} onClick={cerrarTurno}>
              Cerrar turno / arqueo
            </Button>
          </>
        ) : (
          <>
            <CashCounter
              title="Fondo inicial — cuenta lo que hay en caja"
              value={conteoApertura}
              onChange={setConteoApertura}
            />
            <Button disabled={busy} onClick={abrirTurno}>
              Abrir turno · {formatCOP(totalConteo(conteoApertura))}
            </Button>
          </>
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
          {!ventasHoy.length ? (
            <p className="mt-4 text-sm text-stone-500">Sin ventas registradas</p>
          ) : (
            <ul className="mt-4 max-h-80 divide-y overflow-y-auto">
              {ventasHoy.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <p>{formatDateTime(v.fecha_hora)}</p>
                    <p className="capitalize text-stone-500">{v.medio_pago}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatCOP(v.total)}</span>
                    {v.factura_id ? (
                      <Link href={`/facturas/${v.factura_id}`} target="_blank">
                        <Button size="sm" variant="secondary">
                          Ver
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
              placeholder="Razón social / nombre *"
              value={cliente.nombre}
              onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
            />
            <Input
              placeholder="NIT / CC"
              value={cliente.documento}
              onChange={(e) => setCliente({ ...cliente, documento: e.target.value })}
            />
            <Input
              placeholder="Email"
              value={cliente.email}
              onChange={(e) => setCliente({ ...cliente, email: e.target.value })}
            />
            <Input
              placeholder="Teléfono"
              value={cliente.telefono}
              onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })}
            />
            <Input
              className="sm:col-span-2"
              placeholder="Dirección"
              value={cliente.direccion}
              onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })}
            />
            <div>
              <label className="text-xs">IVA % (0 si no aplica)</label>
              <Input value={ivaPct} onChange={(e) => setIvaPct(e.target.value)} />
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
