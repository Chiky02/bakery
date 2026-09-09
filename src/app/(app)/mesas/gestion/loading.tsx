import { MesasGridSkeleton } from "@/components/app/loading-skeletons";

export default function MesasGestionLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestionar mesas</h1>
        <p className="text-sm text-stone-500">Crear, activar, desactivar o eliminar mesas.</p>
      </div>
      <div className="h-36 animate-pulse rounded-xl bg-stone-200" />
      <MesasGridSkeleton cards={6} />
    </div>
  );
}
