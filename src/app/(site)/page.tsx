import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCOP } from "@/lib/format";

export default async function PublicHomePage() {
  const supabase = await createClient();
  const { data: panaderia } = await supabase
    .from("panaderias")
    .select("id, nombre, slug")
    .eq("slug", "bakerychiky02")
    .maybeSingle();

  let tortas: { id: string; nombre: string; precio: number }[] = [];
  if (panaderia) {
    const { data: cats } = await supabase
      .from("categorias")
      .select("id")
      .eq("panaderia_id", panaderia.id)
      .ilike("nombre", "%torta%");

    if (cats && cats.length > 0) {
      const { data } = await supabase
        .from("productos")
        .select("id, nombre, precio")
        .eq("panaderia_id", panaderia.id)
        .eq("disponible", true)
        .in(
          "categoria_id",
          cats.map((c) => c.id),
        )
        .order("orden")
        .limit(6);
      tortas = data ?? [];
    }

    if (tortas.length === 0) {
      const { data } = await supabase
        .from("productos")
        .select("id, nombre, precio")
        .eq("panaderia_id", panaderia.id)
        .eq("disponible", true)
        .order("orden")
        .limit(6);
      tortas = data ?? [];
    }
  }

  return (
    <main>
      <section className="relative flex min-h-[100svh] items-end overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(180deg, rgba(26,18,12,0.35) 0%, rgba(26,18,12,0.55) 40%, rgba(26,18,12,0.92) 100%), url('https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1920&q=80')",
          }}
        />
        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 pt-32 md:px-6 md:pb-24">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-orange-300">
            BakeryChiky02
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.05] text-white md:text-6xl">
            Pan caliente, tortas a pedido y el sabor de cada mañana.
          </h1>
          <p className="mt-5 max-w-xl text-base text-stone-200 md:text-lg">
            Encarga tu torta desde aquí o pide en mesa con QR. El equipo entra al panel con iniciar
            sesión.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/encargar"
              className="rounded-full bg-orange-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-orange-400"
            >
              Encargar torta
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </section>

      <section id="especialidades" className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-white md:text-4xl">Especialidades</h2>
          <p className="mt-3 text-stone-400">
            Selección del día. Para una torta personalizada usa el formulario de encargos.
          </p>
        </div>
        <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {tortas.length === 0 ? (
            <li className="text-stone-400">Pronto publicaremos el menú de tortas.</li>
          ) : (
            tortas.map((t) => (
              <li key={t.id} className="border-t border-white/10 pt-4">
                <p className="text-lg font-semibold text-white">{t.nombre}</p>
                <p className="mt-1 text-orange-300">{formatCOP(t.precio)}</p>
              </li>
            ))
          )}
        </ul>
        <div className="mt-10">
          <Link href="/encargar" className="text-sm font-semibold text-orange-300 underline-offset-4 hover:underline">
            Encargar torta →
          </Link>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#120d09]">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:px-6 md:py-20">
          <div>
            <h2 className="text-2xl font-bold text-white">Pedido en mesa</h2>
            <p className="mt-3 text-stone-400">
              Si estás en el local, escanea el QR de tu mesa. El mesero y cocina reciben el pedido al
              instante.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Equipo BakeryChiky02</h2>
            <p className="mt-3 text-stone-400">
              Mostrador, mesas, cocina, caja y recepciones viven en el panel interno.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-block text-sm font-semibold text-orange-300 underline-offset-4 hover:underline"
            >
              Ir a iniciar sesión →
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-stone-500">
        © {new Date().getFullYear()} BakeryChiky02
      </footer>
    </main>
  );
}
