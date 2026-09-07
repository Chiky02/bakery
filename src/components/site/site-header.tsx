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
    <header className="absolute inset-x-0 top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-6">
        <Link href="/" className="group">
          <p className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-white drop-shadow md:text-xl">
            Dulce Bonanza
          </p>
          <p className="text-[11px] uppercase tracking-[0.22em] text-orange-100/80">
            Panadería artesanal
          </p>
        </Link>

        <nav className="relative hidden items-center gap-2 md:flex">
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/25 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition hover:bg-black/40"
            >
              Explorar
              <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-white/15 bg-[#1a120c]/95 py-2 shadow-2xl backdrop-blur-xl">
                {LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "block px-4 py-2.5 text-sm text-stone-200 transition hover:bg-white/10 hover:text-white",
                      pathname === l.href && "bg-white/10 text-white",
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
            className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 transition hover:from-orange-400 hover:to-amber-400"
          >
            Encargar torta
          </Link>
        </nav>

        <button
          type="button"
          className="rounded-full border border-white/25 bg-black/25 p-2.5 text-white backdrop-blur md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Abrir menú"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="mx-4 overflow-hidden rounded-2xl border border-white/15 bg-[#1a120c]/95 p-2 shadow-2xl backdrop-blur-xl md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="block rounded-xl px-4 py-3 text-sm font-medium text-stone-100 hover:bg-white/10"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/encargar"
            onClick={() => setMobileOpen(false)}
            className="mt-1 block rounded-xl bg-orange-500/90 px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Encargar torta
          </Link>
        </div>
      )}
    </header>
  );
}
