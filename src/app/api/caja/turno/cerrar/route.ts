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
      body.efectivo_contado ?? (detalle ? totalConteo(detalle) : 0);
    const electronico = body.electronico_contado ?? 0;

    // Esperado del turno: fondo + ventas/mesas asociadas al turno
    let esperadoEfectivo = Number(turno.fondo_inicial) || 0;
    let esperadoElectronico = 0;

    const [{ data: ventasTurno }, { data: mesasTurno }] = await Promise.all([
      supabase
        .from("ventas_mostrador")
        .select("total, medio_pago")
        .eq("panaderia_id", ctx.panaderia.id)
        .eq("turno_id", turno.id)
        .eq("anulado", false),
      supabase
        .from("cuentas_mesa")
        .select("total_final, medio_pago")
        .eq("panaderia_id", ctx.panaderia.id)
        .eq("turno_id", turno.id)
        .eq("estado", "cerrada")
        .gt("total_final", 0),
    ]);

    function applyMedio(medio: string | null | undefined, total: number) {
      if (medio === "efectivo") esperadoEfectivo += total;
      else if (medio === "electronico") esperadoElectronico += total;
      else if (medio === "mixto") {
        // Sin desglose: mitad/mitad como aproximación operativa
        const half = Math.round(total / 2);
        esperadoEfectivo += half;
        esperadoElectronico += total - half;
      }
    }

    for (const v of ventasTurno ?? []) applyMedio(v.medio_pago, Number(v.total) || 0);
    for (const c of mesasTurno ?? []) applyMedio(c.medio_pago, Number(c.total_final) || 0);

    const payload: Record<string, unknown> = {
      estado: "cerrado",
      cerrado_por: ctx.profile.id,
      cierre_at: new Date().toISOString(),
      efectivo_contado: efectivo,
      electronico_contado: electronico,
      detalle_cierre: detalle,
      notas_cierre: body.notas_cierre ?? null,
      esperado_efectivo: esperadoEfectivo,
      esperado_electronico: esperadoElectronico,
      diferencia_efectivo: efectivo - esperadoEfectivo,
      diferencia_electronico: electronico - esperadoElectronico,
    };

    const { data, error } = await supabase
      .from("turnos_caja")
      .update(payload)
      .eq("id", turno.id)
      .select()
      .single();

    if (error) {
      // Fallback sin columnas de conciliación / detalle
      if (/esperado_|diferencia_|detalle_cierre/i.test(error.message)) {
        const basic = {
          estado: "cerrado",
          cerrado_por: ctx.profile.id,
          cierre_at: new Date().toISOString(),
          efectivo_contado: efectivo,
          electronico_contado: electronico,
          notas_cierre: body.notas_cierre ?? null,
        };
        const { data: data2, error: err2 } = await supabase
          .from("turnos_caja")
          .update(basic)
          .eq("id", turno.id)
          .select()
          .single();
        if (err2) return NextResponse.json({ error: err2.message }, { status: 400 });
        return NextResponse.json({
          ...data2,
          _esperado_efectivo: esperadoEfectivo,
          _esperado_electronico: esperadoElectronico,
          _diferencia_efectivo: efectivo - esperadoEfectivo,
          _diferencia_electronico: electronico - esperadoElectronico,
        });
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
