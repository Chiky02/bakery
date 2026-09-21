import { requireBakeryContext } from "@/lib/auth";
import { hasAcceptedVigente } from "@/lib/terminos";
import { BakeryProvider } from "@/lib/use-bakery-id";
import { AppShell } from "@/components/app/app-shell";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireBakeryContext();

  const accepted = await hasAcceptedVigente(ctx.profile.id);
  if (!accepted) {
    redirect("/aceptar-terminos");
  }

  const value = {
    profile: ctx.profile,
    panaderia: ctx.panaderia,
    rol: ctx.rol,
    roleLabel: ctx.roleLabel,
    permisos: ctx.permisos,
    memberships: ctx.memberships,
    plataformaAdmin: ctx.plataformaAdmin,
    isPlatformOperator: ctx.isPlatformOperator,
    impersonating: ctx.impersonating,
    impersonatingUser: ctx.impersonatingUser,
  };

  return (
    <BakeryProvider value={value}>
      <AppShell>{children}</AppShell>
    </BakeryProvider>
  );
}
