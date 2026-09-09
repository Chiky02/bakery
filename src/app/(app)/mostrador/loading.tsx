import { ProductGridSkeleton } from "@/components/app/loading-skeletons";

export default function MostradorLoading() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Calculadora de venta</h1>
        <p className="text-sm text-stone-500">Mostrador — referencia para caja fiscal</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-h-[28rem] space-y-4 lg:col-span-2">
          <div className="h-10 animate-pulse rounded-lg bg-stone-200" />
          <ProductGridSkeleton />
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-stone-200" />
      </div>
    </div>
  );
}
