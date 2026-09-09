"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

type Option = { id: string; label: string; hint?: string };

/** Selector con búsqueda (combobox) para listas largas de productos. */
export function ProductSearchSelect({
  options,
  value,
  onChange,
  placeholder = "Buscar producto…",
  id,
  name,
  emptyLabel = "Sin producto (solo descripción)",
  allowEmpty = true,
}: {
  options: Option[];
  value: string;
  onChange: (id: string, option?: Option) => void;
  placeholder?: string;
  id?: string;
  name?: string;
  emptyLabel?: string;
  allowEmpty?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (selected) setQ(selected.label);
    else if (!value) setQ("");
  }, [selected, value]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return options.slice(0, 40);
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(term) ||
          (o.hint ?? "").toLowerCase().includes(term),
      )
      .slice(0, 40);
  }, [options, q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <Input
        id={id}
        name={name}
        autoComplete="off"
        placeholder={placeholder}
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
      />
      {open && (
        <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
          {allowEmpty && (
            <li>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-stone-500 hover:bg-stone-50"
                onClick={() => {
                  onChange("");
                  setQ("");
                  setOpen(false);
                }}
              >
                {emptyLabel}
              </button>
            </li>
          )}
          {filtered.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-orange-50"
                onClick={() => {
                  onChange(o.id, o);
                  setQ(o.label);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{o.label}</span>
                {o.hint && <span className="ml-2 text-xs text-stone-400">{o.hint}</span>}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-stone-400">Sin coincidencias</li>
          )}
        </ul>
      )}
    </div>
  );
}
