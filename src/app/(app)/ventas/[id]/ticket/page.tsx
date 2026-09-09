import { requireBakeryContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatCOP, formatDateTime } from "@/lib/format";
import { bakeryDisplayName } from "@/lib/brand";
import { PrintActions } from "@/app/(app)/facturas/[id]/print-actions";
import { notFound } from "next/navigation";

type Detalle = {
  nombre: string;
  cantidad: number;
  precio: number;
  subtotal?: number;
};

export default async function TicketVentaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { panaderia } = await requireBakeryContext();
  const supabase = await createClient();

  const { data: venta } = await supabase
    .from("ventas_mostrador")
    .select("*")
    .eq("id", id)
    .eq("panaderia_id", panaderia.id)
    .maybeSingle();

  if (!venta) notFound();

  const detalle = (venta.detalle ?? []) as Detalle[];
  const anulado = !!venta.anulado;

  return (
    <div className="mx-auto max-w-md space-y-4 p-4">
      <PrintActions />
      <article className="print-ticket rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <header className="border-b border-dashed border-stone-300 pb-3 text-center">
          <p className="text-xs uppercase tracking-widest text-stone-500">Comprobante de venta</p>
          <h1 className="text-lg font-bold">{bakeryDisplayName(panaderia)}</h1>
          {panaderia.nit && <p className="text-xs text-stone-600">NIT {panaderia.nit}</p>}
          {panaderia.direccion && (
            <p className="text-xs text-stone-500">{panaderia.direccion}</p>
          )}
          <p className="mt-1 text-xs text-stone-500">{formatDateTime(venta.fecha_hora)}</p>
          {anulado && (
            <p className="mt-1 text-sm font-bold uppercase text-red-600">Anulada</p>
          )}
        </header>

        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-stone-500">
              <th className="py-1">Producto</th>
              <th className="py-1 text-right">Cant.</th>
              <th className="py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {detalle.map((line, i) => (
              <tr key={i} className="border-b border-stone-100">
                <td className="py-1.5 pr-2">
                  <p className="font-medium leading-tight">{line.nombre}</p>
                  <p className="text-[11px] text-stone-400">
                    {formatCOP(line.precio)} c/u
                  </p>
                </td>
                <td className="py-1.5 text-right tabular-nums">{line.cantidad}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatCOP(line.subtotal ?? line.precio * line.cantidad)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3 space-y-1 border-t border-dashed border-stone-300 pt-3 text-sm">
          <div className="flex justify-between capitalize">
            <span className="text-stone-500">Pago</span>
            <span>{venta.medio_pago}</span>
          </div>
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>{formatCOP(venta.total)}</span>
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] text-stone-400">
          Documento interno de venta. No es factura electrónica DIAN.
          {panaderia.imprimir_ticket_venta === false
            ? ""
            : " Guarde o imprima desde el navegador (PDF)."}
        </p>
      </article>
    </div>
  );
}
