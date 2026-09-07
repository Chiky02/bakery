"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function MesaQrLink({ mesaId, mesaNombre }: { mesaId: string; mesaNombre: string }) {
  const [copied, setCopied] = useState(false);
  const path = `/qr/${mesaId}`;
  const absolute =
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  async function copy() {
    const url = `${window.location.origin}${path}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg bg-stone-50 p-3 text-xs ">
      <p className="font-medium text-stone-700 ">Pedido QR · {mesaNombre}</p>
      <p className="break-all text-stone-500">{absolute}</p>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" type="button" onClick={copy}>
          {copied ? "Copiado" : "Copiar link"}
        </Button>
        <Link href={path} target="_blank" className="inline-flex">
          <Button size="sm" variant="ghost" type="button">
            Abrir
          </Button>
        </Link>
      </div>
    </div>
  );
}
