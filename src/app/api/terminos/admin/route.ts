import { NextResponse } from "next/server";
import { requireApiContext, assertPlatformAdmin } from "@/lib/api-context";
import { getServiceClient } from "@/lib/supabase/admin";

/** Lista todas las versiones (admin plataforma). */
export async function GET() {
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const denied = assertPlatformAdmin(result.ctx);
  if (denied) return denied;

  try {
    const admin = getServiceClient();
    const { data, error } = await admin
      .from("terminos_versiones")
      .select("id, version, titulo, contenido, vigente, publicada_at, created_at, created_by")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ versions: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Publica una nueva versión (desmarca la anterior).
 * Body: { version, titulo?, contenido }
 */
export async function POST(req: Request) {
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx } = result;
  const denied = assertPlatformAdmin(ctx);
  if (denied) return denied;

  let body: { version?: string; titulo?: string; contenido?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const version = body.version?.trim();
  const contenido = body.contenido?.trim();
  const titulo = body.titulo?.trim() || "Términos y condiciones de uso del panel";

  if (!version || !contenido) {
    return NextResponse.json({ error: "version y contenido son obligatorios" }, { status: 400 });
  }

  try {
    const admin = getServiceClient();
    await admin.from("terminos_versiones").update({ vigente: false }).eq("vigente", true);

    const { data, error } = await admin
      .from("terminos_versiones")
      .insert({
        version,
        titulo,
        contenido,
        vigente: true,
        publicada_at: new Date().toISOString(),
        created_by: ctx.profile.id,
      })
      .select("id, version, titulo, vigente, publicada_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, version: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
