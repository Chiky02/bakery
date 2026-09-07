import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";
import { bakeryDisplayName } from "@/lib/brand";
import { getPublicBakery } from "@/lib/public-bakery";

export async function generateMetadata(): Promise<Metadata> {
  const panaderia = await getPublicBakery();
  const brand = bakeryDisplayName(panaderia);
  return {
    title: brand,
    description: `${brand} — tortas a pedido y pan de cada día`,
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const panaderia = await getPublicBakery();
  const brand = bakeryDisplayName(panaderia);

  return (
    <div className="min-h-screen bg-[#f7f4ef] text-stone-900">
      <SiteHeader brand={brand} />
      {children}
    </div>
  );
}
