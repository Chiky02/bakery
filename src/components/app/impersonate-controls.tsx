"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, USER_ROLES } from "@/lib/permissions";
import type { UserRole } from "@/types";
import { Button } from "@/components/ui/button";

export function ImpersonateControls({
  impersonating,
  impersonatingUser,
  compact,
}: {
  impersonating: UserRole | null;
  impersonatingUser: { id: string; nombre: string } | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const activeRol = impersonatingUser ? "" : (impersonating ?? "");

  async function apply(rol: string) {
    setError(null);
    const body = rol ? { rol } : { clear: true };
    const res = await fetch("/api/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "No se pudo cambiar el rol");
      return;
    }
    startTransition(() => {
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500">
        Simular rol
      </label>
      <select
        className="w-full rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-sm disabled:opacity-60"
        value={activeRol}
        disabled={pending || !!impersonatingUser}
        onChange={(e) => void apply(e.target.value)}
      >
        <option value="">Admin plataforma</option>
        {USER_ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
      {impersonatingUser && (
        <p className="text-[11px] text-amber-800">
          Viendo como usuario: {impersonatingUser.nombre}. Usa el banner para salir.
        </p>
      )}
      {(impersonating || impersonatingUser) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          disabled={pending}
          onClick={() => void apply("")}
        >
          Salir de simulación
        </Button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function ImpersonateBanner({
  impersonating,
  impersonatingUser,
}: {
  impersonating: UserRole | null;
  impersonatingUser: { nombre: string } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function exit() {
    await fetch("/api/impersonate", { method: "DELETE" });
    startTransition(() => {
      router.push("/dashboard");
      router.refresh();
    });
  }

  const label = impersonatingUser
    ? impersonatingUser.nombre
    : impersonating
      ? ROLE_LABELS[impersonating]
      : "";

  if (!label) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 md:px-4">
      <p>
        <span className="font-semibold">Modo prueba / soporte:</span> estás viendo el panel como{" "}
        <span className="font-semibold">{label}</span>
        {impersonatingUser ? " (usuario del equipo)" : " (rol)"}. Menú y permisos reflejan esa
        vista.
      </p>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() => void exit()}
      >
        {pending ? "Saliendo…" : "Volver a admin plataforma"}
      </Button>
    </div>
  );
}
