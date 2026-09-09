import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { startOfBogotaDay } from "@/lib/timezone";
import { CajaClient } from "./caja-client";
import type { MedioPago, TurnoCaja } from "@/types";

export default async function CajaPage() {
  const { panaderia } = await requireFeature("caja");
  const supabase = await createClient();
  const pid = panaderia.id;
  const desde = startOfBogotaDay();

  // Carga liviana inicial: sin ítems de mesas cerradas
  const [
    { data: cuentas },
    { data: ventasHoy },
    { data: mesasCerradas },
    { data: turno },
    { data: facturasRecientes },
  ] = await Promise.all([
      supabase
        .from("cuentas_mesa")
        .select("id, hora_apertura, mesas(id, nombre)")
        .eq("panaderia_id", pid)
        .eq("estado", "abierta")
        .order("hora_apertura")
        .limit(40),
      supabase
        .from("ventas_mostrador")
        .select("id, fecha_hora, total, medio_pago, detalle, factura_id, anulado")
        .eq("panaderia_id", pid)
        .eq("anulado", false)
        .gte("fecha_hora", desde)
        .order("fecha_hora", { ascending: false })
        .limit(30),
      supabase
        .from("cuentas_mesa")
        .select("id, hora_cierre, total_final, medio_pago, mesas(nombre)")
        .eq("panaderia_id", pid)
        .eq("estado", "cerrada")
        .gt("total_final", 0)
        .gte("hora_cierre", desde)
        .order("hora_cierre", { ascending: false })
        .limit(20),
      supabase
        .from("turnos_caja")
        .select(
          "id, panaderia_id, abierto_por, cerrado_por, estado, apertura_at, cierre_at, fondo_inicial, efectivo_contado, electronico_contado, notas_apertura, notas_cierre, detalle_apertura, detalle_cierre, esperado_efectivo, esperado_electronico, diferencia_efectivo, diferencia_electronico",
        )
        .eq("panaderia_id", pid)
        .eq("estado", "abierto")
        .maybeSingle(),
      supabase
        .from("facturas")
        .select("id, numero, cliente_nombre, total, created_at, origen")
        .eq("panaderia_id", pid)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

  const ventas = (ventasHoy ?? []).map((v) => ({
    id: v.id as string,
    fecha_hora: v.fecha_hora as string,
    total: v.total as number,
    medio_pago: v.medio_pago as MedioPago,
    detalle: (v.detalle ?? []) as {
      nombre: string;
      cantidad: number;
      precio: number;
      subtotal: number;
      producto_id?: string;
    }[],
    factura_id: (v.factura_id as string | null) ?? null,
    anulado: !!(v as { anulado?: boolean }).anulado,
  }));

  const mesasHoy = (mesasCerradas ?? []).map((c) => ({
    id: c.id as string,
    hora_cierre: (c.hora_cierre as string) ?? "",
    total: (c.total_final as number) ?? 0,
    medio_pago: (c.medio_pago as MedioPago | null) ?? null,
    mesa_nombre: (c.mesas as { nombre?: string } | null)?.nombre ?? "Mesa",
    detalle: [] as {
      producto_id?: string;
      nombre: string;
      cantidad: number;
      precio: number;
    }[],
  }));

  return (
    <CajaClient
      cuentas={
        (cuentas as {
          id: string;
          hora_apertura: string;
          mesas?: { id?: string; nombre?: string } | null;
        }[]) ?? []
      }
      ventasHoy={ventas}
      mesasCerradasHoy={mesasHoy}
      facturasRecientes={
        (facturasRecientes as {
          id: string;
          numero: string;
          cliente_nombre: string;
          total: number;
          created_at: string;
          origen: string;
        }[]) ?? []
      }
      turnoInicial={(turno as TurnoCaja | null) ?? null}
      totalMesasAbiertas={cuentas?.length ?? 0}
    />
  );
}
