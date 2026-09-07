"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { navForRole, ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { Miembro, Panaderia, Profile, UserRole } from "@/types";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { Moon, Sun } from "lucide-react";

export function AppShell({
  profile,
  panaderia,
  rol,
  memberships,
  children,
}: {
  profile: Profile;
  panaderia: Panaderia;
  rol: UserRole;
  memberships: Miembro[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = navForRole(rol);
  const { theme, toggle } = useTheme();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function switchBakery(id: string) {
    const supabase = createClient();
    await supabase.from("profiles").update({ panaderia_activa_id: id }).eq("id", profile.id);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 flex-col border-r border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 md:flex">
        <div className="border-b border-stone-200 p-5 dark:border-stone-800">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700 dark:text-orange-400">
            BakeryChiky02
          </p>
          <h1 className="mt-1 text-lg font-bold leading-tight">{panaderia.nombre}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {profile.nombre} · {ROLE_LABELS[rol]}
          </p>
          {memberships.length > 1 && (
            <select
              className="mt-3 w-full rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-800"
              value={panaderia.id}
              onChange={(e) => switchBakery(e.target.value)}
            >
              {memberships.map((m) => (
                <option key={m.panaderia_id} value={m.panaderia_id}>
                  {(m.panaderias as Panaderia | undefined)?.nombre ?? m.panaderia_id}
                </option>
              ))}
            </select>
          )}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith(item.href)
                  ? "bg-orange-100 text-orange-950 dark:bg-orange-950/50 dark:text-orange-100"
                  : "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800",
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-2 border-t border-stone-200 p-3 dark:border-stone-800">
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={toggle}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Modo claro" : "Modo oscuro"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={logout}>
            Cerrar sesión
          </Button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 md:hidden dark:border-stone-800 dark:bg-stone-900">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-orange-700">
              BakeryChiky02
            </p>
            <p className="font-semibold">{panaderia.nombre}</p>
            <p className="text-xs text-stone-500">{ROLE_LABELS[rol]}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={toggle} aria-label="Cambiar tema">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              Salir
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
