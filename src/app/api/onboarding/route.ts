import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireApiContext } from "@/lib/api-context";
import { slugify } from "@/lib/permissions";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  nombre: z.string().min(2).max(120),
  password: z.string().min(8).max(72),
  panaderia_nombre: z.string().min(2).max(120),
});

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Crea un dueño nuevo con su propia panadería (alta de negocio). */
export async function POST(request: Request) {
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx } = result;

  if (!["dueno", "admin"].includes(ctx.rol)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    const body = schema.parse(await request.json());
    const admin = getAdmin();

    const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = listed?.users.find(
      (u) => u.email?.toLowerCase() === body.email.toLowerCase(),
    );

    let userId = existing?.id;
    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: body.email.trim().toLowerCase(),
        password: body.password,
        email_confirm: true,
        user_metadata: { nombre: body.nombre.trim() },
      });
      if (error || !created.user) {
        return NextResponse.json(
          { error: error?.message ?? "No se pudo crear el usuario" },
          { status: 400 },
        );
      }
      userId = created.user.id;
    } else {
      // Actualiza contraseña/nombre si el usuario ya existía
      await admin.auth.admin.updateUserById(userId, {
        password: body.password,
        user_metadata: { nombre: body.nombre.trim() },
      });
    }

    await admin.from("profiles").upsert({
      id: userId,
      nombre: body.nombre.trim(),
      activo: true,
    });

    const base = slugify(body.panaderia_nombre) || "panaderia";
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;

    const { data: panaderia, error: panErr } = await admin
      .from("panaderias")
      .insert({
        nombre: body.panaderia_nombre.trim(),
        slug,
        created_by: userId,
        activa: true,
      })
      .select("id, nombre, slug")
      .single();

    if (panErr || !panaderia) {
      return NextResponse.json(
        { error: panErr?.message ?? "No se pudo crear la panadería" },
        { status: 400 },
      );
    }

    const { error: memErr } = await admin.from("miembros").upsert(
      {
        panaderia_id: panaderia.id,
        user_id: userId,
        rol: "dueno",
        activo: true,
      },
      { onConflict: "panaderia_id,user_id" },
    );
    if (memErr) {
      return NextResponse.json({ error: memErr.message }, { status: 400 });
    }

    await admin
      .from("profiles")
      .update({ panaderia_activa_id: panaderia.id })
      .eq("id", userId);

    return NextResponse.json({
      ok: true,
      user_id: userId,
      panaderia,
      login: { email: body.email.trim().toLowerCase() },
    });
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
}
