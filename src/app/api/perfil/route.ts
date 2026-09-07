import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { z } from "zod";

const schema = z.object({
  nombre: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(72).optional(),
  current_password: z.string().min(1).optional(),
});

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function getAnonAuth() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nombre, activo, panaderia_activa_id")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    id: user.id,
    email: user.email ?? "",
    nombre: profile?.nombre ?? "",
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = schema.parse(await request.json());

    if (!body.nombre && !body.email && !body.password) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    // Verifica contraseña actual si cambia email o password
    if (body.email || body.password) {
      if (!body.current_password) {
        return NextResponse.json(
          { error: "Indica tu contraseña actual para cambiar correo o clave" },
          { status: 400 },
        );
      }
      const checker = getAnonAuth();
      const { error: signErr } = await checker.auth.signInWithPassword({
        email: user.email,
        password: body.current_password,
      });
      if (signErr) {
        return NextResponse.json({ error: "Contraseña actual incorrecta" }, { status: 400 });
      }
      await checker.auth.signOut();
    }

    if (body.nombre) {
      const { error } = await supabase
        .from("profiles")
        .update({ nombre: body.nombre.trim() })
        .eq("id", user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const authPatch: { email?: string; password?: string; data?: { nombre?: string } } = {};
    if (body.email && body.email.toLowerCase() !== user.email.toLowerCase()) {
      authPatch.email = body.email.trim().toLowerCase();
    }
    if (body.password) authPatch.password = body.password;
    if (body.nombre) authPatch.data = { nombre: body.nombre.trim() };

    if (authPatch.email || authPatch.password || authPatch.data) {
      // Prefer admin update so email change applies without confirmation delay in staff apps
      const admin = getAdmin();
      if (authPatch.email || authPatch.password) {
        const { error } = await admin.auth.admin.updateUserById(user.id, {
          email: authPatch.email,
          password: authPatch.password,
          email_confirm: true,
          user_metadata: authPatch.data,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      } else if (authPatch.data) {
        const { error } = await supabase.auth.updateUser({ data: authPatch.data });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({
      ok: true,
      email: body.email ?? user.email,
      nombre: body.nombre,
      password_changed: !!body.password,
    });
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
}
