"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type VersionRow = {
  id: string;
  version: string;
  titulo: string;
  contenido: string;
  vigente: boolean;
  publicada_at: string | null;
  created_at: string;
};

export function TerminosAdminClient() {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [version, setVersion] = useState("");
  const [titulo, setTitulo] = useState("Términos y condiciones de uso del panel");
  const [contenido, setContenido] = useState("");
  const [seeded, setSeeded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch("/api/terminos/admin");
    const body = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(body.error ?? "No se pudieron cargar las versiones");
      return;
    }
    const list = (body.versions as VersionRow[]) ?? [];
    setVersions(list);
    const vigente = list.find((v) => v.vigente);
    if (vigente && !seeded) {
      setContenido(vigente.contenido);
      setTitulo(vigente.titulo);
      const parts = vigente.version.split(".");
      const minor = Number(parts[1] ?? 0) + 1;
      setVersion(`${parts[0] ?? "1"}.${Number.isFinite(minor) ? minor : 1}`);
      setSelectedId(vigente.id);
      setSeeded(true);
    }
  }, [seeded]);

  useEffect(() => {
    void load();
  }, [load]);

  async function publicar(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm("¿Publicar esta versión? Todos los usuarios deberán aceptarla de nuevo.")) {
      return;
    }
    setSaving(true);
    setError("");
    setMsg("");
    const res = await fetch("/api/terminos/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version, titulo, contenido }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "No se pudo publicar");
      return;
    }
    setMsg(`Versión ${body.version?.version ?? version} publicada.`);
    setSeeded(false);
    await load();
  }

  function ver(v: VersionRow) {
    setSelectedId(v.id);
    setTitulo(v.titulo);
    setContenido(v.contenido);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Términos y condiciones</h1>
        <p className="text-sm text-stone-500">
          Solo admin de plataforma. Cada versión publicada exige nueva aceptación al iniciar
          sesión.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {msg && <p className="text-sm text-emerald-600">{msg}</p>}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,14rem)_1fr]">
        <Card className="space-y-2">
          <CardTitle className="text-base">Versiones</CardTitle>
          {loading ? (
            <p className="text-sm text-stone-500">Cargando…</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-stone-500">Sin versiones</p>
          ) : (
            <ul className="space-y-1">
              {versions.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => ver(v)}
                    className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm ${
                      selectedId === v.id ? "bg-orange-50 text-orange-950" : "hover:bg-stone-50"
                    }`}
                  >
                    <span>v{v.version}</span>
                    {v.vigente && <Badge color="success">Vigente</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="space-y-4">
          <CardTitle className="text-base">Publicar nueva versión</CardTitle>
          <p className="text-xs text-stone-500">
            Edita el texto (puedes partir de la vigente) y publica. Describe finalidades en
            lenguaje claro para el usuario.
          </p>
          <form onSubmit={publicar} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Versión</label>
                <Input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.1"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Título</label>
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Contenido</label>
              <textarea
                className="min-h-[280px] w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm leading-relaxed"
                value={contenido}
                onChange={(e) => setContenido(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Publicando…" : "Publicar versión"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
