import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const patchSchema = z.object({
  role_id: z.string().uuid().optional(),
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
    if (body.role_id === undefined && body.activo === undefined) {
      return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: member } = await supabase
      .from("miembros")
      .select("id, user_id, panaderia_id")
      .eq("id", id)
      .eq("panaderia_id", ctx.panaderia.id)
      .maybeSingle();

    if (!member) return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });

    const updates: Record<string, unknown> = {};
    if (body.activo !== undefined) updates.activo = body.activo;

    if (body.role_id) {
      const { data: role } = await supabase
        .from("roles")
        .select("id, rol_base, activo")
        .eq("id", body.role_id)
        .eq("panaderia_id", ctx.panaderia.id)
        .maybeSingle();

      if (!role || !role.activo) {
        return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
      }
      updates.role_id = role.id;
      updates.rol = role.rol_base;
    }

    const { error } = await supabase.from("miembros").update(updates).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
}
