import { requireBakeryContext } from "@/lib/auth";
import { BakeryProvider } from "@/lib/use-bakery-id";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireBakeryContext();
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
  };

  return (
    <BakeryProvider value={value}>
      <AppShell>{children}</AppShell>
    </BakeryProvider>
  );
}
