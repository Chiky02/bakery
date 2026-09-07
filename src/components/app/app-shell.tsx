"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { navForRole, ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { Miembro, Notificacion, Panaderia, Profile, UserRole } from "@/types";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";
import { notificationHref } from "@/lib/notifications";

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
  const [notifs, setNotifs] = useState<Notificacion[]>([]);
  const [openNotif, setOpenNotif] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("notificaciones")
      .select("*")
      .eq("user_id", profile.id)
      .eq("panaderia_id", panaderia.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => setNotifs((data as Notificacion[]) ?? []));
  }, [profile.id, panaderia.id, pathname]);

  const unread = notifs.filter((n) => !n.leida).length;

  async function markRead(id: string) {
    const supabase = createClient();
    await supabase.from("notificaciones").update({ leida: true }).eq("id", id);
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)));
  }

  async function dismissNotif(id: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    const supabase = createClient();
    const { error } = await supabase.from("notificaciones").delete().eq("id", id);
    if (error) {
      // Si aún no está la política DELETE, marca leída y oculta en UI
      await supabase.from("notificaciones").update({ leida: true }).eq("id", id);
    }
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  }

  async function openNotifItem(n: Notificacion) {
    await markRead(n.id);
    setOpenNotif(false);
    router.push(notificationHref(n.tipo));
  }

  async function clearAll() {
    const supabase = createClient();
    const ids = notifs.map((n) => n.id);
    if (ids.length === 0) return;
    const { error } = await supabase.from("notificaciones").delete().in("id", ids);
    if (error) {
      await supabase.from("notificaciones").update({ leida: true }).in("id", ids);
    }
    setNotifs([]);
  }

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
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className="hidden h-dvh w-64 shrink-0 flex-col overflow-hidden border-r border-stone-200 bg-white   md:flex">
        <div className="shrink-0 border-b border-stone-200 p-5 ">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">
            Panel
          </p>
          <h1 className="mt-1 text-lg font-bold leading-tight">
            {panaderia.nombre_publico?.trim() || panaderia.nombre}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {profile.nombre} · {ROLE_LABELS[rol]}
          </p>
          {memberships.length > 1 && (
            <select
              className="mt-3 w-full rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-sm  "
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
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/mesas"
                ? pathname === "/mesas" ||
                  (pathname.startsWith("/mesas/") && !pathname.startsWith("/mesas/gestion"))
                : item.href === "/mesas/gestion"
                  ? pathname.startsWith("/mesas/gestion")
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-orange-100 text-orange-950  "
                    : "text-stone-600 hover:bg-stone-100  ",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 space-y-2 border-t border-stone-200 p-3 ">
          <Button variant="ghost" className="w-full" onClick={logout}>
            Cerrar sesión
          </Button>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-stone-200 bg-white px-4 py-3  ">
          <div className="md:hidden">
            <p className="font-semibold">
              {panaderia.nombre_publico?.trim() || panaderia.nombre}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpenNotif((v) => !v)}
                aria-label="Notificaciones"
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1 text-[10px] text-white">
                    {unread}
                  </span>
                )}
              </Button>
              {openNotif && (
                <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-stone-200 bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
                    <p className="text-sm font-semibold">Notificaciones</p>
                    {notifs.length > 0 && (
                      <button
                        type="button"
                        className="text-xs text-stone-500 hover:text-orange-700"
                        onClick={clearAll}
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <ul className="max-h-72 overflow-y-auto">
                    {notifs.length === 0 ? (
                      <li className="px-3 py-4 text-sm text-stone-500">Sin avisos</li>
                    ) : (
                      notifs.map((n) => (
                        <li key={n.id} className="flex items-start border-b border-stone-50 last:border-0">
                          <button
                            type="button"
                            className={cn(
                              "min-w-0 flex-1 px-3 py-2.5 text-left text-sm hover:bg-stone-50",
                              !n.leida && "bg-orange-50/70",
                            )}
                            onClick={() => openNotifItem(n)}
                          >
                            <p className="font-medium text-stone-900">{n.titulo}</p>
                            {n.cuerpo && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">{n.cuerpo}</p>
                            )}
                          </button>
                          <button
                            type="button"
                            className="shrink-0 p-2 text-stone-400 hover:text-red-600"
                            title="Quitar"
                            aria-label="Quitar notificación"
                            onClick={(e) => dismissNotif(n.id, e)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" className="md:hidden" onClick={logout}>
              Salir
            </Button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
