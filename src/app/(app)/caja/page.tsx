import { createClient } from "@/lib/supabase/server";
import { formatCOP, formatDateTime } from "@/lib/format";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function CajaPage() {
  const supabase = await createClient();

  const { data: cuentas } = await supabase
    .from("cuentas_mesa")
    .select("*, mesas(nombre)")
    .eq("estado", "abierta")
    .order("hora_apertura");

  const { data: ventasHoy } = await supabase
    .from("ventas_mostrador")
    .select("*")
    .gte("fecha_hora", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
    .order("fecha_hora", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Caja</h1>
        <p className="text-sm text-stone-500">Cierre de cuentas y ventas del día</p>
      </div>

      <Card>
        <CardTitle>Mesas con cuenta abierta ({cuentas?.length ?? 0})</CardTitle>
        {!cuentas?.length ? (
          <p className="mt-4 text-sm text-stone-500">Todas las mesas están libres</p>
        ) : (
          <ul className="mt-4 divide-y">
            {cuentas.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{c.mesas?.nombre}</p>
                  <p className="text-xs text-stone-500">
                    Abierta {formatDateTime(c.hora_apertura)}
                  </p>
                </div>
                <Badge color="warning">Abierta</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardTitle>Ventas mostrador hoy</CardTitle>
        {!ventasHoy?.length ? (
          <p className="mt-4 text-sm text-stone-500">Sin ventas registradas</p>
        ) : (
          <ul className="mt-4 divide-y">
            {ventasHoy.map((v) => (
              <li key={v.id} className="flex justify-between py-3 text-sm">
                <div>
                  <p>{formatDateTime(v.fecha_hora)}</p>
                  <p className="text-stone-500 capitalize">{v.medio_pago}</p>
                </div>
                <span className="font-semibold">{formatCOP(v.total)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-stone-400">
          Total del día:{" "}
          <strong>
            {formatCOP(ventasHoy?.reduce((s, v) => s + v.total, 0) ?? 0)}
          </strong>
        </p>
      </Card>
    </div>
  );
}
