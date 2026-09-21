"use client";

import { useEffect } from "react";

/** Registra el service worker de la PWA (solo en producción / si está soportado). */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // En dev el SW puede cachear de más; se permite con flag.
    const allowDev = process.env.NEXT_PUBLIC_PWA_DEV === "1";
    if (process.env.NODE_ENV !== "production" && !allowDev) return;

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silencioso: PWA opcional
    });
  }, []);

  return null;
}
