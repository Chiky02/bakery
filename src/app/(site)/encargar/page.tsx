"use client";

import { Suspense } from "react";
import EncargarForm from "./encargar-form";

export default function EncargarPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-2xl px-4 py-16 text-sm text-stone-500">
          Cargando formulario...
        </main>
      }
    >
      <EncargarForm />
    </Suspense>
  );
}
