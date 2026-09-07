import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function PublicHomePage() {
  const supabase = await createClient();
  const { data: panaderia } = await supabase
    .from("panaderias")
    .select("id, nombre, nombre_publico, slug")
    .eq("slug", "bakerychiky02")
    .maybeSingle();

  const brand = panaderia?.nombre_publico || panaderia?.nombre || "Dulce Bonanza";

  let especialidades: { id: string; nombre: string }[] = [];
  if (panaderia) {
    const { data: cats } = await supabase
      .from("categorias")
      .select("id")
      .eq("panaderia_id", panaderia.id)
      .ilike("nombre", "%torta%");

    if (cats && cats.length > 0) {
      const { data } = await supabase
        .from("productos")
        .select("id, nombre")
        .eq("panaderia_id", panaderia.id)
        .eq("disponible", true)
        .in(
          "categoria_id",
          cats.map((c) => c.id),
        )
        .order("orden")
        .limit(6);
      especialidades = (data ?? []).map((d) => ({ id: d.id, nombre: d.nombre }));
    }

    if (especialidades.length === 0) {
      const { data } = await supabase
        .from("productos")
        .select("id, nombre, tipo")
        .eq("panaderia_id", panaderia.id)
        .eq("disponible", true)
        .order("orden")
        .limit(12);
      especialidades = (data ?? [])
        .filter((d) => ((d as { tipo?: string }).tipo ?? "venta") !== "materia_prima")
        .slice(0, 6)
        .map((d) => ({ id: d.id, nombre: d.nombre }));
    }
  }

  return (
    <main>
      <section className="relative flex min-h-[100svh] items-end overflow-hidden">
        <div
          className="absolute inset-0 scale-105 bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(26,18,12,0.25) 0%, rgba(26,18,12,0.5) 45%, rgba(26,18,12,0.94) 100%), url('https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1920&q=80')",
          }}
        />
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 pt-32 md:px-6 md:pb-24">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-orange-300">
            {brand}
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.05] text-white md:text-6xl">
            El aroma del pan recién horneado, cada mañana.
          </h1>
          <p className="mt-5 max-w-xl text-base text-stone-200 md:text-lg">
            Tortas a pedido, panadería artesanal y el sabor de casa. Encarga tu torta desde aquí.
          </p>
          <div className="mt-8">
            <Link
              href="/encargar"
              className="inline-flex rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-950/40 transition hover:from-orange-400 hover:to-amber-400"
            >
              Encargar torta
            </Link>
          </div>
        </div>
      </section>

      <section id="especialidades" className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-white md:text-4xl">Especialidades</h2>
          <p className="mt-3 text-stone-400">
            Una muestra de lo que horneamos. Para personalizar, usa el formulario de encargos.
          </p>
        </div>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {especialidades.length === 0 ? (
            <li className="text-stone-400">Pronto más delicias en vitrina.</li>
          ) : (
            especialidades.map((t) => (
              <li key={t.id} className="border-t border-white/10 pt-4">
                <p className="text-lg font-semibold text-white">{t.nombre}</p>
              </li>
            ))
          )}
        </ul>
        <div className="mt-10">
          <Link
            href="/encargar"
            className="text-sm font-semibold text-orange-300 underline-offset-4 hover:underline"
          >
            Encargar torta →
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-stone-500">
        © {new Date().getFullYear()} {brand}
      </footer>
    </main>
  );
}
