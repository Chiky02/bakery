"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBakery } from "@/lib/use-bakery-id";

export function GestionarEquipoButton({
  panaderiaId,
  isActiva,
}: {
  panaderiaId: string;
  isActiva: boolean;
}) {
  const router = useRouter();
  const { profile } = useBakery();
  const [loading, setLoading] = useState(false);

  async function go() {
    setLoading(true);
    if (!isActiva) {
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({ panaderia_activa_id: panaderiaId })
        .eq("id", profile.id);
    }
    router.push("/usuarios");
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={go}
      className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
    >
      {loading ? "Entrando…" : "Gestionar equipo"}
    </button>
  );
}
