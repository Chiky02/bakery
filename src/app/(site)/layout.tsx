import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";
import { getPrimaryPublicBakery, primaryBrandName } from "@/lib/public-bakery";

export async function generateMetadata(): Promise<Metadata> {
  const primary = await getPrimaryPublicBakery();
  const brand = primaryBrandName(primary);
  return {
    title: brand,
    description: `${brand} — encargos y panadería`,
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const primary = await getPrimaryPublicBakery();
  const brand = primaryBrandName(primary);

  return (
    <div className="min-h-screen bg-[#f7f4ef] text-stone-900">
      <SiteHeader brand={brand} />
      {children}
    </div>
  );
}
