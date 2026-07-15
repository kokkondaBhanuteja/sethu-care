import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SETHU-CARE Admin",
  description: "Operations console for SETHU-CARE",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-on-background antialiased">{children}</body>
    </html>
  );
}
