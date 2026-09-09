import { requireBakeryContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCOP, formatDateTime } from "@/lib/format";
import { bakeryDisplayName } from "@/lib/brand";
import type { Factura, FacturaDetalleItem, Panaderia } from "@/types";
import { PrintActions } from "./print-actions";
import { notFound } from "next/navigation";

export default async function FacturaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { panaderia } = await requireBakeryContext();
  const supabase = await createClient();

  const { data: factura } = await supabase
    .from("facturas")
    .select("*")
    .eq("id", id)
    .eq("panaderia_id", panaderia.id)
    .maybeSingle();

  if (!factura) notFound();

  const f = factura as Factura;
  const detalle = (f.detalle ?? []) as FacturaDetalleItem[];
  const p = panaderia as Panaderia;
  const emisor = p.razon_social?.trim() || bakeryDisplayName(p);
  const legal = p.texto_legal_factura?.trim() || "";

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
      <PrintActions />

      <article className="print-factura rounded-xl border border-stone-200 bg-white p-6 shadow-sm md:p-8">
        <header className="border-b border-stone-200 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
                Factura de venta
              </p>
              <h1 className="text-2xl font-bold">{emisor}</h1>
              {p.nit && <p className="text-sm text-stone-600">NIT {p.nit}</p>}
              {p.direccion && <p className="text-sm text-stone-600">{p.direccion}</p>}
              {p.telefono && <p className="text-sm text-stone-600">Tel. {p.telefono}</p>}
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">{f.numero}</p>
              <p className="text-sm text-stone-500">{formatDateTime(f.created_at)}</p>
              {f.medio_pago && (
                <p className="text-sm capitalize text-stone-600">Pago: {f.medio_pago}</p>
              )}
            </div>
          </div>
        </header>

        <section className="mt-4 grid gap-1 text-sm">
          <p>
            <span className="text-stone-500">Cliente: </span>
            <strong>{f.cliente_nombre}</strong>
          </p>
          {f.cliente_documento && (
            <p>
              <span className="text-stone-500">Documento: </span>
              {f.cliente_documento}
            </p>
          )}
          {f.cliente_direccion && (
            <p>
              <span className="text-stone-500">Dirección: </span>
              {f.cliente_direccion}
            </p>
          )}
          {f.cliente_telefono && (
            <p>
              <span className="text-stone-500">Teléfono: </span>
              {f.cliente_telefono}
            </p>
          )}
          {f.cliente_email && (
            <p>
              <span className="text-stone-500">Email: </span>
              {f.cliente_email}
            </p>
          )}
        </section>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-stone-500">
              <th className="py-2">Descripción</th>
              <th className="py-2 text-right">Cant.</th>
              <th className="py-2 text-right">Precio</th>
              <th className="py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {detalle.map((line, i) => (
              <tr key={i} className="border-b border-stone-100">
                <td className="py-2">{line.nombre}</td>
                <td className="py-2 text-right">{line.cantidad}</td>
                <td className="py-2 text-right">{formatCOP(line.precio)}</td>
                <td className="py-2 text-right">{formatCOP(line.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-500">Subtotal</span>
            <span>{formatCOP(f.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">IVA</span>
            <span>{formatCOP(f.iva)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>Total</span>
            <span>{formatCOP(f.total)}</span>
          </div>
        </div>

        {f.notas && <p className="mt-4 text-sm text-stone-600">{f.notas}</p>}
        {legal ? (
          <p className="mt-6 text-xs leading-relaxed text-stone-400">{legal}</p>
        ) : null}
      </article>
    </div>
  );
}
