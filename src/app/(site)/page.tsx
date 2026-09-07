import Link from "next/link";
import { bakeryDisplayName } from "@/lib/brand";
import { listPublicBakeries } from "@/lib/public-bakery";
import { MapPin, Cake } from "lucide-react";

export default async function PublicHomePage() {
  const locales = await listPublicBakeries();

  return (
    <main>
      <section className="relative overflow-hidden border-b border-orange-100">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "linear-gradient(105deg, rgba(247,244,239,0.92) 0%, rgba(247,244,239,0.75) 42%, rgba(247,244,239,0.35) 100%), url('https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=1920&q=80')",
          }}
        />
        <div className="relative z-10 mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center md:px-6 md:py-24">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-orange-700">
              Chiky02
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-[1.08] text-stone-900 md:text-5xl">
              Encarga tu torta en el local que elijas
            </h1>
            <p className="mt-4 max-w-md text-base text-stone-700 md:text-lg">
              Varios negocios en un solo lugar. Elige la panadería, indica la fecha de entrega y
              envía tu pedido.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/encargar"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-200 transition hover:from-orange-400 hover:to-amber-400"
              >
                <Cake className="h-4 w-4" />
                Encargar torta
              </Link>
              <Link
                href="/#locales"
                className="inline-flex rounded-full border border-stone-300 bg-white/80 px-6 py-3 text-sm font-semibold text-stone-800 backdrop-blur transition hover:bg-white"
              >
                Ver locales
              </Link>
            </div>
          </div>
          <div className="rounded-3xl border border-orange-100/80 bg-white/80 p-6 shadow-sm backdrop-blur md:p-8">
            <p className="text-sm font-medium text-stone-500">Cómo funciona</p>
            <ol className="mt-4 space-y-4 text-sm text-stone-800">
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-800">
                  1
                </span>
                <span>Elige el negocio / sucursal</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-800">
                  2
                </span>
                <span>Selecciona el producto o describe tu torta</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-800">
                  3
                </span>
                <span>Indica fecha y datos de contacto</span>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section id="locales" className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-stone-900">Locales</h2>
            <p className="mt-2 text-stone-600">
              Selecciona a qué negocio quieres hacer el encargo.
            </p>
          </div>
          <p className="text-sm text-stone-500">
            {locales.length} {locales.length === 1 ? "local activo" : "locales activos"}
          </p>
        </div>

        {locales.length === 0 ? (
          <p className="mt-10 rounded-2xl border border-dashed border-stone-300 p-10 text-center text-stone-500">
            Aún no hay locales publicados.
          </p>
        ) : (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locales.map((local) => {
              const name = bakeryDisplayName(local);
              return (
                <li
                  key={local.id}
                  className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-orange-200 hover:shadow-md"
                >
                  <div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-stone-900">{name}</h3>
                    <p className="mt-1 text-sm text-stone-500">Encargos y tortas a pedido</p>
                  </div>
                  <Link
                    href={`/encargar?negocio=${encodeURIComponent(local.slug)}`}
                    className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-500"
                  >
                    Encargar aquí
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="border-t border-orange-100 py-8 text-center text-xs text-stone-500">
        © {new Date().getFullYear()} Chiky02
      </footer>
    </main>
  );
}
