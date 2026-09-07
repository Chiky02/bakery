"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Panaderia, UserRole } from "@/types";
import { useBakeryId } from "@/lib/use-bakery-id";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Building2, KeyRound, Store, UserRound } from "lucide-react";

type Tab = "negocio" | "cuenta" | "alta";

export default function ConfiguracionPage() {
  const { panaderiaId, ready } = useBakeryId();
  const [tab, setTab] = useState<Tab>("cuenta");
  const [rol, setRol] = useState<UserRole | null>(null);
  const [config, setConfig] = useState<Panaderia | null>(null);
  const [saved, setSaved] = useState(false);
  const [origin, setOrigin] = useState("");

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cuentaMsg, setCuentaMsg] = useState("");
  const [cuentaErr, setCuentaErr] = useState("");
  const [cuentaLoading, setCuentaLoading] = useState(false);

  const [alta, setAlta] = useState({
    nombre: "",
    email: "",
    password: "",
    panaderia_nombre: "",
  });
  const [altaMsg, setAltaMsg] = useState("");
  const [altaErr, setAltaErr] = useState("");
  const [altaLoading, setAltaLoading] = useState(false);

  const canManageNegocio = rol === "dueno" || rol === "admin";

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const res = await fetch("/api/perfil");
      if (res.ok) {
        const body = await res.json();
        setNombre(body.nombre ?? "");
        setEmail(body.email ?? "");
      }

      if (!panaderiaId) return;
      const [{ data: pan }, { data: mem }] = await Promise.all([
        supabase.from("panaderias").select("*").eq("id", panaderiaId).single(),
        supabase
          .from("miembros")
          .select("rol")
          .eq("panaderia_id", panaderiaId)
          .eq("user_id", user.id)
          .eq("activo", true)
          .maybeSingle(),
      ]);
      setConfig(pan as Panaderia);
      const r = (mem?.rol as UserRole) ?? null;
      setRol(r);
      if (r === "dueno" || r === "admin") setTab("negocio");
      else setTab("cuenta");
    })();
  }, [panaderiaId]);

  async function guardarNegocio() {
    if (!config || !panaderiaId) return;
    const supabase = createClient();
    await supabase
      .from("panaderias")
      .update({
        nombre: config.nombre,
        nombre_publico: config.nombre,
        pedido_directo_habilitado: config.pedido_directo_habilitado,
        requiere_aprobacion_mesero: config.requiere_aprobacion_mesero,
        tiempo_minimo_encargo_horas: config.tiempo_minimo_encargo_horas ?? 48,
        updated_at: new Date().toISOString(),
      })
      .eq("id", panaderiaId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function guardarCuenta(e: React.FormEvent) {
    e.preventDefault();
    setCuentaMsg("");
    setCuentaErr("");

    if (newPassword && newPassword !== confirmPassword) {
      setCuentaErr("La confirmación de contraseña no coincide");
      return;
    }
    if ((email || newPassword) && !currentPassword) {
      setCuentaErr("Indica tu contraseña actual para cambiar correo o clave");
      return;
    }

    setCuentaLoading(true);
    const payload: Record<string, string> = { nombre };
    // Solo envía email/password si realmente cambian / se rellenaron
    const resPerfil = await fetch("/api/perfil");
    const current = resPerfil.ok ? await resPerfil.json() : null;
    if (email && email !== current?.email) payload.email = email;
    if (newPassword) {
      payload.password = newPassword;
      payload.current_password = currentPassword;
    } else if (payload.email) {
      payload.current_password = currentPassword;
    }

    const res = await fetch("/api/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    setCuentaLoading(false);
    if (!res.ok) {
      setCuentaErr(body.error ?? "No se pudo actualizar");
      return;
    }
    setCuentaMsg(
      body.password_changed
        ? "Cuenta actualizada. Si cambiaste la contraseña, úsala en el próximo ingreso."
        : "Cuenta actualizada",
    );
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    if (body.email) setEmail(body.email);
  }

  async function crearDueñoNegocio(e: React.FormEvent) {
    e.preventDefault();
    setAltaMsg("");
    setAltaErr("");
    setAltaLoading(true);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(alta),
    });
    const body = await res.json().catch(() => ({}));
    setAltaLoading(false);
    if (!res.ok) {
      setAltaErr(body.error ?? "No se pudo crear");
      return;
    }
    setAltaMsg(
      `Listo: ${body.panaderia?.nombre} · dueño ${body.login?.email}. Ya puede iniciar sesión.`,
    );
    setAlta({ nombre: "", email: "", password: "", panaderia_nombre: "" });
  }

  if (!ready || !config) return <p>Cargando...</p>;

  const tabs: { id: Tab; label: string; icon: typeof Store; show: boolean }[] = [
    { id: "negocio", label: "Negocio", icon: Store, show: canManageNegocio },
    { id: "cuenta", label: "Mi cuenta", icon: UserRound, show: true },
    { id: "alta", label: "Alta de negocio", icon: Building2, show: canManageNegocio },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-sm text-stone-500">
          Negocio, tu cuenta (correo y contraseña) y altas de nuevos dueños
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs
          .filter((t) => t.show)
          .map((t) => {
            const Icon = t.icon;
            return (
              <Button
                key={t.id}
                variant={tab === t.id ? "primary" : "secondary"}
                className="gap-1.5"
                onClick={() => setTab(t.id)}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </Button>
            );
          })}
      </div>

      {tab === "negocio" && canManageNegocio && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-4">
            <CardTitle>Local actual</CardTitle>
            <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Nombre del negocio</label>
              <input
                className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
                value={config.nombre}
                onChange={(e) => setConfig({ ...config, nombre: e.target.value })}
              />
              <p className="mt-1 text-xs text-stone-500">
                Este nombre se muestra en el panel, el sitio público, login y pedidos QR.
              </p>
            </div>

              <label className="flex items-start gap-3 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={config.pedido_directo_habilitado}
                  onChange={(e) =>
                    setConfig({ ...config, pedido_directo_habilitado: e.target.checked })
                  }
                />
                <div>
                  <p className="font-medium">Pedido directo por QR</p>
                  <p className="text-xs text-stone-500">
                    Permite que clientes pidan escaneando el QR de la mesa
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-lg border border-stone-200 p-3 dark:border-stone-700">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={config.requiere_aprobacion_mesero}
                  onChange={(e) =>
                    setConfig({ ...config, requiere_aprobacion_mesero: e.target.checked })
                  }
                />
                <div>
                  <p className="font-medium">Mesero como filtro</p>
                  <p className="text-xs text-stone-500">
                    Pedidos QR quedan pendientes de confirmación del mesero
                  </p>
                </div>
              </label>

              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Tiempo mínimo encargos (horas)</label>
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-900"
                  value={config.tiempo_minimo_encargo_horas ?? 48}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      tiempo_minimo_encargo_horas: Math.max(1, Number(e.target.value) || 48),
                    })
                  }
                />
                <p className="mt-1 text-xs text-stone-500">
                  El cliente no podrá pedir torta con entrega antes de ese plazo.
                </p>
              </div>
            </div>

            <Button onClick={guardarNegocio}>Guardar</Button>
            {saved && <p className="text-sm text-green-600">Guardado</p>}
          </Card>

          {config.pedido_directo_habilitado && (
            <Card className="space-y-2">
              <CardTitle>Links de pedido QR</CardTitle>
              <p className="text-sm text-stone-500">
                Copia el link de cada mesa en{" "}
                <a href="/mesas" className="text-orange-700 underline dark:text-orange-300">
                  Mesas
                </a>
                .
              </p>
              <code className="block break-all rounded-lg bg-stone-100 p-3 text-xs dark:bg-stone-800">
                {origin}/qr/[id-de-mesa]
              </code>
            </Card>
          )}
        </div>
      )}

      {tab === "cuenta" && (
        <Card className="w-full space-y-4">
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Mi cuenta
          </CardTitle>
          <p className="text-sm text-stone-500">
            Corrige tu nombre, correo o contraseña. Para correo o clave necesitas la contraseña
            actual.
          </p>
          <form onSubmit={guardarCuenta} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Nombre</label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            </div>
            <div className="sm:col-span-1 lg:col-span-2">
              <label className="mb-1 block text-sm font-medium">Correo</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Contraseña actual</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Obligatoria si cambias correo o clave"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Nueva contraseña</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Confirmar nueva contraseña</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-col justify-end gap-2 sm:col-span-2 lg:col-span-3">
              {cuentaErr && <p className="text-sm text-red-600">{cuentaErr}</p>}
              {cuentaMsg && <p className="text-sm text-emerald-600">{cuentaMsg}</p>}
              <Button type="submit" disabled={cuentaLoading} className="w-fit">
                {cuentaLoading ? "Guardando..." : "Actualizar cuenta"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {tab === "alta" && canManageNegocio && (
        <Card className="w-full space-y-4">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Alta de dueño + panadería
          </CardTitle>
          <p className="text-sm text-stone-500">
            Crea un usuario dueño con su propia empresa. Quedará separado de este local y podrá
            gestionar catálogo, mesas y equipo.
          </p>
          <form onSubmit={crearDueñoNegocio} className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Nombre del dueño</label>
              <Input
                value={alta.nombre}
                onChange={(e) => setAlta({ ...alta, nombre: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Correo de acceso</label>
              <Input
                type="email"
                value={alta.email}
                onChange={(e) => setAlta({ ...alta, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Contraseña temporal</label>
              <Input
                type="password"
                value={alta.password}
                onChange={(e) => setAlta({ ...alta, password: e.target.value })}
                required
                minLength={8}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Nombre de la panadería</label>
              <Input
                value={alta.panaderia_nombre}
                onChange={(e) => setAlta({ ...alta, panaderia_nombre: e.target.value })}
                required
                placeholder="Ej. Panadería del Norte"
              />
            </div>
            <div className="sm:col-span-2">
              {altaErr && <p className="mb-2 text-sm text-red-600">{altaErr}</p>}
              {altaMsg && <p className="mb-2 text-sm text-emerald-600">{altaMsg}</p>}
              <Button type="submit" disabled={altaLoading}>
                {altaLoading ? "Creando..." : "Crear dueño y negocio"}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
