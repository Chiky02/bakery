import { SiteHeader } from "@/components/site/site-header";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#1a120c] text-stone-100">
      <SiteHeader />
      {children}
    </div>
  );
}
