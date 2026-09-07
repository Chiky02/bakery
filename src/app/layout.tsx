import type { Metadata } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import { LightModeLock } from "@/components/light-mode-lock";
import "./globals.css";

const display = DM_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Panel",
  description: "Gestión de panadería — ventas, mesas, encargos y recepciones",
};

const forceLightScript = `(function(){var r=document.documentElement;r.classList.remove("dark");r.style.colorScheme="light";try{localStorage.removeItem("bakerychiky-theme");localStorage.removeItem("app-theme");}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${geistMono.variable} h-full light`}
      style={{ colorScheme: "light" }}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: forceLightScript }} />
      </head>
      <body className="min-h-full bg-[#f7f4ef] text-stone-900 antialiased">
        <LightModeLock>{children}</LightModeLock>
      </body>
    </html>
  );
}
