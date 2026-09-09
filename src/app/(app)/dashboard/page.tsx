import { requireFeature } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCOP, formatHour } from "@/lib/format";
import { bogotaTodayInput, startOfBogotaDay, startOfBogotaMonth } from "@/lib/timezone";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function DashboardPage() {
  const { panaderia } = await requireFeature("dashboard");
  const supabase = await createClient();
  const pid = panaderia.id;
  const hoyIso = startOfBogotaDay();
  const mesIso = startOfBogotaMonth();
  const hoyInput = bogotaTodayInput();

  const [
    { data: ventasHoy },
    { data: mesasHoy },
    { data: ventasMes },
    { data: mesasMes },
    { data: encargosHoy },
    { data: encargosPend },
    { data: productosTop },
  ] = await Promise.all([
    supabase
      .from("ventas_mostrador")
      .select("total, fecha_hora")
      .eq("panaderia_id", pid)
      .eq("anulado", false)
      .gte("fecha_hora", hoyIso),
    supabase
      .from("cuentas_mesa")
      .select("total_final, hora_cierre")
      .eq("panaderia_id", pid)
      .eq("estado", "cerrada")
      .gt("total_final", 0)
      .gte("hora_cierre", hoyIso),
    supabase
      .from("ventas_mostrador")
      .select("total")
      .eq("panaderia_id", pid)
      .eq("anulado", false)
      .gte("fecha_hora", mesIso),
    supabase
      .from("cuentas_mesa")
      .select("total_final")
      .eq("panaderia_id", pid)
      .eq("estado", "cerrada")
      .gt("total_final", 0)
      .gte("hora_cierre", mesIso),
    supabase
      .from("encargos")
      .select("valor, abono, estado_pago")
      .eq("panaderia_id", pid)
      .eq("fecha_entrega", hoyInput),
    supabase
      .from("encargos")
      .select("*")
      .eq("panaderia_id", pid)
      .eq("estado", "pendiente")
      .order("fecha_entrega")
      .limit(5),
    supabase
      .from("ventas_mostrador")
      .select("detalle, fecha_hora")
      .eq("panaderia_id", pid)
      .eq("anulado", false)
      .gte("fecha_hora", hoyIso),
  ]);

  function encargoCobrado(e: { valor: number; abono?: number | null; estado_pago?: string | null }) {
    if (e.estado_pago === "pagado") return e.valor ?? 0;
    if (e.estado_pago === "abonado") return e.abono ?? 0;
    return 0;
  }

  const totalHoy =
    (ventasHoy?.reduce((s, v) => s + v.total, 0) ?? 0) +
    (mesasHoy?.reduce((s, c) => s + (c.total_final ?? 0), 0) ?? 0) +
    (encargosHoy?.reduce((s, e) => s + encargoCobrado(e), 0) ?? 0);
  const totalMes =
    (ventasMes?.reduce((s, v) => s + v.total, 0) ?? 0) +
    (mesasMes?.reduce((s, c) => s + (c.total_final ?? 0), 0) ?? 0);
  const countHoy = (ventasHoy?.length ?? 0) + (mesasHoy?.length ?? 0);

  const porHora: Record<string, number> = {};
  ventasHoy?.forEach((v) => {
    const h = formatHour(v.fecha_hora);
    porHora[h] = (porHora[h] ?? 0) + v.total;
  });
  mesasHoy?.forEach((c) => {
    if (!c.hora_cierre) return;
    const h = formatHour(c.hora_cierre);
    porHora[h] = (porHora[h] ?? 0) + (c.total_final ?? 0);
  });

  const productCounts: Record<string, { nombre: string; qty: number }> = {};
  productosTop?.forEach((v) => {
    const items = v.detalle as { nombre: string; cantidad: number }[];
    items?.forEach((i) => {
      if (!productCounts[i.nombre]) productCounts[i.nombre] = { nombre: i.nombre, qty: 0 };
      productCounts[i.nombre].qty += i.cantidad;
    });
  });
  const topProductos = Object.values(productCounts)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-stone-500">
            {panaderia.nombre} — día Bogotá ({hoyInput})
          </p>
        </div>
        <Link href="/reportes" className="text-sm font-medium text-orange-700 hover:underline">
          Ver reportes →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-stone-500">Ingresos hoy</p>
          <p className="mt-1 text-2xl font-bold text-orange-700">{formatCOP(totalHoy)}</p>
          <p className="text-xs text-stone-400">
            {countHoy} ops · mostrador + mesas + encargos
          </p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Acumulado mes</p>
          <p className="mt-1 text-2xl font-bold">{formatCOP(totalMes)}</p>
          <p className="text-xs text-stone-400">Mostrador + mesas</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Encargos pendientes</p>
          <p className="mt-1 text-2xl font-bold">{encargosPend?.length ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Producto top hoy</p>
          <p className="mt-1 text-2xl font-bold">{topProductos[0]?.nombre ?? "—"}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Ingresos por franja (hoy)</CardTitle>
          {Object.keys(porHora).length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">Sin operaciones registradas hoy</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {Object.entries(porHora)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([hora, total]) => (
                  <li key={hora} className="flex justify-between text-sm">
                    <span>{hora}</span>
                    <span className="font-medium">{formatCOP(total)}</span>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>Productos más vendidos (mostrador hoy)</CardTitle>
          {topProductos.length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">Sin datos</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {topProductos.map((p, i) => (
                <li key={p.nombre} className="flex justify-between text-sm">
                  <span>
                    {i + 1}. {p.nombre}
                  </span>
                  <Badge>{p.qty} uds</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle>Próximas entregas</CardTitle>
        {!encargosPend?.length ? (
          <p className="mt-4 text-sm text-stone-500">No hay encargos pendientes</p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-100">
            {encargosPend.map((e) => (
              <li key={e.id} className="flex justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{e.descripcion}</p>
                  <p className="text-stone-500">{e.cliente_nombre ?? "Sin cliente"}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatCOP(e.valor)}</p>
                  <p className="text-stone-500">{e.fecha_entrega}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
