import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/permissions";
import { z } from "zod";

const createSchema = z.object({
  nombre: z.string().min(2).max(80),
  codigo: z.string().min(2).max(48).optional(),
  descripcion: z.string().max(240).optional().nullable(),
  rol_base: z.enum(["dueno", "admin", "mostrador", "mesero", "cocina", "caja"]),
  permisos: z.array(z.string().min(1)).min(1),
  activo: z.boolean().optional(),
});

export async function GET() {
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx } = result;

  const supabase = await createClient();
  await supabase.rpc("seed_default_roles", { p_panaderia_id: ctx.panaderia.id });

  const { data, error } = await supabase
    .from("roles")
    .select("*, role_permisos(permiso)")
    .eq("panaderia_id", ctx.panaderia.id)
    .order("es_sistema", { ascending: false })
    .order("nombre");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ roles: data ?? [] });
}

export async function POST(request: Request) {
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx } = result;

  if (!["dueno", "admin"].includes(ctx.rol)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    const body = createSchema.parse(await request.json());
    const codigo = slugify(body.codigo || body.nombre);
    if (!codigo) {
      return NextResponse.json({ error: "Código inválido" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: role, error } = await supabase
      .from("roles")
      .insert({
        panaderia_id: ctx.panaderia.id,
        codigo,
        nombre: body.nombre.trim(),
        descripcion: body.descripcion?.trim() || null,
        rol_base: body.rol_base,
        activo: body.activo ?? true,
        es_sistema: false,
      })
      .select("*")
      .single();

    if (error || !role) {
      return NextResponse.json({ error: error?.message ?? "No se creó el rol" }, { status: 400 });
    }

    const rows = body.permisos.map((permiso) => ({ role_id: role.id, permiso }));
    const { error: permErr } = await supabase.from("role_permisos").insert(rows);
    if (permErr) {
      await supabase.from("roles").delete().eq("id", role.id);
      return NextResponse.json({ error: permErr.message }, { status: 400 });
    }

    return NextResponse.json({ role });
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
}
