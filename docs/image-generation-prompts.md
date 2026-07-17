# SETHU-CARE — Image Generation (ready-to-paste)

Practical companion to **`DESIGN-SYSTEM -FOR PROMPTS.MD`** (the full Clay Studio™ spec). This is the
"just copy and generate" doc. Everything is **soft-3D clay**, solid blue–teal palette, transparent
PNG — one unified library across the whole app.

## How to generate (ChatGPT Go works)

1. Open **one** new ChatGPT chat — generate the whole set here so the style stays locked.
2. Paste the **Anchor prompt** below and generate **`welcome`** first. Approve it → this is your
   **Golden Master**. Download it.
3. For every next image: type *"Same style, camera, lighting, materials and colors as before — only
   the subject changes. SUBJECT: …"*, **attach the Golden Master** as a reference, and paste the next
   subject line.
4. Export each as a **transparent PNG**, 1024×1024 (or 512×512). If a background comes back white, say
   *"make the background fully transparent."*
5. Save with the **exact filename** into the folder listed, then send them to me — I wire them in.
6. **ChatGPT Go note:** image generation is included but has a lower daily cap than Plus. If you hit
   it, the saved images are fine — continue the next day **in the same chat** so the style holds.

---

## Anchor prompt (paste once, generates `welcome`)

```
Create a premium 3D illustration for the SETHU-CARE Clay Studio Design Language.

STYLE: premium soft 3D claymorphism, matte polymer clay, rounded industrial product-illustration, soft sculpted forms, high-end product render. NOT flat, NOT painterly, NOT anime/comic, NOT photorealistic, NOT low-poly, NOT vector.

MATERIAL: every object is the same premium matte polymer clay — smooth, soft, rounded, clean, broad matte highlights, soft edge transitions. No chrome, metal, glass shine, or surface imperfections.

GEOMETRY: rounded, chunky, thick, simplified, friendly, recognizable from silhouette. No thin parts, no sharp corners, no tiny details.

CAMERA: isometric 3/4 view, ~30° horizontal rotation, ~20° downward tilt, product-showcase angle, minimal perspective distortion.

LIGHTING: soft studio — large soft key light upper-left, gentle front fill, soft ambient bounce, one soft contact shadow directly beneath. No rim light, no colored light, no hard/dramatic shadows.

COMPOSITION: square 1:1, transparent background (alpha), subject centered at ~65% of the canvas with equal padding, no environment/floor/walls/scenery.

COLORS: primary Royal Blue #1D4ED8 dominates; secondary Teal #0D9488 supports; accent Soft Blue #93C5FD highlights; warm cream/beige neutrals. Blue–teal domain only, solid colors, no gradients.

SUBJECT: a friendly home-service technician in a blue SETHU-CARE uniform, smiling warmly, holding a compact rounded toolbox in one hand and waving with the other; rounded proportions, relaxed stance, centered.

NEGATIVE: no text, numbers, logos, watermarks, UI, scenery, floors, furniture, extra people, photorealism, motion blur, depth of field, lens flare, metallic reflections, glass glare, heavy gradients, anime, comic, flat vector, low-poly.

Only the subject changes between illustrations; keep everything else identical so it integrates into the SETHU-CARE illustration library.
```

For each following image keep that block and swap only the **SUBJECT** line (using the reference-image
trick in step 3).

---

## Set 1 — Service / category clay objects
Square 1:1, transparent. One image per service, used in **both** the "What needs fixing?" tile and the
service card. Save to **`mobile/apps/customer/assets/img/services/<name>.png`**.

| filename | SUBJECT line |
|---|---|
| `ac-repair.png` | a modern split-AC indoor unit as a rounded chunky clay object, wall-unit shape, soft rounded corners, front flap slightly open, blue body with soft-blue accents |
| `electrical.png` | a rounded clay electrical switchboard with two chunky switches and one socket, blue body, soft rounded edges |
| `plumbing.png` | a rounded matte-clay water tap and a short bent pipe joined together, chunky soft forms, blue with teal accent (no chrome, no shine) |
| `refrigerator.png` | a rounded clay double-door refrigerator, chunky body, soft handles, blue with cream accents |
| `washing-machine.png` | a rounded clay front-load washing machine, big round door, chunky body, blue with soft-blue accents |
| `ceiling-fan.png` | a rounded clay 3-blade ceiling fan, thick soft blades, chunky centre motor, blue |
| `tv-install.png` | a rounded clay flat-screen TV (screen off, soft matte), with a small chunky wall bracket beside it, blue |
| `gas-stove.png` | a rounded clay 3-burner stove-top, chunky knobs, soft rounded burners, blue with teal accent |
| `water-purifier.png` | a rounded clay wall-mounted water purifier with a small clay water glass in front, blue with soft-blue accents |
| `handyman.png` | a rounded clay toolbox, lid slightly open, a chunky hammer and screwdriver resting beside it, blue with cream accents |

## Set 2 — Illustrations (empty / success / onboarding)
Square 1:1, transparent. Save to **`mobile/packages/ui/assets/illustrations/<name>.png`**.

| filename | SUBJECT line |
|---|---|
| `welcome.png` | *(the anchor prompt above)* a friendly technician in a blue uniform holding a toolbox and waving |
| `empty-bookings.png` | a clean upright clay wall calendar with blank pages beside a small rounded clay pot with a green plant; calm "nothing scheduled yet" |
| `empty-jobs.png` | a compact clay service scooter parked with kickstand down, rounded mirrors, thick wheels, cream seat, blue body; quiet "no jobs" mood |
| `no-results.png` | a large rounded clay magnifying glass with a thick blue frame hovering over a small rounded clay house; "nothing found" |
| `payment-success.png` | a rounded clay wallet opening as a gold rupee coin drops in, with a teal circular check-mark badge floating above and a few soft sparkles |
| `job-complete.png` | a clean rounded clay house with soft sparkle accents and a teal circular check-mark badge floating in front; "work done" |
| `rider-marker.png` | **CAMERA OVERRIDE: top-down bird's-eye view** — a compact clay service scooter with a helmeted rider seen from directly above, bold simplified silhouette readable at 48px |

---

Once the files are in those folders, tell me the names and I'll register them
(`features/catalog/images.ts` for services, `Illustration.tsx` for illustrations) — the placeholders
become your clay art instantly.
