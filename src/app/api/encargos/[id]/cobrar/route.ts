import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api-context";
import { getTurnoAbiertoId, sinTurnoCajaResponse } from "@/lib/turno-caja";
import { resolvePagoDesglose } from "@/lib/pago-split";
import { z } from "zod";

const schema = z.object({
  monto: z.number().int().positive(),
  medio_pago: z.enum(["efectivo", "electronico", "mixto"]),
  monto_efectivo: z.number().int().min(0).optional().nullable(),
  monto_electronico: z.number().int().min(0).optional().nullable(),
  notas: z.string().max(300).optional().nullable(),
});

/** Registra abono/pago de encargo ligado al turno de caja abierto. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await requireApiContext();
  if (result instanceof NextResponse) return result;
  const { ctx, supabase } = result;

  try {
    const body = schema.parse(await request.json());
    const turnoId = await getTurnoAbiertoId(supabase, ctx.panaderia.id);
    if (!turnoId) return sinTurnoCajaResponse();

    const { data: encargo } = await supabase
      .from("encargos")
      .select("*")
      .eq("id", id)
      .eq("panaderia_id", ctx.panaderia.id)
      .maybeSingle();

    if (!encargo) {
      return NextResponse.json({ error: "Encargo no encontrado" }, { status: 404 });
    }

    const valor = Number(encargo.valor) || 0;
    const abonoActual = Number(encargo.abono) || 0;
    const pendiente = Math.max(0, valor - abonoActual);
    if (body.monto > pendiente) {
      return NextResponse.json(
        { error: `El cobro supera el saldo pendiente (${pendiente})` },
        { status: 400 },
      );
    }

    const pago = resolvePagoDesglose(
      body.medio_pago,
      body.monto,
      body.monto_efectivo,
      body.monto_electronico,
    );
    if (!pago.ok) {
      return NextResponse.json({ error: pago.error }, { status: 400 });
    }

    const nuevoAbono = abonoActual + body.monto;
    const estado_pago =
      nuevoAbono >= valor ? "pagado" : nuevoAbono > 0 ? "abonado" : "pendiente";
    const tipo = nuevoAbono >= valor ? "encargo_pago" : "encargo_abono";

    const { error: movErr } = await supabase.from("movimientos_caja").insert({
      panaderia_id: ctx.panaderia.id,
      turno_id: turnoId,
      tipo,
      referencia_id: id,
      monto_efectivo: pago.value.monto_efectivo,
      monto_electronico: pago.value.monto_electronico,
      notas: body.notas ?? `Encargo ${encargo.cliente_nombre ?? id}`,
      creado_por: ctx.profile.id,
    });

    if (movErr) {
      if (/movimientos_caja|relation/i.test(movErr.message)) {
        return NextResponse.json(
          { error: "Aplica la migración (npm run db:push) para cobros de encargo en caja" },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: movErr.message }, { status: 400 });
    }

    const patch: Record<string, unknown> = {
      abono: nuevoAbono,
      estado_pago,
      updated_at: new Date().toISOString(),
    };
    if (estado_pago === "pagado" && encargo.estado === "entregado") {
      patch.estado = "cobrado";
    }

    const { data, error } = await supabase
      .from("encargos")
      .update(patch)
      .eq("id", id)
      .eq("panaderia_id", ctx.panaderia.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, encargo: data, cobrado: body.monto });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
    }
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
