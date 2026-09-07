import { requireBakeryContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCOP, formatHour } from "@/lib/format";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const { panaderia } = await requireBakeryContext();
  const supabase = await createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const pid = panaderia.id;

  const [{ data: ventasHoy }, { data: ventasMes }, { data: encargos }, { data: productosTop }] =
    await Promise.all([
      supabase
        .from("ventas_mostrador")
        .select("total, fecha_hora")
        .eq("panaderia_id", pid)
        .gte("fecha_hora", today.toISOString()),
      supabase
        .from("ventas_mostrador")
        .select("total, fecha_hora")
        .eq("panaderia_id", pid)
        .gte("fecha_hora", new Date(today.getFullYear(), today.getMonth(), 1).toISOString()),
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
        .gte("fecha_hora", today.toISOString()),
    ]);

  const totalHoy = ventasHoy?.reduce((s, v) => s + v.total, 0) ?? 0;
  const totalMes = ventasMes?.reduce((s, v) => s + v.total, 0) ?? 0;
  const countHoy = ventasHoy?.length ?? 0;

  const porHora: Record<string, number> = {};
  ventasHoy?.forEach((v) => {
    const h = formatHour(v.fecha_hora);
    porHora[h] = (porHora[h] ?? 0) + v.total;
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
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-stone-500">
          {panaderia.nombre} — flujo registrado vía app
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-stone-500">Ventas app hoy</p>
          <p className="mt-1 text-2xl font-bold text-orange-700 ">
            {formatCOP(totalHoy)}
          </p>
          <p className="text-xs text-stone-400">{countHoy} transacciones</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Acumulado mes</p>
          <p className="mt-1 text-2xl font-bold">{formatCOP(totalMes)}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Encargos pendientes</p>
          <p className="mt-1 text-2xl font-bold">{encargos?.length ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Productos top hoy</p>
          <p className="mt-1 text-2xl font-bold">{topProductos[0]?.nombre ?? "—"}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Ventas por franja horaria (hoy)</CardTitle>
          {Object.keys(porHora).length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">Sin ventas registradas hoy</p>
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
          <CardTitle>Productos más vendidos (hoy)</CardTitle>
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
        {!encargos?.length ? (
          <p className="mt-4 text-sm text-stone-500">No hay encargos pendientes</p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-100 ">
            {encargos.map((e) => (
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
