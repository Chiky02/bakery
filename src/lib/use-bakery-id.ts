"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useBakeryId() {
  const [panaderiaId, setPanaderiaId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setReady(true);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("panaderia_activa_id")
        .eq("id", user.id)
        .single();
      if (!cancelled) {
        setPanaderiaId(data?.panaderia_activa_id ?? null);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { panaderiaId, ready };
}
