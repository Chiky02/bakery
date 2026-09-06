import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { navForRole } from "@/lib/permissions";

export default async function HomePage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");

  const first = navForRole(profile.rol)[0];
  redirect(first?.href ?? "/dashboard");
}
