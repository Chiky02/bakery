"use client";

import { useEffect } from "react";

/** Fuerza modo claro: limpia clase .dark y preferencia guardada. */
export function LightModeLock({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    localStorage.removeItem("app-theme");
    localStorage.removeItem("bakerychiky-theme");
  }, []);

  return children;
}
