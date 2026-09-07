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
  title: "Dulce Bonanza",
  description: "Panadería artesanal — tortas a pedido y pan de cada día",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${display.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground antialiased">
        <LightModeLock>{children}</LightModeLock>
      </body>
    </html>
  );
}
