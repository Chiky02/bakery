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
  { href: "/login", label: "Iniciar sesión" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="absolute inset-x-0 top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-6">
        <Link href="/" className="group">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-orange-100/90">
            BakeryChiky02
          </p>
          <p className="font-semibold text-white group-hover:text-orange-50">Panadería artesanal</p>
        </Link>

        <nav className="relative hidden items-center gap-1 md:flex">
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
            >
              Menú
              <ChevronDown className={cn("h-4 w-4 transition", open && "rotate-180")} />
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-white/10 bg-stone-950/95 py-1 shadow-xl backdrop-blur">
                {LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "block px-4 py-2.5 text-sm text-stone-200 hover:bg-white/10",
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
            className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400"
          >
            Encargar
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
          >
            Iniciar sesión
          </Link>
        </nav>

        <button
          type="button"
          className="rounded-lg bg-white/10 p-2 text-white md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Abrir menú"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="mx-4 rounded-2xl border border-white/10 bg-stone-950/95 p-3 backdrop-blur md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm text-stone-100 hover:bg-white/10"
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
