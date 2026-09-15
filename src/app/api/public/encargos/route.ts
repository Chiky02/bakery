import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertPublicRateLimit,
  clientIp,
  getPublicServiceClient,
  tooLargeBody,
} from "@/lib/rate-limit-public";

const schema = z.object({
  panaderia_id: z.string().uuid(),
  producto_id: z.string().uuid().nullable().optional(),
  descripcion: z.string().min(3).max(500),
  cliente_nombre: z.string().min(2).max(120),
  cliente_telefono: z.string().min(7).max(40),
  fecha_entrega: z.string().min(8).max(12),
  valor: z.number().int().min(0).max(50_000_000).optional(),
  notas: z.string().max(500).nullable().optional(),
});

export async function POST(request: Request) {
  try {
    if (tooLargeBody(request, 12_288)) {
      return NextResponse.json({ error: "Solicitud demasiado grande" }, { status: 413 });
    }

    const ip = clientIp(request);
    const supabase = getPublicServiceClient();

    // Rate limit temprano (antes de parsear body completo costoso / DB de negocio)
    const limitedIp = await assertPublicRateLimit(supabase, [
      { key: `encargo:ip:${ip}`, max: 5, windowSec: 60 },
      { key: `encargo:ip:${ip}:hora`, max: 20, windowSec: 3600 },
      { key: `encargo:global`, max: 80, windowSec: 60 },
    ]);
    if (limitedIp) return limitedIp;

    const body = schema.parse(await request.json());

    const limitedPan = await assertPublicRateLimit(supabase, [
      { key: `encargo:pan:${body.panaderia_id}:ip:${ip}`, max: 4, windowSec: 60 },
      { key: `encargo:pan:${body.panaderia_id}`, max: 30, windowSec: 60 },
    ]);
    if (limitedPan) return limitedPan;

    const { data: panaderia } = await supabase
      .from("panaderias")
      .select("id, activa, tiempo_minimo_encargo_horas")
      .eq("id", body.panaderia_id)
      .single();

    if (!panaderia?.activa) {
      return NextResponse.json({ error: "Panadería no disponible" }, { status: 404 });
    }

    const minHours = panaderia.tiempo_minimo_encargo_horas ?? 48;
    const entrega = new Date(`${body.fecha_entrega}T12:00:00`);
    if (Number.isNaN(entrega.getTime())) {
      return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
    }
    const minDate = new Date(Date.now() + minHours * 60 * 60 * 1000);
    if (entrega < minDate) {
      return NextResponse.json(
        {
          error: `La fecha de entrega debe ser al menos en ${minHours} horas (tiempo mínimo de elaboración).`,
        },
        { status: 400 },
      );
    }

    let valor = body.valor ?? 0;
    let descripcion = body.descripcion;
    let productoOk = true;
    if (body.producto_id) {
      const { data: producto } = await supabase
        .from("productos")
        .select("nombre, precio, panaderia_id, encargable")
        .eq("id", body.producto_id)
        .eq("panaderia_id", body.panaderia_id)
        .single();
      if (!producto) {
        productoOk = false;
      } else if (producto.encargable === false) {
        return NextResponse.json(
          { error: "Este producto no está habilitado para encargos" },
          { status: 400 },
        );
      } else {
        valor = producto.precio;
        if (!descripcion.toLowerCase().includes(producto.nombre.toLowerCase())) {
          descripcion = `${producto.nombre} — ${descripcion}`;
        }
      }
      if (!productoOk) {
        return NextResponse.json({ error: "Producto inválido" }, { status: 400 });
      }
    }

    const hoy = new Date().toISOString().slice(0, 10);

    const insertBase = {
      panaderia_id: body.panaderia_id,
      descripcion,
      cliente_nombre: body.cliente_nombre,
      cliente_telefono: body.cliente_telefono,
      fecha_entrega: body.fecha_entrega,
      fecha_acordada: body.fecha_entrega,
      fecha_envio: hoy,
      valor,
      notas: body.notas ?? null,
      estado: "pendiente",
      producto_id: body.producto_id ?? null,
      estado_pago: "pendiente" as const,
      abono: 0,
    };

    let { data, error } = await supabase.from("encargos").insert(insertBase).select("id").single();

    if (error && (error.message.includes("producto_id") || error.message.includes("estado_pago"))) {
      const { producto_id: _p, estado_pago: _e, abono: _a, ...legacy } = insertBase;
      ({ data, error } = await supabase.from("encargos").insert(legacy).select("id").single());
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "No se creó el encargo" }, { status: 400 });

    await supabase.rpc("notify_panaderia", {
      p_panaderia: body.panaderia_id,
      p_tipo: "encargo",
      p_titulo: "Nuevo encargo de torta",
      p_cuerpo: `${body.cliente_nombre} · entrega ${body.fecha_entrega}`,
      p_roles: ["dueno", "admin", "mostrador"],
    });

    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Método no permitido" }, { status: 405 });
}
