"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [brand, setBrand] = useState("Panel");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const slug = process.env.NEXT_PUBLIC_BAKERY_SLUG || "bakerychiky02";
      const { data } = await supabase
        .from("panaderias")
        .select("nombre, nombre_publico")
        .eq("slug", slug)
        .maybeSingle();
      if (data) {
        setBrand(data.nombre_publico?.trim() || data.nombre || "Panel");
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Credenciales incorrectas");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#ffedd5_0%,_#f7f4ef_45%,_#e7e5e4_100%)] p-4">
      <Card className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-700">
            {brand}
          </p>
          <CardTitle className="mt-2 text-2xl">Entrar al sistema</CardTitle>
          <p className="mt-1 text-sm text-stone-500">Ventas, mesas, encargos y recepciones</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Correo</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Contraseña</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
