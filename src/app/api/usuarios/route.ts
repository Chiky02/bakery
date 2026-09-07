import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireApiContext } from "@/lib/api-context";
import { z } from "zod";

const schema = z.object({
  panaderia_id: z.string().uuid(),
  email: z.string().email(),
  nombre: z.string().min(2),
  password: z.string().min(8),
  rol: z.enum(["dueno", "admin", "mostrador", "mesero", "cocina", "caja"]),
});

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function POST(request: Request) {
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx } = result;

  if (!["dueno", "admin"].includes(ctx.rol)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  try {
    const body = schema.parse(await request.json());
    if (body.panaderia_id !== ctx.panaderia.id) {
      return NextResponse.json({ error: "Panadería inválida" }, { status: 400 });
    }

    const admin = getServiceClient();
    const { data: listed } = await admin.auth.admin.listUsers();
    let userId = listed?.users.find((u) => u.email === body.email)?.id;

    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { nombre: body.nombre },
      });
      if (error || !created.user) {
        return NextResponse.json({ error: error?.message ?? "No se creó el usuario" }, { status: 400 });
      }
      userId = created.user.id;
    }

    await admin.from("profiles").upsert({
      id: userId,
      nombre: body.nombre,
      activo: true,
      panaderia_activa_id: body.panaderia_id,
    });

    const { error: memErr } = await admin.from("miembros").upsert(
      {
        panaderia_id: body.panaderia_id,
        user_id: userId,
        rol: body.rol,
        activo: true,
      },
      { onConflict: "panaderia_id,user_id" },
    );
    if (memErr) return NextResponse.json({ error: memErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, user_id: userId });
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
}
