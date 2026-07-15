// Admin shell — proves the web dashboard resolves the SAME Indigo Velvet tokens as the RN apps
// (bg-surface / text-primary / rounded-card come from the shared @sethu/tokens preset). The real
// dashboard (assignment queue, cash reconciliation, technician management) with shadcn/ui follows
// in a later phase.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-container-max flex-col items-center justify-center gap-md px-mobile-margin">
      <div className="rounded-card border border-outline-variant bg-surface-container-lowest p-md shadow-sm">
        <h1 className="font-heading text-headline-md text-primary">SETHU-CARE Admin</h1>
        <p className="mt-sm text-body-md text-on-surface-variant">
          Operations console — shared Indigo Velvet design tokens.
        </p>
      </div>
    </main>
  );
}
