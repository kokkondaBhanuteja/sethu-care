import { Routes, Route, NavLink } from "react-router";

// Responsive single-app shell per Admin-Mobile-App.md §2.1: below 768px the MobileShell
// (bottom tab bar, stack-style content) renders; at ≥768px the DesktopShell (persistent
// sidebar) renders. Both are deliberate separate frames — mobile is never a squeezed desktop.
// Routes carry a `surface` flag so desktopOnly destinations can show the "Best on desktop"
// notice on phones (spec §6.34) once real screens land.

const MOBILE_TABS = ["Live", "Bookings", "Providers", "Alerts", "More"] as const;
const DESKTOP_NAV = [
  "Live",
  "Bookings",
  "Providers",
  "Alerts",
  "Customers",
  "Analytics",
  "Audit",
] as const;

function Placeholder({ name }: { name: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-6">
      <h1 className="text-xl font-semibold text-primary">{name}</h1>
      <p className="text-sm text-muted">Ops shell screen — spec §6 UI lands here.</p>
    </main>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder name="Live dashboard" />} />
      {[...DESKTOP_NAV].map((item) => (
        <Route key={item} path={"/" + item.toLowerCase()} element={<Placeholder name={item} />} />
      ))}
      <Route path="*" element={<Placeholder name="Not found" />} />
    </Routes>
  );
}

function MobileShell() {
  return (
    <div className="flex h-full flex-col md:hidden">
      <header className="bg-surface px-4 py-3 shadow-sm">
        <span className="font-bold text-primary">SETHU-CARE Ops</span>
      </header>
      <AppRoutes />
      <nav className="flex justify-around border-t border-black/10 bg-surface py-2">
        {MOBILE_TABS.map((tab) => (
          <NavLink
            key={tab}
            to={tab === "Live" ? "/" : "/" + tab.toLowerCase()}
            className={({ isActive }) =>
              "px-2 py-1 text-xs " + (isActive ? "font-semibold text-primary" : "text-muted")
            }
            end={tab === "Live"}
          >
            {tab}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function DesktopShell() {
  return (
    <div className="hidden h-full md:flex">
      <aside className="flex w-56 flex-col gap-1 border-r border-black/10 bg-surface p-4">
        <span className="mb-4 font-bold text-primary">SETHU-CARE Admin</span>
        {DESKTOP_NAV.map((item) => (
          <NavLink
            key={item}
            to={item === "Live" ? "/" : "/" + item.toLowerCase()}
            className={({ isActive }) =>
              "rounded-md px-3 py-2 text-sm " +
              (isActive
                ? "bg-primary/10 font-semibold text-primary"
                : "text-muted hover:bg-black/5")
            }
            end={item === "Live"}
          >
            {item}
          </NavLink>
        ))}
      </aside>
      <div className="flex flex-1 flex-col">
        <AppRoutes />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <div className="h-full">
      <MobileShell />
      <DesktopShell />
    </div>
  );
}
