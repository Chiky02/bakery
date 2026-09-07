import { requireBakeryContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function NegociosPage() {
  const { rol } = await requireBakeryContext();
  const supabase = await createClient();

  if (rol !== "dueno" && rol !== "admin") {
    return <p className="text-stone-500">Sin acceso</p>;
  }

  const { data: panaderias } = await supabase
    .from("panaderias")
    .select("id, nombre, slug, activa, created_at")
    .order("nombre");

  const { data: miembros } = await supabase
    .from("miembros")
    .select("id, rol, activo, panaderia_id, profiles(nombre)")
    .order("rol");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Personas y negocios</h1>
        <p className="text-sm text-stone-500">
          Vista de panaderías a las que tienes acceso y sus miembros
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Panaderías ({panaderias?.length ?? 0})</CardTitle>
          <ul className="mt-3 divide-y dark:divide-stone-800">
            {panaderias?.map((p) => (
              <li key={p.id} className="flex justify-between py-2 text-sm">
                <div>
                  <p className="font-medium">{p.nombre}</p>
                  <p className="text-xs text-stone-500">{p.slug}</p>
                </div>
                <Badge color={p.activa ? "success" : "danger"}>
                  {p.activa ? "Activa" : "Inactiva"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>Personas ({miembros?.length ?? 0})</CardTitle>
          <ul className="mt-3 max-h-96 divide-y overflow-y-auto dark:divide-stone-800">
            {miembros?.map((m) => {
              const profile = m.profiles as { nombre?: string } | null;
              return (
                <li key={m.id} className="flex justify-between py-2 text-sm">
                  <span>{profile?.nombre ?? "—"}</span>
                  <Badge>{m.rol}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
