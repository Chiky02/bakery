import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/site-header";

export const metadata: Metadata = {
  title: "Chiky02",
  description: "Encarga tortas y pan en tu local favorito",
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f4ef] text-stone-900">
      <SiteHeader brand="Chiky02" />
      {children}
    </div>
  );
}
