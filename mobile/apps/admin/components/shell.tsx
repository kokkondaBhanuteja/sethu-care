"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { clearSession, getSessionToken } from "@/lib/session";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/assignments", label: "Assignments" },
  { href: "/cash", label: "Cash" },
  { href: "/payments", label: "Payments" },
  { href: "/services", label: "Services" },
] as const;

function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = () => {
    clearSession();
    router.replace("/login");
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-lg border-r border-outline-variant bg-surface-container-lowest px-md py-lg">
      <div className="px-sm">
        <span className="font-heading text-headline-sm text-primary">SETHU-CARE</span>
        <p className="text-label-sm text-on-surface-variant">Operations console</p>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-md py-sm text-label-md transition ${
                active
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={signOut}
        className="rounded-md px-md py-sm text-left text-label-md text-on-surface-variant hover:bg-surface-container"
      >
        Sign out
      </button>
    </aside>
  );
}

// Authenticated shell: redirects to /login when there is no token, otherwise renders the sidebar
// and the page. The token check runs client-side (localStorage), so we hold rendering until it
// resolves to avoid a flash of the dashboard before a redirect.
export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (getSessionToken()) {
      setReady(true);
    } else {
      router.replace("/login");
    }
  }, [router]);

  if (!ready) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-2xl py-xl">{children}</main>
    </div>
  );
}
