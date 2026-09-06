"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { navForRole, ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";
import { Button } from "@/components/ui/button";

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = navForRole(profile.rol);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-stone-50 dark:bg-stone-950">
      <aside className="hidden w-64 flex-col border-r border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 md:flex">
        <div className="border-b border-stone-200 p-5 dark:border-stone-800">
          <p className="text-xs uppercase tracking-wide text-amber-700">Panadería Sissa</p>
          <h1 className="text-lg font-bold">Sistema de ventas</h1>
          <p className="mt-1 text-sm text-stone-500">
            {profile.nombre} · {ROLE_LABELS[profile.rol]}
          </p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname.startsWith(item.href)
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
                  : "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800",
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-stone-200 p-3 dark:border-stone-800">
          <Button variant="ghost" className="w-full" onClick={logout}>
            Cerrar sesión
          </Button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3 md:hidden dark:border-stone-800 dark:bg-stone-900">
          <div>
            <p className="font-semibold">Panadería Sissa</p>
            <p className="text-xs text-stone-500">{ROLE_LABELS[profile.rol]}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            Salir
          </Button>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
