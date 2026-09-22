import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { getVigenteTerminos, hasAcceptedVigente } from "@/lib/terminos";
import { AceptarTerminosClient } from "./aceptar-terminos-client";

export default async function AceptarTerminosPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const accepted = await hasAcceptedVigente(user.id);
  if (accepted) redirect("/dashboard");

  const vigente = await getVigenteTerminos();
  if (!vigente) redirect("/dashboard");

  return (
    <AceptarTerminosClient
      vigente={{
        version: vigente.version,
        titulo: vigente.titulo,
        contenido: vigente.contenido,
      }}
    />
  );
}
