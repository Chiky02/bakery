"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const REFRESH_IF_EXPIRES_WITHIN_MS = 20 * 60 * 1000;
const CHECK_EVERY_MS = 4 * 60 * 1000;

/** Mantiene la sesión mientras el panel está abierto (mesero, cocina, caja). */
export function SessionKeepAlive() {
  useEffect(() => {
    const supabase = createClient();
    let stopped = false;

    async function touch() {
      if (stopped || document.visibilityState === "hidden") return;
      const { data } = await supabase.auth.getSession();
      const expMs = (data.session?.expires_at ?? 0) * 1000;
      const missing = !data.session;
      const soon = expMs > 0 && expMs - Date.now() < REFRESH_IF_EXPIRES_WITHIN_MS;
      if (missing || soon) {
        await supabase.auth.refreshSession();
      }
    }

    void supabase.auth.startAutoRefresh();
    void touch();
    const id = window.setInterval(() => void touch(), CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void touch();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return null;
}
