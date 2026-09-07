import { requireBakeryContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/format";
import { Card, CardTitle } from "@/components/ui/card";

export default async function ReportesPage() {
  const { panaderia } = await requireBakeryContext();
  const supabase = await createClient();
  const pid = panaderia.id;
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1);
  const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const finMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  const [{ data: ventasMes }, { data: ventasMesAnterior }] = await Promise.all([
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
  ]);

  const totalMes = ventasMes?.reduce((s, v) => s + v.total, 0) ?? 0;
  const totalAnterior = ventasMesAnterior?.reduce((s, v) => s + v.total, 0) ?? 0;
  const variacion =
    totalAnterior > 0 ? ((totalMes - totalAnterior) / totalAnterior) * 100 : 0;

  const porMedio: Record<string, number> = {};
  ventasMes?.forEach((v) => {
    porMedio[v.medio_pago] = (porMedio[v.medio_pago] ?? 0) + v.total;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reportes</h1>
        <p className="text-sm text-stone-500">
          Comparativas del flujo registrado vía app (no fiscal)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-stone-500">Mes actual</p>
          <p className="text-2xl font-bold text-amber-700">{formatCOP(totalMes)}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Mes anterior</p>
          <p className="text-2xl font-bold">{formatCOP(totalAnterior)}</p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Variación</p>
          <p
            className={`text-2xl font-bold ${variacion >= 0 ? "text-emerald-600" : "text-red-600"}`}
          >
            {variacion >= 0 ? "+" : ""}
            {variacion.toFixed(1)}%
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Por medio de pago (mes)</CardTitle>
          <ul className="mt-4 space-y-2">
            {Object.entries(porMedio).map(([medio, total]) => (
              <li key={medio} className="flex justify-between text-sm capitalize">
                <span>{medio}</span>
                <span className="font-medium">{formatCOP(total)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>Top productos (mes)</CardTitle>
          <ul className="mt-4 space-y-2">
            {topProductos.map((p, i) => (
              <li key={p.nombre} className="flex justify-between text-sm">
                <span>
                  {i + 1}. {p.nombre} ({p.qty})
                </span>
                <span className="font-medium">{formatCOP(p.total)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
