"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ImpersonateUserButton({
  userId,
  panaderiaId,
  nombre,
}: {
  userId: string;
  panaderiaId: string;
  nombre: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    const res = await fetch("/api/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, panaderia_id: panaderiaId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "No se pudo simular");
      return;
    }
    startTransition(() => {
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        title={`Ver el panel como ${nombre}`}
        onClick={() => void run()}
      >
        {pending ? "…" : "Ver como"}
      </Button>
      {error && <span className="max-w-[10rem] text-[10px] text-red-600">{error}</span>}
    </div>
  );
}
