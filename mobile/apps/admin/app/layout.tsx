import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";

import { Providers } from "./providers";

// Inter on the web, exposed as a CSS variable so the shared token font families (font-heading/body/…)
// resolve to it — matching the mobile apps, which load Inter via @expo-google-fonts/inter.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "SETHU-CARE Admin",
  description: "Operations console for SETHU-CARE",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-surface font-body text-on-surface antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
