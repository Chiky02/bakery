import Link from "next/link";

/** Aviso cuando no hay turno de caja abierto (bloquea cobros). */
export function TurnoCajaRequiredBanner({ abierto }: { abierto: boolean }) {
  if (abierto) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950"
    >
      <p className="font-semibold">Sin apertura de caja</p>
      <p className="mt-1 text-amber-900/90">
        No puedes registrar ventas ni cobrar mesas hasta que se abra el turno del día.
      </p>
      <Link
        href="/caja"
        className="mt-2 inline-block font-medium text-orange-800 underline underline-offset-2"
      >
        Ir a Caja para abrir turno →
      </Link>
    </div>
  );
}
