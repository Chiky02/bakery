import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const schema = z.object({
  panaderia_id: z.string().uuid(),
  producto_id: z.string().uuid().nullable().optional(),
  descripcion: z.string().min(3).max(500),
  cliente_nombre: z.string().min(2).max(120),
  cliente_telefono: z.string().min(7).max(40),
  fecha_entrega: z.string().min(8),
  valor: z.number().int().min(0).optional(),
  notas: z.string().max(500).nullable().optional(),
});

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const supabase = getServiceClient();

    const { data: panaderia } = await supabase
      .from("panaderias")
      .select("id, activa")
      .eq("id", body.panaderia_id)
      .single();

    if (!panaderia?.activa) {
      return NextResponse.json({ error: "Panadería no disponible" }, { status: 404 });
    }

    let valor = body.valor ?? 0;
    let descripcion = body.descripcion;
    if (body.producto_id) {
      const { data: producto } = await supabase
        .from("productos")
        .select("nombre, precio, panaderia_id")
        .eq("id", body.producto_id)
        .eq("panaderia_id", body.panaderia_id)
        .single();
      if (producto) {
        valor = producto.precio;
        if (!descripcion.toLowerCase().includes(producto.nombre.toLowerCase())) {
          descripcion = `${producto.nombre} — ${descripcion}`;
        }
      }
    }

    const { data, error } = await supabase
      .from("encargos")
      .insert({
        panaderia_id: body.panaderia_id,
        descripcion,
        cliente_nombre: body.cliente_nombre,
        cliente_telefono: body.cliente_telefono,
        fecha_entrega: body.fecha_entrega,
        valor,
        notas: body.notas ?? null,
        estado: "pendiente",
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, id: data.id });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
