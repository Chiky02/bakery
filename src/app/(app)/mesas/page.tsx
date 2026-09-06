import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function MesasPage() {
  const supabase = await createClient();

  const { data: mesas } = await supabase
    .from("mesas")
    .select("*, cuentas_mesa(id, estado, hora_apertura)")
    .order("nombre");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mesas</h1>
        <p className="text-sm text-stone-500">Gestión de cuentas por mesa</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {mesas?.map((mesa) => {
          const cuentaAbierta = mesa.cuentas_mesa?.find(
            (c: { estado: string }) => c.estado === "abierta",
          );
          return (
            <Card key={mesa.id} className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{mesa.nombre}</h3>
                  <Badge color={mesa.estado === "libre" ? "success" : "warning"}>
                    {mesa.estado}
                  </Badge>
                </div>
                <p className="text-sm text-stone-500">{mesa.zona}</p>
                {cuentaAbierta && (
                  <p className="mt-2 text-xs text-amber-700">Cuenta abierta</p>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <Link href={`/mesas/${mesa.id}`} className="flex-1">
                  <Button className="w-full" variant={cuentaAbierta ? "primary" : "secondary"}>
                    {cuentaAbierta ? "Ver cuenta" : "Abrir mesa"}
                  </Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
