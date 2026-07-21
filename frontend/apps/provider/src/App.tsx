import { Routes, Route, NavLink } from "react-router";

// Runnable shell only: routing + layout frame. Feature screens land per the workflow docs
// (docs/workflows/) — this file is the skeleton they mount into.
const TABS = ["Jobs", "Earnings", "Account"];

function Placeholder({ name }: { name: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-6">
      <h1 className="text-xl font-semibold text-primary">{name}</h1>
      <p className="text-sm text-muted">Shell screen — feature UI lands here.</p>
    </main>
  );
}

export default function App() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between bg-surface px-4 py-3 shadow-sm">
        <span className="font-bold text-primary">SETHU-CARE</span>
      </header>
      <Routes>
        <Route path="/" element={<Placeholder name="Your jobs, earnings and availability" />} />
        {TABS.map((tab) => (
          <Route key={tab} path={"/" + tab.toLowerCase()} element={<Placeholder name={tab} />} />
        ))}
        <Route path="*" element={<Placeholder name="Not found" />} />
      </Routes>
      <nav className="flex justify-around border-t border-black/10 bg-surface py-2">
        {TABS.map((tab) => (
          <NavLink
            key={tab}
            to={"/" + tab.toLowerCase()}
            className={({ isActive }) =>
              "px-3 py-1 text-sm " + (isActive ? "font-semibold text-primary" : "text-muted")
            }
          >
            {tab}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
