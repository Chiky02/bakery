import { requireFeature } from "@/lib/auth";
import { ProduccionClient } from "./produccion-client";

export default async function ProduccionPage() {
  await requireFeature("produccion");
  return <ProduccionClient />;
}
