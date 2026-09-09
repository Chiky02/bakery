import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cuentaId: string }> },
) {
  const { cuentaId } = await params;
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  if (!["dueno", "admin", "mesero", "caja"].includes(ctx.rol)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { total_final, medio_pago } = body as {
    total_final?: number;
    medio_pago?: string;
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
    .select("producto_id, cantidad")
    .eq("cuenta_mesa_id", cuentaId)
    .neq("estado", "cancelado");

  const total = Math.max(0, Math.round(Number(total_final) || 0));
  const tieneItems = (items?.length ?? 0) > 0;
  /** Sin cobro: liberar mesa sin registrar venta (ni stock ni turno). */
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
    };

    let { error } = await supabase
      .from("cuentas_mesa")
      .update(payloadCancelada)
      .eq("id", cuentaId)
      .eq("panaderia_id", ctx.panaderia.id);

    // Fallback si el enum 'cancelada' aún no está aplicado
    if (error && /cancelada|invalid input value/i.test(error.message)) {
      ({ error } = await supabase
        .from("cuentas_mesa")
        .update({
          estado: "cerrada",
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

  const productIds = [...new Set((items ?? []).map((i) => i.producto_id).filter(Boolean))];
  const controlById = new Map<string, boolean>();
  if (productIds.length > 0) {
    const { data: prods } = await supabase
      .from("productos")
      .select("id, control_stock")
      .in("id", productIds);
    for (const p of prods ?? []) {
      controlById.set(p.id, !!p.control_stock);
    }
  }

  const { data: turno } = await supabase
    .from("turnos_caja")
    .select("id")
    .eq("panaderia_id", ctx.panaderia.id)
    .eq("estado", "abierto")
    .maybeSingle();

  const { error } = await supabase
    .from("cuentas_mesa")
    .update({
      estado: "cerrada",
      hora_cierre: new Date().toISOString(),
      total_final: total,
      medio_pago: medio_pago ?? null,
      turno_id: turno?.id ?? null,
    })
    .eq("id", cuentaId)
    .eq("panaderia_id", ctx.panaderia.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase
    .from("sub_cuentas")
    .update({ estado: "cerrada", total, medio_pago: medio_pago ?? null })
    .eq("cuenta_mesa_id", cuentaId)
    .eq("estado", "abierta");

  await supabase
    .from("items_cuenta")
    .update({ estado: "entregado", updated_at: new Date().toISOString() })
    .eq("cuenta_mesa_id", cuentaId)
    .neq("estado", "cancelado");

  for (const it of items ?? []) {
    if (!it.producto_id || !controlById.get(it.producto_id)) continue;
    await supabase.rpc("ajustar_stock", {
      p_producto: it.producto_id,
      p_cantidad: -Number(it.cantidad),
      p_tipo: "venta",
      p_referencia: cuentaId,
      p_notas: "Cierre mesa",
    });
  }

  const mErr = await liberarMesa();
  if (mErr) {
    return NextResponse.json(
      { error: `Cuenta cerrada pero mesa no liberada: ${mErr.message}` },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, sin_venta: false });
}
