import { NextResponse } from "next/server";
import { requireApiFeature } from "@/lib/api-context";
import { totalConteo } from "@/lib/caja-denominaciones";
import { z } from "zod";

const openSchema = z.object({
  fondo_inicial: z.number().int().min(0).optional(),
  detalle_apertura: z.record(z.string(), z.number().int().min(0)).optional().nullable(),
  notas_apertura: z.string().max(500).optional().nullable(),
});

export async function GET() {
  const result = await requireApiFeature("caja");
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  const { data: turno } = await supabase
    .from("turnos_caja")
    .select("*")
    .eq("panaderia_id", ctx.panaderia.id)
    .eq("estado", "abierto")
    .maybeSingle();

  return NextResponse.json({ turno });
}

export async function POST(request: Request) {
  const result = await requireApiFeature("caja");
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  try {
    const body = openSchema.parse(await request.json());
    const { data: existing } = await supabase
      .from("turnos_caja")
      .select("id")
      .eq("panaderia_id", ctx.panaderia.id)
      .eq("estado", "abierto")
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Ya hay un turno abierto" }, { status: 400 });
    }

    const detalle = body.detalle_apertura ?? null;
    const fondo = body.fondo_inicial ?? (detalle ? totalConteo(detalle) : 0);

    const { data, error } = await supabase
      .from("turnos_caja")
      .insert({
        panaderia_id: ctx.panaderia.id,
        abierto_por: ctx.profile.id,
        fondo_inicial: fondo,
        detalle_apertura: detalle,
        notas_apertura: body.notas_apertura ?? null,
        estado: "abierto",
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes("detalle_apertura")) {
        const { data: data2, error: err2 } = await supabase
          .from("turnos_caja")
          .insert({
            panaderia_id: ctx.panaderia.id,
            abierto_por: ctx.profile.id,
            fondo_inicial: fondo,
            notas_apertura: body.notas_apertura ?? null,
            estado: "abierto",
          })
          .select()
          .single();
        if (err2) return NextResponse.json({ error: err2.message }, { status: 400 });
        return NextResponse.json(data2);
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
