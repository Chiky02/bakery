"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export function PrintActions() {
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <Button onClick={() => window.print()}>Imprimir / PDF</Button>
      <Link href="/caja">
        <Button variant="secondary">Volver a caja</Button>
      </Link>
    </div>
  );
}
