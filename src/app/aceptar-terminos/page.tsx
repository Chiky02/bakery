"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

type Vigente = {
  id: string;
  version: string;
  titulo: string;
  contenido: string;
};

export default function AceptarTerminosPage() {
  const router = useRouter();
  const [vigente, setVigente] = useState<Vigente | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const res = await fetch("/api/terminos");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "No se pudieron cargar los términos");
        setLoading(false);
        return;
      }
      if (body.accepted || !body.vigente) {
        router.replace("/dashboard");
        return;
      }
      setVigente(body.vigente as Vigente);
      setLoading(false);
    })();
  }, [router]);

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-sm text-stone-500">
        Cargando términos…
      </div>
    );
  }

  if (!vigente) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="max-w-md space-y-3">
          <p className="text-sm text-red-600">{error || "No hay términos disponibles."}</p>
          <Button onClick={salir}>Volver al login</Button>
        </Card>
      </div>
    );
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
