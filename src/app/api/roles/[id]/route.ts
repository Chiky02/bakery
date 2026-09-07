import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const patchSchema = z.object({
  nombre: z.string().min(2).max(80).optional(),
  descripcion: z.string().max(240).optional().nullable(),
  rol_base: z.enum(["dueno", "admin", "mostrador", "mesero", "cocina", "caja"]).optional(),
  permisos: z.array(z.string().min(1)).min(1).optional(),
  activo: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx } = result;

  if (!["dueno", "admin"].includes(ctx.rol)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = patchSchema.parse(await request.json());
    const supabase = await createClient();

    const { data: existing, error: findErr } = await supabase
      .from("roles")
      .select("*")
      .eq("id", id)
      .eq("panaderia_id", ctx.panaderia.id)
      .single();

    if (findErr || !existing) {
      return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (body.nombre !== undefined) updates.nombre = body.nombre.trim();
    if (body.descripcion !== undefined) updates.descripcion = body.descripcion?.trim() || null;
    if (body.activo !== undefined) updates.activo = body.activo;
    if (body.rol_base !== undefined && !existing.es_sistema) {
      updates.rol_base = body.rol_base;
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from("roles").update(updates).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (body.permisos) {
      await supabase.from("role_permisos").delete().eq("role_id", id);
      const rows = body.permisos.map((permiso) => ({ role_id: id, permiso }));
      const { error: permErr } = await supabase.from("role_permisos").insert(rows);
      if (permErr) return NextResponse.json({ error: permErr.message }, { status: 400 });
    }

    // Si cambió rol_base en rol custom, sincroniza miembros
    if (body.rol_base && !existing.es_sistema) {
      await supabase
        .from("miembros")
        .update({ rol: body.rol_base })
        .eq("role_id", id)
        .eq("panaderia_id", ctx.panaderia.id);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx } = result;

  if (!["dueno", "admin"].includes(ctx.rol)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("roles")
    .select("id, es_sistema")
    .eq("id", id)
    .eq("panaderia_id", ctx.panaderia.id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 });
  if (existing.es_sistema) {
    return NextResponse.json({ error: "No se pueden eliminar roles del sistema" }, { status: 400 });
  }

  const { count } = await supabase
    .from("miembros")
    .select("id", { count: "exact", head: true })
    .eq("role_id", id);

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Hay usuarios con este rol. Reasígnarlos primero." },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("roles").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
