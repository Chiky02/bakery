import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isUuid } from "@/lib/public-url";

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Rate limit simple en memoria (por instancia serverless). */
const hits = new Map<string, { n: number; t: number }>();
function rateLimit(key: string, max = 20, windowMs = 60_000) {
  const now = Date.now();
  const cur = hits.get(key);
  if (!cur || now - cur.t > windowMs) {
    hits.set(key, { n: 1, t: now });
    return true;
  }
  if (cur.n >= max) return false;
  cur.n += 1;
  return true;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ mesaId: string }> },
) {
  const { mesaId } = await params;
  if (!isUuid(mesaId)) {
    return NextResponse.json({ error: "Mesa inválida" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`qr:${mesaId}:${ip}`, 15, 60_000)) {
    return NextResponse.json({ error: "Demasiados pedidos. Espera un momento." }, { status: 429 });
  }

  const supabase = getServiceClient();
  let body: { items?: { producto_id?: string; cantidad?: number }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0 || rawItems.length > 40) {
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
      // Carrera: otra petición abrió la cuenta
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
    const qty = Math.min(50, Math.max(1, Math.floor(Number(item.cantidad) || 1)));

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
