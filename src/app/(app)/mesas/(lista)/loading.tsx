import { MesasGridSkeleton } from "@/components/app/loading-skeletons";

export default function MesasLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mesas</h1>
        <p className="text-sm text-stone-500">
          Abre cuentas y atiende mesas activas. La creación y desactivación está en Gestionar mesas.
        </p>
      </div>
      <MesasGridSkeleton />
    </div>
  );
}
