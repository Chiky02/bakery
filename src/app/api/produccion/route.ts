import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiFeature } from "@/lib/api-context";
import { hasPermiso } from "@/lib/permissions";

const crearSchema = z.object({
  producto_id: z.string().uuid(),
  cantidad: z.number().positive().max(100_000),
  notas: z.string().max(500).optional().nullable(),
});

/** Historial + productos elaborables del local. */
export async function GET() {
  const result = await requireApiFeature("produccion");
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  const [{ data: registros, error: regErr }, { data: productos, error: prodErr }] =
    await Promise.all([
      supabase
        .from("produccion_registros")
        .select("id, producto_id, cantidad, notas, creado_por, created_at, productos(nombre)")
        .eq("panaderia_id", ctx.panaderia.id)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("productos")
        .select("id, nombre, stock, control_stock, producible, tipo")
        .eq("panaderia_id", ctx.panaderia.id)
        .eq("producible", true)
        .order("nombre"),
    ]);

  if (regErr) return NextResponse.json({ error: regErr.message }, { status: 400 });
  if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 400 });

  return NextResponse.json({
    registros: registros ?? [],
    productos: (productos ?? []).filter((p) => (p.tipo ?? "venta") !== "materia_prima"),
    puede_registrar: hasPermiso("produccion_crear", ctx.permisos, ctx.rol),
    puede_recetas: hasPermiso("produccion_recetas", ctx.permisos, ctx.rol),
  });
}

/** Registra una tanda: sube stock del producto y descuenta la receta si existe. */
export async function POST(request: Request) {
  const result = await requireApiFeature("produccion");
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  if (!hasPermiso("produccion_crear", ctx.permisos, ctx.rol)) {
    return NextResponse.json(
      { error: "No tienes permiso para registrar producción" },
      { status: 403 },
    );
  }

  let body: z.infer<typeof crearSchema>;
  try {
    body = crearSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("registrar_produccion", {
    p_producto: body.producto_id,
    p_cantidad: body.cantidad,
    p_notas: body.notas?.trim() || null,
  });

  if (error) {
    const msg = error.message ?? "No se pudo registrar";
    const status = /sin permiso|no autorizado|no autenticado/i.test(msg)
      ? 403
      : /insuficiente|no se elabora|inválid/i.test(msg)
        ? 409
        : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json({ ok: true, id: data });
}
