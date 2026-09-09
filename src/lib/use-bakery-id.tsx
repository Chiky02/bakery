"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SessionContext } from "@/types";

export type BakeryClientContext = Pick<
  SessionContext,
  "profile" | "panaderia" | "rol" | "roleLabel" | "permisos" | "memberships"
>;

const BakeryContext = createContext<BakeryClientContext | null>(null);

export function BakeryProvider({
  value,
  children,
}: {
  value: BakeryClientContext;
  children: ReactNode;
}) {
  return <BakeryContext.Provider value={value}>{children}</BakeryContext.Provider>;
}

export function useBakery(): BakeryClientContext {
  const ctx = useContext(BakeryContext);
  if (!ctx) {
    throw new Error("useBakery must be used within BakeryProvider");
  }
  return ctx;
}

/** panaderiaId comes from the server layout — no extra getUser/profiles roundtrip. */
export function useBakeryId() {
  const ctx = useContext(BakeryContext);
  if (!ctx) return { panaderiaId: null as string | null, ready: false };
  return { panaderiaId: ctx.panaderia.id, ready: true };
}
