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

  const [{ data: cuentas }, { data: ventasHoy }, { data: mesasCerradas }, { data: turno }, { data: facturas }] =
    await Promise.all([
      supabase
        .from("cuentas_mesa")
        .select("id, hora_apertura, mesas(id, nombre)")
        .eq("panaderia_id", pid)
        .eq("estado", "abierta")
        .order("hora_apertura"),
      supabase
        .from("ventas_mostrador")
        .select("id, fecha_hora, total, medio_pago, detalle, factura_id")
        .eq("panaderia_id", pid)
        .gte("fecha_hora", desde)
        .order("fecha_hora", { ascending: false })
        .limit(50),
      supabase
        .from("cuentas_mesa")
        .select("id, hora_cierre, total_final, medio_pago, mesas(nombre)")
        .eq("panaderia_id", pid)
        .eq("estado", "cerrada")
        .gte("hora_cierre", desde)
        .order("hora_cierre", { ascending: false })
        .limit(40),
      supabase
        .from("turnos_caja")
        .select("*")
        .eq("panaderia_id", pid)
        .eq("estado", "abierto")
        .maybeSingle(),
      supabase
        .from("facturas")
        .select("id, numero, cliente_nombre, total, created_at, origen")
        .eq("panaderia_id", pid)
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

  const cuentaIds = (mesasCerradas ?? []).map((c) => c.id as string);
  const itemsByCuenta = new Map<
    string,
    { producto_id?: string; nombre: string; cantidad: number; precio: number }[]
  >();
  if (cuentaIds.length > 0) {
    const { data: items } = await supabase
      .from("items_cuenta")
      .select("cuenta_mesa_id, producto_id, cantidad, precio_al_momento, productos(nombre)")
      .in("cuenta_mesa_id", cuentaIds)
      .neq("estado", "cancelado");
    for (const it of items ?? []) {
      const cid = it.cuenta_mesa_id as string;
      const list = itemsByCuenta.get(cid) ?? [];
      const prod = it.productos as { nombre?: string } | { nombre?: string }[] | null;
      const nombre = Array.isArray(prod) ? prod[0]?.nombre : prod?.nombre;
      list.push({
        producto_id: (it.producto_id as string) ?? undefined,
        nombre: nombre ?? "Ítem",
        cantidad: Number(it.cantidad),
        precio: Number(it.precio_al_momento),
      });
      itemsByCuenta.set(cid, list);
    }
  }

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
  }));

  const mesasHoy = (mesasCerradas ?? []).map((c) => ({
    id: c.id as string,
    hora_cierre: (c.hora_cierre as string) ?? "",
    total: (c.total_final as number) ?? 0,
    medio_pago: (c.medio_pago as MedioPago | null) ?? null,
    mesa_nombre: (c.mesas as { nombre?: string } | null)?.nombre ?? "Mesa",
    detalle: itemsByCuenta.get(c.id as string) ?? [],
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
        (facturas as {
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
