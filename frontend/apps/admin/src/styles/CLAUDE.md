# apps/admin/src/styles

Scope: The component layer of the design system — CSS only. No TypeScript, no React.

Purpose: Reproduce the approved SetuCare Admin designs exactly. `components.css` is ported verbatim from the two design artifacts (desktop 1440×900, mobile 390×844); `fonts.css` is generated (Inter + JetBrains Mono, self-hosted in `public/fonts`).

Contents: `components.css` (all BEM component classes, inside `@layer components`), `fonts.css` (GENERATED — do not hand-edit).

Business logic: none.

Dependencies: the tokens in `../index.css`. Every declaration resolves against a token; no raw colour, size, radius or spacing value appears here.

Boundaries: **only `components/ui/*` and `layouts/*` may use these class names.** Feature and page code composes those primitives plus Tailwind's token-backed utilities. Do not add a class here to style one screen — add a variant prop to the primitive instead.

Four sections carry additions the static artifacts could not express, each banner-commented: MOTION (spinner, skeleton shimmer, undo drain), RESPONSIVE HARDENING (ceilings and reflow points between the two artboard widths), TOOLTIP, and choice-control focus forwarding. Everything else is the artifact source, unchanged apart from two documented edits that turn fixed artboards into a real viewport (`.app`, `.screen`).

Impacted modules: every screen in the console.
