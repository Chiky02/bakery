import { requireBakeryContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCOP, formatDateTime } from "@/lib/format";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ReportesPage() {
  const { panaderia } = await requireBakeryContext();
  const supabase = await createClient();
  const pid = panaderia.id;
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
  const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const finMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [
    { data: ventasMes },
    { data: ventasMesAnterior },
    { data: cuentasMesa },
  ] = await Promise.all([
    supabase
      .from("ventas_mostrador")
      .select("total, detalle, fecha_hora, medio_pago")
      .eq("panaderia_id", pid)
      .gte("fecha_hora", inicioMes.toISOString()),
    supabase
      .from("ventas_mostrador")
      .select("total")
      .eq("panaderia_id", pid)
      .gte("fecha_hora", inicioMesAnterior.toISOString())
      .lte("fecha_hora", finMesAnterior.toISOString()),
    supabase
      .from("cuentas_mesa")
      .select("id, total_final, medio_pago, hora_apertura, hora_cierre, estado, mesas(nombre)")
      .eq("panaderia_id", pid)
      .eq("estado", "cerrada")
      .order("hora_cierre", { ascending: false })
      .limit(40),
  ]);

  const totalMesMostrador = ventasMes?.reduce((s, v) => s + v.total, 0) ?? 0;
  const totalMesMesas =
    cuentasMesa
      ?.filter((c) => c.hora_cierre && new Date(c.hora_cierre) >= inicioMes)
      .reduce((s, c) => s + (c.total_final ?? 0), 0) ?? 0;
  const totalMes = totalMesMostrador + totalMesMesas;
  const totalAnterior = ventasMesAnterior?.reduce((s, v) => s + v.total, 0) ?? 0;
  const variacion =
    totalAnterior > 0 ? ((totalMesMostrador - totalAnterior) / totalAnterior) * 100 : 0;

  const porMedio: Record<string, number> = {};
  ventasMes?.forEach((v) => {
    porMedio[v.medio_pago] = (porMedio[v.medio_pago] ?? 0) + v.total;
  });
  cuentasMesa
    ?.filter((c) => c.hora_cierre && new Date(c.hora_cierre) >= inicioMes)
    .forEach((c) => {
      const m = c.medio_pago ?? "mesa";
      porMedio[m] = (porMedio[m] ?? 0) + (c.total_final ?? 0);
    });

  const productCounts: Record<string, { nombre: string; qty: number; total: number }> = {};
  ventasMes?.forEach((v) => {
    const items = v.detalle as { nombre: string; cantidad: number; subtotal: number }[];
    items?.forEach((i) => {
      if (!productCounts[i.nombre])
        productCounts[i.nombre] = { nombre: i.nombre, qty: 0, total: 0 };
      productCounts[i.nombre].qty += i.cantidad;
      productCounts[i.nombre].total += i.subtotal;
    });
  });

  const topProductos = Object.values(productCounts)
    .sort((a, b) => b.total - a.total)
    .slice(0, 15);

  const porMesa: Record<string, { nombre: string; ventas: number; total: number }> = {};
  cuentasMesa?.forEach((c) => {
    const mesa = c.mesas as { nombre?: string } | null;
    const nombre = mesa?.nombre ?? "Mesa";
    if (!porMesa[nombre]) porMesa[nombre] = { nombre, ventas: 0, total: 0 };
    porMesa[nombre].ventas += 1;
    porMesa[nombre].total += c.total_final ?? 0;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-sm text-stone-500">
          Mostrador + mesas · comparativas del flujo registrado vía app (no fiscal)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-stone-500">Mes (mostrador + mesas)</p>
          <p className="text-2xl font-bold text-amber-700">{formatCOP(totalMes)}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Solo mesas (mes)</p>
          <p className="text-2xl font-bold">{formatCOP(totalMesMesas)}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Mostrador mes anterior</p>
          <p className="text-2xl font-bold">{formatCOP(totalAnterior)}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Var. mostrador</p>
          <p
            className={`text-2xl font-bold ${variacion >= 0 ? "text-emerald-600" : "text-red-600"}`}
          >
            {variacion >= 0 ? "+" : ""}
            {variacion.toFixed(1)}%
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>Por medio de pago (mes)</CardTitle>
          <ul className="mt-4 space-y-2">
            {Object.entries(porMedio).length === 0 ? (
              <li className="text-sm text-stone-500">Sin datos</li>
            ) : (
              Object.entries(porMedio).map(([medio, total]) => (
                <li key={medio} className="flex justify-between text-sm capitalize">
                  <span>{medio}</span>
                  <span className="font-medium">{formatCOP(total)}</span>
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card>
          <CardTitle>Top productos mostrador</CardTitle>
          <ul className="mt-4 space-y-2">
            {topProductos.length === 0 ? (
              <li className="text-sm text-stone-500">Sin datos</li>
            ) : (
              topProductos.map((p, i) => (
                <li key={p.nombre} className="flex justify-between text-sm">
                  <span>
                    {i + 1}. {p.nombre} ({p.qty})
                  </span>
                  <span className="font-medium">{formatCOP(p.total)}</span>
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card>
          <CardTitle>Ventas por mesa (recientes)</CardTitle>
          <ul className="mt-4 space-y-2">
            {Object.values(porMesa).length === 0 ? (
              <li className="text-sm text-stone-500">Sin cuentas cerradas</li>
            ) : (
              Object.values(porMesa)
                .sort((a, b) => b.total - a.total)
                .map((m) => (
                  <li key={m.nombre} className="flex justify-between text-sm">
                    <span>
                      {m.nombre} · {m.ventas} cierre(s)
                    </span>
                    <span className="font-medium">{formatCOP(m.total)}</span>
                  </li>
                ))
            )}
          </ul>
        </Card>
      </div>

      <Card>
        <CardTitle>Historial de ventas por mesa</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b text-stone-500 ">
              <tr>
                <th className="pb-2 pr-3 font-medium">Mesa</th>
                <th className="pb-2 pr-3 font-medium">Apertura</th>
                <th className="pb-2 pr-3 font-medium">Cierre</th>
                <th className="pb-2 pr-3 font-medium">Pago</th>
                <th className="pb-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y ">
              {(cuentasMesa ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-stone-500">
                    Aún no hay mesas cerradas
                  </td>
                </tr>
              ) : (
                (cuentasMesa ?? []).map((c) => {
                  const mesa = c.mesas as { nombre?: string } | null;
                  return (
                    <tr key={c.id}>
                      <td className="py-2.5 pr-3 font-medium">{mesa?.nombre ?? "—"}</td>
                      <td className="py-2.5 pr-3 text-stone-500">
                        {c.hora_apertura ? formatDateTime(c.hora_apertura) : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-stone-500">
                        {c.hora_cierre ? formatDateTime(c.hora_cierre) : "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge>{c.medio_pago ?? "—"}</Badge>
                      </td>
                      <td className="py-2.5 text-right font-semibold">
                        {formatCOP(c.total_final ?? 0)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
