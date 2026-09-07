"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/permissions";
import type { Miembro, Panaderia } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function PanaderiasPage() {
  const router = useRouter();
  const [memberships, setMemberships] = useState<Miembro[]>([]);
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setUserId(user.id);
    const { data } = await supabase
      .from("miembros")
      .select("*, panaderias(*)")
      .eq("user_id", user.id)
      .eq("activo", true);
    setMemberships((data as Miembro[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function enterBakery(id: string) {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("profiles").update({ panaderia_activa_id: id }).eq("id", userId);
    router.push("/dashboard");
    router.refresh();
  }

  async function deleteBakery(id: string) {
    if (!confirm("¿Borrar esta panadería? Solo si no tiene datos.")) return;
    const res = await fetch(`/api/panaderias/${id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "No se pudo borrar");
      return;
    }
    setError("");
    await load();
  }

  async function createBakery(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !nombre.trim()) return;
    setLoading(true);
    setError("");
    const supabase = createClient();
    const base = slugify(nombre) || "panaderia";
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;

    const { error: bakErr } = await supabase.rpc("create_panaderia", {
      p_nombre: nombre.trim(),
      p_slug: slug,
    });

    if (bakErr) {
      setError(bakErr.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
          Tus negocios
        </p>
        <h1 className="mt-2 text-3xl font-bold">Tus panaderías</h1>
        <p className="mt-1 text-stone-500">
          Entra a un local o crea uno nuevo. Cada uno tiene su catálogo y cuentas.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-3">
        {memberships.length === 0 ? (
          <Card>
            <p className="text-sm text-stone-500">Aún no perteneces a ninguna panadería.</p>
          </Card>
        ) : (
          memberships.map((m) => {
            const p = m.panaderias as Panaderia;
            return (
              <Card key={m.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{p?.nombre ?? "Panadería"}</p>
                  <p className="text-sm capitalize text-stone-500">{m.rol}</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => enterBakery(m.panaderia_id)}>Entrar</Button>
                  {m.rol === "dueno" && (
                    <Button variant="danger" onClick={() => deleteBakery(m.panaderia_id)}>
                      Borrar
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Card className="space-y-4">
        <CardTitle>Crear panadería</CardTitle>
        <form onSubmit={createBakery} className="space-y-3">
          <Input
            placeholder="Nombre del negocio"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creando..." : "Crear y entrar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
