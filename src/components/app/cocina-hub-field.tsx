"use client";

import { useEffect, useState } from "react";
import { getCocinaHubUrl, normalizeHubUrl, setCocinaHubUrl } from "@/lib/cocina-hub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CocinaHubField() {
  const [url, setUrl] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setUrl(getCocinaHubUrl() ?? "");
  }, []);

  function save() {
    const next = normalizeHubUrl(url);
    if (url.trim() && !next) {
      setMsg("Usa una dirección como http://192.168.1.50:8787");
      return;
    }
    setCocinaHubUrl(next);
    setUrl(next ?? "");
    setMsg(next ? "Equipo de cocina guardado en este dispositivo." : "Dirección borrada.");
  }

  return (
    <div className="rounded-lg border border-stone-200 p-3">
      <p className="font-medium">Equipo de cocina en el WiFi del local</p>
      <p className="mt-1 text-xs text-stone-500">
        Para un restaurante con mala señal. En el computador de cocina ejecuta{" "}
        <span className="font-medium">npm run cocina-hub</span> y anota aquí su dirección, por
        ejemplo http://192.168.1.50:8787. Mesero y cocina tienen que estar en ese mismo WiFi. Si
        la nube no responde, el pedido aparece en ese equipo y se sube solo al volver internet.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <Input
          value={url}
          placeholder="http://192.168.1.50:8787"
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Dirección del equipo de cocina"
        />
        <Button type="button" variant="secondary" onClick={save}>
          Guardar en este equipo
        </Button>
      </div>
      {msg && <p className="mt-2 text-xs text-stone-600">{msg}</p>}
    </div>
  );
}
