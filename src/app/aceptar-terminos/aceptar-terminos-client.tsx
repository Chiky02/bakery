"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

type Vigente = {
  version: string;
  titulo: string;
  contenido: string;
};

export function AceptarTerminosClient({ vigente }: { vigente: Vigente }) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  async function aceptar() {
    setAccepting(true);
    setError("");
    const res = await fetch("/api/terminos", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "No se pudo registrar la aceptación");
      setAccepting(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  async function salir() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#ffedd5_0%,_#f7f4ef_45%,_#e7e5e4_100%)] p-4">
      <Card className="flex max-h-[min(92dvh,920px)] w-full max-w-2xl flex-col space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
            Antes de continuar
          </p>
          <CardTitle className="mt-1">{vigente.titulo}</CardTitle>
          <p className="mt-1 text-sm text-stone-500">
            Versión {vigente.version}. Debes aceptar para usar el panel (Ley 1581 de 2012 /
            condiciones del servicio).
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-stone-200 bg-stone-50 p-4">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-stone-800">
            {vigente.contenido}
          </pre>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" disabled={accepting} onClick={salir}>
            No acepto / salir
          </Button>
          <Button type="button" disabled={accepting} onClick={() => void aceptar()}>
            {accepting ? "Registrando…" : "He leído y acepto"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
