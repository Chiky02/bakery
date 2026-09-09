"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getPublicOrigin, qrAbsoluteUrl, qrPath, sanitizePublicOrigin } from "@/lib/public-url";

export function MesaQrLink({
  mesaId,
  mesaNombre,
}: {
  mesaId: string;
  mesaNombre: string;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const path = qrPath(mesaId);

  if (!path) return null;

  async function copy() {
    const fallbackOrigin =
      typeof window !== "undefined" ? sanitizePublicOrigin(window.location.origin) : null;
    const url = qrAbsoluteUrl(mesaId, getPublicOrigin()) ?? (fallbackOrigin ? `${fallbackOrigin}${path}` : null);
    if (!url) {
      setCopyError(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg bg-stone-50 p-3 text-xs">
      <p className="font-medium text-stone-700">Pedido QR · {mesaNombre}</p>
      <p className="text-stone-500">Copia el link estable para imprimir. Abrir prueba en esta sesión.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" type="button" onClick={copy}>
          {copied ? "Copiado" : copyError ? "No se pudo copiar" : "Copiar link"}
        </Button>
        <Link href={path} target="_blank" rel="noopener noreferrer" className="inline-flex">
          <Button size="sm" variant="ghost" type="button">
            Abrir
          </Button>
        </Link>
      </div>
    </div>
  );
}
