import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SETHU-CARE — Reliable home services, on demand",
  description:
    "Book trusted technicians for AC, electrical, plumbing and more — assigned automatically in under a minute.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
