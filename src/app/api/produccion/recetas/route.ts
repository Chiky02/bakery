import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiFeature } from "@/lib/api-context";
import { hasPermiso } from "@/lib/permissions";

const guardarSchema = z.object({
  producto_id: z.string().uuid(),
  items: z
    .array(
      z.object({
        insumo_id: z.string().uuid(),
        cantidad_por_unidad: z.number().positive().max(1_000_000),
      }),
    )
    .max(40),
});

export async function GET(request: Request) {
  const result = await requireApiFeature("produccion");
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  const url = new URL(request.url);
  const productoId = url.searchParams.get("producto_id");
  if (!productoId) {
    return NextResponse.json({ error: "Falta producto_id" }, { status: 400 });
  }

  const [{ data: items, error }, { data: insumos, error: insErr }] = await Promise.all([
    supabase
      .from("receta_items")
        .select("id, insumo_id, cantidad_por_unidad")
      .eq("panaderia_id", ctx.panaderia.id)
      .eq("producto_id", productoId),
    supabase
      .from("productos")
      .select("id, nombre, stock, tipo")
      .eq("panaderia_id", ctx.panaderia.id)
      .eq("tipo", "materia_prima")
      .order("nombre"),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

  return NextResponse.json({
    items: items ?? [],
    insumos: insumos ?? [],
    puede_editar: hasPermiso("produccion_recetas", ctx.permisos, ctx.rol),
  });
}

export async function PUT(request: Request) {
  const result = await requireApiFeature("produccion");
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  if (!hasPermiso("produccion_recetas", ctx.permisos, ctx.rol)) {
    return NextResponse.json({ error: "No tienes permiso para editar recetas" }, { status: 403 });
  }

  let body: z.infer<typeof guardarSchema>;
  try {
    body = guardarSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const ids = new Set(body.items.map((i) => i.insumo_id));
  if (ids.size !== body.items.length) {
    return NextResponse.json({ error: "Hay insumos repetidos en la receta" }, { status: 400 });
  }

  const { error } = await supabase.rpc("guardar_receta", {
    p_producto: body.producto_id,
    p_items: body.items,
  });

  if (error) {
    const msg = error.message ?? "No se pudo guardar";
    const status = /sin permiso|no autorizado/i.test(msg) ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json({ ok: true });
}
