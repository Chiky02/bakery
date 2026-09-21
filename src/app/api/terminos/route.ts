import { NextResponse } from "next/server";
import { getAuthUser, getSessionProfile } from "@/lib/auth";
import { getVigenteTerminos } from "@/lib/terminos";
import { createClient } from "@/lib/supabase/server";

/** Versión vigente + si el usuario ya la aceptó. */
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const vigente = await getVigenteTerminos();
  if (!vigente) {
    return NextResponse.json({ vigente: null, accepted: true });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("terminos_aceptaciones")
    .select("id, accepted_at")
    .eq("user_id", user.id)
    .eq("terminos_version_id", vigente.id)
    .maybeSingle();

  return NextResponse.json({
    vigente,
    accepted: !!data,
    accepted_at: data?.accepted_at ?? null,
  });
}

/** Aceptar la versión vigente. */
export async function POST() {
  const profile = await getSessionProfile();
  if (!profile?.activo) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const vigente = await getVigenteTerminos();
  if (!vigente) {
    return NextResponse.json({ error: "No hay términos vigentes" }, { status: 404 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("terminos_aceptaciones").upsert(
    {
      user_id: profile.id,
      terminos_version_id: vigente.id,
      accepted_at: new Date().toISOString(),
    },
    { onConflict: "user_id,terminos_version_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, version: vigente.version });
}
