# packages/ui-web (@sethu/ui-web)

Scope: The global shadcn-style web component library — the ONLY place UI primitives live for the
customer/provider/admin apps (landing shares tokens only). Source-owned components (shadcn model),
Radix underneath where interaction demands it, Storybook as the living catalog.
Purpose: One premium ERP design language (approved Figma refs: soft canvas, white rounded-card
surfaces, icon chips, tinted status pills, airy tables, lucide icons) shipped once, reused by every
app. Closes the standards' "shared UI package" seam.
Contents: `src/styles/tokens.css` (GENERATED from `@sethu/tokens` — `pnpm --filter @sethu/tokens
run generate:css`; never hand-edit), `src/lib/cn.ts` (clsx + tailwind-merge), `src/components/*`
(component + `*.stories.tsx` + `*.test.tsx` triplets), `src/index.ts` (barrel), `.storybook/`.

## The component contract (every component, no exceptions)

1. **Highly configurable — built to be moulded.** Every component exposes:
   - **CVA variant axes** (`tone`, `variant`, `size`, `look`…) with the variant map **exported**
     (`buttonVariants` etc.) so consumers can extend/compose without forking;
   - **`className` merged via `cn()` on the root**, and `*ClassName` props (or sub-components) for
     inner nodes a consumer may need to reach;
   - **ReactNode slots** for composition points (`icon`, `actions`, `children`) — never baked-in
     markup a consumer can't replace;
   - **native prop passthrough** (`...props` to the underlying element, `ref` as a prop — React 19);
   - **compound sub-components** for anatomy (`Card`/`CardHeader`/`CardContent`/`CardFooter`)
     instead of boolean-flag monoliths.
2. **Tokens only.** Tailwind utilities backed by `tokens.css` — `bg-canvas · bg-surface · bg-inset ·
   text-ink/muted/faint · border-border · bg-{success,warning,danger,info,neutral}-{bg} ·
   text-*-fg · border-*-border · bg-tint-{amber,green,purple,blue}-bg · bg-accent-{green,red,blue,
   purple,amber,teal} · text-link · rounded-{sm,md,lg,card} · shadow-{card,lifted,overlay} ·
   text-kpi/kpi-sm/table-head · ring-ring`. **No raw hex, no arbitrary-value brackets** for
   anything a token covers; a missing token is added to `@sethu/tokens` src/web.ts + regenerated.
3. **Responsive, mobile-first.** Base styles are the mobile layout; `sm:`/`md:`/`lg:` scale up.
   Wide content (tables) wraps in `overflow-x-auto`; touch targets ≥44px on interactive elements.
4. **Accessible (WCAG 2.2 AA).** Radix for interaction patterns (menus, dialogs, selects);
   `focus-visible:ring-2 ring-ring`; status never colour-alone; decorative visuals `aria-hidden`.
5. **Icons: lucide-react only**, sized via the component (`[&_svg]:size-4`).
6. **Triplet or it doesn't exist:** component + story (every variant on canvas, `autodocs`) +
   test (behaviour + a11y contract), added to `src/index.ts`, in the same change.
7. `.tsx` ≤ 150 lines; exemplars to copy: `Button`, `Card`, `StatusPill`, `IconChip`.

Dependencies: radix primitives, CVA, clsx, tailwind-merge, lucide-react; react/react-dom peers.
Boundaries: no app imports (this package is upstream of apps); no `@sethu/i18n` (components take
text via props — apps localize); no data fetching; no raw visual values.
Impacted modules: every web app's entire surface; Storybook is the review artifact for changes.
