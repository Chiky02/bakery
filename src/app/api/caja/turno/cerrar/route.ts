import { NextResponse } from "next/server";
import { requireApiFeature } from "@/lib/api-context";
import { totalConteo } from "@/lib/caja-denominaciones";
import { z } from "zod";

const schema = z.object({
  efectivo_contado: z.number().int().min(0).optional(),
  electronico_contado: z.number().int().min(0).optional().default(0),
  detalle_cierre: z.record(z.string(), z.number().int().min(0)).optional().nullable(),
  notas_cierre: z.string().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  const result = await requireApiFeature("caja");
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  try {
    const body = schema.parse(await request.json());
    const { data: turno } = await supabase
      .from("turnos_caja")
      .select("*")
      .eq("panaderia_id", ctx.panaderia.id)
      .eq("estado", "abierto")
      .maybeSingle();

    if (!turno) {
      return NextResponse.json({ error: "No hay turno abierto" }, { status: 400 });
    }

    const detalle = body.detalle_cierre ?? null;
    const efectivo =
      body.efectivo_contado ??
      (detalle ? totalConteo(detalle) : 0);

    const payload = {
      estado: "cerrado" as const,
      cerrado_por: ctx.profile.id,
      cierre_at: new Date().toISOString(),
      efectivo_contado: efectivo,
      electronico_contado: body.electronico_contado,
      detalle_cierre: detalle,
      notas_cierre: body.notas_cierre ?? null,
    };

    const { data, error } = await supabase
      .from("turnos_caja")
      .update(payload)
      .eq("id", turno.id)
      .select()
      .single();

    if (error) {
      if (error.message.includes("detalle_cierre")) {
        const { detalle_cierre: _d, ...without } = payload;
        const { data: data2, error: err2 } = await supabase
          .from("turnos_caja")
          .update(without)
          .eq("id", turno.id)
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
