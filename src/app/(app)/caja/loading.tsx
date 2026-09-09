import { Card } from "@/components/ui/card";

export default function CajaLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-28 animate-pulse rounded bg-stone-200" />
        <div className="mt-2 h-4 w-64 animate-pulse rounded bg-stone-100" />
      </div>
      <Card className="h-48 animate-pulse bg-stone-100" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="h-40 animate-pulse bg-stone-100" />
        <Card className="h-40 animate-pulse bg-stone-100" />
      </div>
    </div>
  );
}
