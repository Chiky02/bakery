import Link from "next/link";
import { bakeryDisplayName } from "@/lib/brand";
import {
  getPrimaryPublicBakery,
  listPublicBakeries,
  primaryBrandName,
} from "@/lib/public-bakery";
import { MapPin, Cake, Phone, ExternalLink } from "lucide-react";

function telHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits}`;
}

function waHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default async function PublicHomePage() {
  const [locales, primary] = await Promise.all([
    listPublicBakeries(),
    getPrimaryPublicBakery(),
  ]);
  const brand = primaryBrandName(primary);
  const whatsapp =
    primary?.whatsapp?.trim() ||
    primary?.telefono?.trim() ||
    locales.find((l) => l.whatsapp?.trim())?.whatsapp?.trim() ||
    locales.find((l) => l.telefono?.trim())?.telefono?.trim() ||
    "";

  return (
    <main className="relative pb-24">
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
              {brand}
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-[1.08] text-stone-900 md:text-5xl">
              Encarga tu torta en el local que elijas
            </h1>
            <p className="mt-4 max-w-md text-base text-stone-700 md:text-lg">
              Elige la panadería, revisa dirección y teléfono, indica la fecha de entrega y envía
              tu pedido.
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
              Dirección y teléfono de cada negocio para que sepas dónde pides.
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
                    {local.direccion ? (
                      <p className="mt-2 text-sm text-stone-600">{local.direccion}</p>
                    ) : (
                      <p className="mt-2 text-sm text-stone-400">Dirección por confirmar</p>
                    )}
                    {local.maps_url ? (
                      <a
                        href={local.maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-orange-700 hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Cómo llegar
                      </a>
                    ) : null}
                    {local.telefono ? (
                      <a
                        href={telHref(local.telefono)}
                        className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-orange-700 hover:underline"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {local.telefono}
                      </a>
                    ) : (
                      <p className="mt-2 text-sm text-stone-400">Teléfono por confirmar</p>
                    )}
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

      {whatsapp && (
        <a
          href={waHref(whatsapp)}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-300/40 transition hover:bg-[#1ebe57] md:bottom-8 md:right-8"
          aria-label={`WhatsApp ${brand}`}
          title="Escribir por WhatsApp"
        >
          <WhatsAppIcon className="h-7 w-7" />
        </a>
      )}
    </main>
  );
}
