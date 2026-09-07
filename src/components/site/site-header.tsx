"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Menu, X } from "lucide-react";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/#especialidades", label: "Especialidades" },
  { href: "/encargar", label: "Encargar torta" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-orange-100/80 bg-[#f7f4ef]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        <Link href="/" className="group">
          <p className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-stone-900 md:text-xl">
            Dulce Bonanza
          </p>
          <p className="text-[11px] uppercase tracking-[0.22em] text-orange-700/80">
            Panadería artesanal
          </p>
        </Link>

        <nav className="relative hidden items-center gap-2 md:flex">
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-800 shadow-sm transition hover:bg-stone-50"
            >
              Explorar
              <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white py-2 shadow-xl">
                {LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "block px-4 py-2.5 text-sm text-stone-700 transition hover:bg-orange-50 hover:text-orange-900",
                      pathname === l.href && "bg-orange-50 text-orange-900",
                    )}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <Link
            href="/encargar"
            className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-orange-200 transition hover:from-orange-400 hover:to-amber-400"
          >
            Encargar torta
          </Link>
        </nav>

        <button
          type="button"
          className="rounded-full border border-stone-200 bg-white p-2.5 text-stone-800 shadow-sm md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Abrir menú"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="mx-4 mb-3 overflow-hidden rounded-2xl border border-stone-200 bg-white p-2 shadow-xl md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="block rounded-xl px-4 py-3 text-sm font-medium text-stone-800 hover:bg-orange-50"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/encargar"
            onClick={() => setMobileOpen(false)}
            className="mt-1 block rounded-xl bg-orange-500 px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Encargar torta
          </Link>
        </div>
      )}
    </header>
  );
}
