import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiContext, assertPlatformAdmin } from "@/lib/api-context";
import { getServiceClient } from "@/lib/supabase/admin";

const patchSchema = z
  .object({
    activo: z.boolean().optional(),
    plataforma_admin: z.boolean().optional(),
  })
  .refine((body) => body.activo !== undefined || body.plataforma_admin !== undefined, {
    message: "Sin cambios",
  });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx } = result;

  const denied = assertPlatformAdmin(ctx);
  if (denied) return denied;

  const { userId } = await params;
  try {
    const body = patchSchema.parse(await request.json());
    if (userId === ctx.profile.id && body.activo === false) {
      return NextResponse.json({ error: "No puedes desactivar tu propia cuenta" }, { status: 400 });
    }
    if (userId === ctx.profile.id && body.plataforma_admin === false) {
      return NextResponse.json(
        { error: "No puedes quitarte el admin de plataforma" },
        { status: 400 },
      );
    }

    const admin = getServiceClient();

    const { data: existing } = await admin
      .from("profiles")
      .select("id, nombre, activo, plataforma_admin")
      .eq("id", userId)
      .maybeSingle();

    const nextActivo = body.activo ?? existing?.activo ?? true;
    const nextAdmin = body.plataforma_admin ?? existing?.plataforma_admin ?? false;

    const { error: profileErr } = await admin.from("profiles").upsert({
      id: userId,
      nombre: existing?.nombre ?? "Usuario",
      activo: nextActivo,
      plataforma_admin: nextAdmin,
      ...(nextActivo ? {} : { panaderia_activa_id: null }),
    });
    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 400 });
    }

    if (body.activo === false) {
      await admin.from("miembros").update({ activo: false }).eq("user_id", userId);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx } = result;

  const denied = assertPlatformAdmin(ctx);
  if (denied) return denied;

  const { userId } = await params;
  if (userId === ctx.profile.id) {
    return NextResponse.json({ error: "No puedes borrar tu propia cuenta" }, { status: 400 });
  }

  try {
    const admin = getServiceClient();
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo borrar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
