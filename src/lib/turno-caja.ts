import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SIN_TURNO_CAJA_CODE, SIN_TURNO_CAJA_MSG } from "@/lib/turno-caja-messages";

export { SIN_TURNO_CAJA_CODE, SIN_TURNO_CAJA_MSG } from "@/lib/turno-caja-messages";

export async function getTurnoAbiertoId(
  supabase: SupabaseClient,
  panaderiaId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("turnos_caja")
    .select("id")
    .eq("panaderia_id", panaderiaId)
    .eq("estado", "abierto")
    .maybeSingle();
  return data?.id ?? null;
}

export function sinTurnoCajaResponse() {
  return NextResponse.json(
    { error: SIN_TURNO_CAJA_MSG, code: SIN_TURNO_CAJA_CODE },
    { status: 409 },
  );
}
