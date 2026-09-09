"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBakeryId } from "@/lib/use-bakery-id";
import type { Cliente } from "@/types";
import { Input } from "@/components/ui/input";

/** Buscador de clientes para facturas / encargos. */
export function ClientePicker({
  onSelect,
  selectedId,
}: {
  onSelect: (c: Cliente | null) => void;
  selectedId?: string | null;
}) {
  const { panaderiaId } = useBakeryId();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!panaderiaId) return;
    const supabase = createClient();
    void (async () => {
      const { data } = await supabase
        .from("clientes")
        .select("*")
        .eq("panaderia_id", panaderiaId)
        .eq("activo", true)
        .order("nombre")
        .limit(200);
      setClientes((data as Cliente[]) ?? []);
    })();
  }, [panaderiaId]);

  const selected = clientes.find((c) => c.id === selectedId);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return clientes.slice(0, 12);
    return clientes
      .filter(
        (c) =>
          c.nombre.toLowerCase().includes(term) ||
          (c.documento ?? "").toLowerCase().includes(term) ||
          (c.telefono ?? "").includes(term),
      )
      .slice(0, 12);
  }, [clientes, q]);

  return (
    <div className="relative space-y-1">
      <label className="text-xs font-medium text-stone-500">Cliente guardado</label>
      {selected ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
          <span>
            {selected.nombre}
            {selected.documento ? ` · ${selected.documento}` : ""}
          </span>
          <button
            type="button"
            className="text-xs text-orange-700 underline"
            onClick={() => {
              onSelect(null);
              setQ("");
            }}
          >
            Quitar
          </button>
        </div>
      ) : (
        <>
          <Input
            placeholder="Buscar en directorio…"
            value={q}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
          />
          {open && (
            <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-orange-50"
                    onClick={() => {
                      onSelect(c);
                      setOpen(false);
                      setQ("");
                    }}
                  >
                    <span className="font-medium">{c.nombre}</span>
                    <span className="ml-2 text-xs text-stone-400">
                      {[c.documento, c.telefono].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-stone-400">
                  Sin coincidencias — escribe los datos manualmente
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
