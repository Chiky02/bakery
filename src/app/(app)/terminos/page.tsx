import { requireFeature } from "@/lib/auth";
import { TerminosAdminClient } from "./terminos-admin-client";

export default async function TerminosAdminPage() {
  await requireFeature("terminos");
  return <TerminosAdminClient />;
}
