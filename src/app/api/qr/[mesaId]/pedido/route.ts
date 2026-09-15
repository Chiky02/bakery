import { NextResponse } from "next/server";
import { isUuid } from "@/lib/public-url";
import {
  assertPublicRateLimit,
  clientIp,
  getPublicServiceClient,
  tooLargeBody,
} from "@/lib/rate-limit-public";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ mesaId: string }> },
) {
  const { mesaId } = await params;
  if (!isUuid(mesaId)) {
    return NextResponse.json({ error: "Mesa inválida" }, { status: 400 });
  }

  if (tooLargeBody(request, 16_384)) {
    return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 });
  }

  const ip = clientIp(request);
  const supabase = getPublicServiceClient();

  const limited = await assertPublicRateLimit(supabase, [
    { key: `qr:ip:${ip}`, max: 20, windowSec: 60 },
    { key: `qr:mesa:${mesaId}:ip:${ip}`, max: 8, windowSec: 60 },
    { key: `qr:global`, max: 120, windowSec: 60 },
  ]);
  if (limited) return limited;

  let body: { items?: { producto_id?: string; cantidad?: number }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0 || rawItems.length > 25) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const { data: mesa } = await supabase
    .from("mesas")
    .select("*")
    .eq("id", mesaId)
    .single();

  if (!mesa?.qr_habilitado || !(mesa.activa ?? true)) {
    return NextResponse.json({ error: "QR deshabilitado" }, { status: 403 });
  }

  const { data: panaderia } = await supabase
    .from("panaderias")
    .select("*")
    .eq("id", mesa.panaderia_id)
    .single();

  if (!panaderia?.pedido_directo_habilitado || !panaderia.activa) {
    return NextResponse.json({ error: "QR deshabilitado" }, { status: 403 });
  }

  // Límite adicional por panadería (evita flood a un local)
  const limitedPan = await assertPublicRateLimit(supabase, [
    { key: `qr:pan:${mesa.panaderia_id}`, max: 60, windowSec: 60 },
  ]);
  if (limitedPan) return limitedPan;

  let { data: cuenta } = await supabase
    .from("cuentas_mesa")
    .select("*")
    .eq("mesa_id", mesaId)
    .eq("estado", "abierta")
    .maybeSingle();

  if (!cuenta) {
    const { data: nueva, error: openErr } = await supabase
      .from("cuentas_mesa")
      .insert({
        mesa_id: mesaId,
        panaderia_id: mesa.panaderia_id,
        estado: "abierta",
      })
      .select()
      .single();
    if (openErr) {
      const { data: again } = await supabase
        .from("cuentas_mesa")
        .select("*")
        .eq("mesa_id", mesaId)
        .eq("estado", "abierta")
        .maybeSingle();
      cuenta = again;
    } else {
      cuenta = nueva;
      await supabase.from("mesas").update({ estado: "ocupada" }).eq("id", mesaId);
    }
  }

  if (!cuenta) {
    return NextResponse.json({ error: "No se pudo abrir cuenta" }, { status: 500 });
  }

  const estadoInicial = panaderia.requiere_aprobacion_mesero
    ? "pendiente_confirmacion"
    : "pendiente";

  const inserts = [];
  for (const item of rawItems) {
    if (!item?.producto_id || !isUuid(item.producto_id)) continue;
    const qty = Math.min(30, Math.max(1, Math.floor(Number(item.cantidad) || 1)));

    const { data: producto } = await supabase
      .from("productos")
      .select("precio, disponible, panaderia_id, tipo")
      .eq("id", item.producto_id)
      .eq("panaderia_id", mesa.panaderia_id)
      .single();

    if (!producto?.disponible || (producto.tipo ?? "venta") === "materia_prima") continue;

    inserts.push({
      cuenta_mesa_id: cuenta.id,
      producto_id: item.producto_id,
      cantidad: qty,
      precio_al_momento: producto.precio,
      origen: "cliente_qr" as const,
      estado: estadoInicial,
    });
  }

  if (inserts.length === 0) {
    return NextResponse.json({ error: "Ningún producto válido" }, { status: 400 });
  }

  const { error } = await supabase.from("items_cuenta").insert(inserts);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.rpc("notify_panaderia", {
    p_panaderia: mesa.panaderia_id,
    p_tipo: "pedido_qr",
    p_titulo: `Pedido QR · ${mesa.nombre}`,
    p_cuerpo: `${inserts.length} ítem(s) nuevos`,
    p_roles: ["dueno", "admin", "mesero", "cocina"],
  });

  return NextResponse.json({ ok: true, cuenta_id: cuenta.id });
}

/** Método no permitido (evita sondeos inútiles). */
export async function GET() {
  return NextResponse.json({ error: "Método no permitido" }, { status: 405 });
}
