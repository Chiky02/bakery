import { NextResponse } from "next/server";
import { requireApiFeature } from "@/lib/api-context";
import { parseBogotaDateInput, startOfBogotaDay, bogotaTodayInput } from "@/lib/timezone";

/** Historial de turnos de caja con filtro de fechas (Bogotá). */
export async function GET(request: Request) {
  const result = await requireApiFeature("caja");
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  const url = new URL(request.url);
  const hoy = bogotaTodayInput();
  const desdeInput = url.searchParams.get("desde") || hoy;
  const hastaInput = url.searchParams.get("hasta") || hoy;
  const desdeIso = parseBogotaDateInput(desdeInput, false);
  const hastaIso = parseBogotaDateInput(hastaInput, true);
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 40));

  const { data, error } = await supabase
    .from("turnos_caja")
    .select("*")
    .eq("panaderia_id", ctx.panaderia.id)
    .gte("apertura_at", desdeIso)
    .lte("apertura_at", hastaIso)
    .order("apertura_at", { ascending: false })
    .limit(limit);

  if (error) {
    // Si la tabla aún no existe
    if (/turnos_caja|relation/i.test(error.message)) {
      return NextResponse.json({
        turnos: [],
        desde: desdeInput,
        hasta: hastaInput,
        error: "Aplica la migración de caja (npm run db:push)",
      });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    turnos: data ?? [],
    desde: desdeInput,
    hasta: hastaInput,
    desde_default: startOfBogotaDay(),
  });
}
