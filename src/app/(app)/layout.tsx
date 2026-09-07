import { requireBakeryContext } from "@/lib/auth";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireBakeryContext();
  return (
    <AppShell
      profile={ctx.profile}
      panaderia={ctx.panaderia}
      rol={ctx.rol}
      roleLabel={ctx.roleLabel}
      permisos={ctx.permisos}
      memberships={ctx.memberships}
    >
      {children}
    </AppShell>
  );
}
