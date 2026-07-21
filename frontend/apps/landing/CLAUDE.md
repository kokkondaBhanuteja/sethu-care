# apps/landing

Scope: The public marketing site — Next.js static export. No app logic, no auth, no API calls beyond (future) public content.
Purpose: Sell SETHU-CARE (landing.gallery/Uber-calibre bar): GSAP ScrollTrigger storytelling + Lenis smooth scroll + react-three-fiber 3D hero.
Contents: app/layout.tsx (metadata + globals), app/page.tsx (thin — renders Hero), app/globals.css (@theme tokens, dark canvas), components/Hero.tsx (the working animation-stack proof: Lenis instance, pinned scrub section, R3F torus placeholder), next.config.ts (output:'export').
Business logic: none — presentation only.
Dependencies: next, gsap/@gsap/react, lenis, three/@react-three/fiber/@react-three/drei, @sethu/tokens.
Boundaries: framework exception (Next.js) but every non-structural rule of ENGINEERING-STANDARDS.md applies — tokens only, no hardcoded visual values, reduced-motion honoured, every mounted animation torn down (Hero is the template). No imports from the SPA apps.
Impacted modules: the public website; SEO surface.
