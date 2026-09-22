import { NextResponse } from "next/server";
import { requireApiAnyPermiso } from "@/lib/api-context";
import { getTurnoAbiertoId, sinTurnoCajaResponse } from "@/lib/turno-caja";
import { resolvePagoDesglose } from "@/lib/pago-split";
import type { MedioPago } from "@/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cuentaId: string }> },
) {
  const { cuentaId } = await params;
  const result = await requireApiAnyPermiso(["mesas", "caja"]);
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  const body = await request.json().catch(() => ({}));
  const {
    total_final: _ignoredClientTotal,
    medio_pago,
    monto_efectivo,
    monto_electronico,
  } = body as {
    total_final?: number;
    medio_pago?: MedioPago;
    monto_efectivo?: number;
    monto_electronico?: number;
  };

  const { data: cuenta, error: cErr } = await supabase
    .from("cuentas_mesa")
    .select("id, mesa_id, panaderia_id, estado")
    .eq("id", cuentaId)
    .eq("panaderia_id", ctx.panaderia.id)
    .single();

  if (cErr || !cuenta) {
    return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  }
  if (cuenta.estado === "cerrada" || cuenta.estado === "cancelada") {
    return NextResponse.json({ ok: true, already: true });
  }

  const { data: items } = await supabase
    .from("items_cuenta")
    .select("id, producto_id, cantidad, precio_al_momento, estado, sub_cuenta_id")
    .eq("cuenta_mesa_id", cuentaId)
    .neq("estado", "cancelado");

  const pendientes = (items ?? []).filter((i) => i.estado === "pendiente_confirmacion");
  if (pendientes.length > 0) {
    return NextResponse.json(
      {
        error: `Hay ${pendientes.length} ítem(s) del QR sin aprobar. Confírmalos o cancélalos antes de cobrar.`,
      },
      { status: 409 },
    );
  }

  const cobrables = items ?? [];
  const total = cobrables.reduce(
    (s, i) => s + Math.round(Number(i.precio_al_momento) * Number(i.cantidad)),
    0,
  );
  const tieneItems = cobrables.length > 0;
  const sinVenta = total <= 0 || !tieneItems;
  const mesaId = cuenta.mesa_id;

  async function liberarMesa() {
    if (!mesaId) return null;
    const { error: mErr } = await supabase
      .from("mesas")
      .update({ estado: "libre" })
      .eq("id", mesaId)
      .eq("panaderia_id", ctx.panaderia.id);
    return mErr;
  }

  if (sinVenta) {
    const payloadCancelada = {
      estado: "cancelada" as const,
      hora_cierre: new Date().toISOString(),
      total_final: 0,
      medio_pago: null,
      turno_id: null,
      monto_efectivo: 0,
      monto_electronico: 0,
    };

    let { error } = await supabase
      .from("cuentas_mesa")
      .update(payloadCancelada)
      .eq("id", cuentaId)
      .eq("panaderia_id", ctx.panaderia.id);

    if (error && /cancelada|invalid input value|monto_/i.test(error.message)) {
      ({ error } = await supabase
        .from("cuentas_mesa")
        .update({
          estado: /cancelada|invalid/i.test(error.message) ? "cerrada" : "cancelada",
          hora_cierre: payloadCancelada.hora_cierre,
          total_final: 0,
          medio_pago: null,
          turno_id: null,
          notas: "sin_venta",
        })
        .eq("id", cuentaId)
        .eq("panaderia_id", ctx.panaderia.id));
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await supabase
      .from("sub_cuentas")
      .update({ estado: "cerrada", total: 0, medio_pago: null })
      .eq("cuenta_mesa_id", cuentaId)
      .eq("estado", "abierta");

    await supabase
      .from("items_cuenta")
      .update({ estado: "cancelado", updated_at: new Date().toISOString() })
      .eq("cuenta_mesa_id", cuentaId)
      .neq("estado", "cancelado");

    const mErr = await liberarMesa();
    if (mErr) {
      return NextResponse.json(
        { error: `Cuenta anulada pero mesa no liberada: ${mErr.message}` },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, sin_venta: true });
  }

  const medio = (medio_pago ?? "efectivo") as MedioPago;
  const pago = resolvePagoDesglose(medio, total, monto_efectivo, monto_electronico);
  if (!pago.ok) {
    return NextResponse.json({ error: pago.error }, { status: 400 });
  }

  const productIds = [...new Set(cobrables.map((i) => i.producto_id).filter(Boolean))] as string[];
  const controlById = new Map<string, boolean>();
  const stockById = new Map<string, number>();
  if (productIds.length > 0) {
    const { data: prods } = await supabase
      .from("productos")
      .select("id, control_stock, stock, nombre")
      .in("id", productIds);
    for (const p of prods ?? []) {
      controlById.set(p.id, !!p.control_stock);
      stockById.set(p.id, Number(p.stock) || 0);
    }
  }

  // Agrupar cantidades por producto para validar stock
  const qtyByProd = new Map<string, number>();
  for (const it of cobrables) {
    if (!it.producto_id) continue;
    qtyByProd.set(it.producto_id, (qtyByProd.get(it.producto_id) ?? 0) + Number(it.cantidad));
  }
  for (const [pid, qty] of qtyByProd) {
    if (!controlById.get(pid)) continue;
    if ((stockById.get(pid) ?? 0) < qty) {
      return NextResponse.json(
        { error: "Stock insuficiente para cerrar la mesa. Revisa inventario." },
        { status: 409 },
      );
    }
  }

  const turnoId = await getTurnoAbiertoId(supabase, ctx.panaderia.id);
  if (!turnoId) return sinTurnoCajaResponse();

  const updatePayload: Record<string, unknown> = {
    estado: "cerrada",
    hora_cierre: new Date().toISOString(),
    total_final: total,
    medio_pago: pago.value.medio_pago,
    turno_id: turnoId,
    monto_efectivo: pago.value.monto_efectivo,
    monto_electronico: pago.value.monto_electronico,
  };

  let { error } = await supabase
    .from("cuentas_mesa")
    .update(updatePayload)
    .eq("id", cuentaId)
    .eq("panaderia_id", ctx.panaderia.id);

  if (error && /monto_/i.test(error.message)) {
    delete updatePayload.monto_efectivo;
    delete updatePayload.monto_electronico;
    ({ error } = await supabase
      .from("cuentas_mesa")
      .update(updatePayload)
      .eq("id", cuentaId)
      .eq("panaderia_id", ctx.panaderia.id));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Totales por subcuenta
  const { data: subs } = await supabase
    .from("sub_cuentas")
    .select("id")
    .eq("cuenta_mesa_id", cuentaId)
    .eq("estado", "abierta");

  for (const sub of subs ?? []) {
    const subTotal = cobrables
      .filter((i) => i.sub_cuenta_id === sub.id)
      .reduce((s, i) => s + Math.round(Number(i.precio_al_momento) * Number(i.cantidad)), 0);
    await supabase
      .from("sub_cuentas")
      .update({
        estado: "cerrada",
        total: subTotal,
        medio_pago: pago.value.medio_pago,
      })
      .eq("id", sub.id);
  }

  // Ítems sin subcuenta: no asignan a ninguna sub; ok
  await supabase
    .from("items_cuenta")
    .update({ estado: "entregado", updated_at: new Date().toISOString() })
    .eq("cuenta_mesa_id", cuentaId)
    .neq("estado", "cancelado");

  for (const [pid, qty] of qtyByProd) {
    if (!controlById.get(pid)) continue;
    const { error: stockErr } = await supabase.rpc("ajustar_stock", {
      p_producto: pid,
      p_cantidad: -qty,
      p_tipo: "venta",
      p_referencia: cuentaId,
      p_notas: "Cierre mesa",
    });
    if (stockErr) {
      return NextResponse.json(
        {
          error: `Mesa cobrada pero falló stock: ${stockErr.message}. Revisa inventario.`,
        },
        { status: 409 },
      );
    }
  }

  const mErr = await liberarMesa();
  if (mErr) {
    return NextResponse.json(
      { error: `Cuenta cerrada pero mesa no liberada: ${mErr.message}` },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, sin_venta: false, total_final: total });
}
