import { Card } from "@/components/ui/card";

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-stone-200 ${className}`} />;
}

export function ProductGridSkeleton({ cards = 8 }: { cards?: number }) {
  return (
    <div className="space-y-6" aria-hidden>
      <Pulse className="h-4 w-40" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="rounded-xl border border-stone-200 bg-white p-3">
            <Pulse className="h-4 w-3/4" />
            <Pulse className="mt-3 h-4 w-16" />
            <Pulse className="mt-3 h-8 w-full" />
            <Pulse className="mt-2 h-8 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MesasGridSkeleton({ cards = 8 }: { cards?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-hidden>
      {Array.from({ length: cards }).map((_, i) => (
        <Card key={i} className="space-y-3">
          <div className="flex justify-between">
            <Pulse className="h-6 w-24" />
            <Pulse className="h-5 w-16" />
          </div>
          <Pulse className="h-4 w-20" />
          <Pulse className="h-16 w-full" />
          <Pulse className="h-10 w-full" />
        </Card>
      ))}
    </div>
  );
}
