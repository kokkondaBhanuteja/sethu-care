# SETHU-CARE Rich Image Prompts (craft format)

For the Swiggy / Urban-Company-level rich UI: image-forward category tiles, service cards, and promo
banners. These are **realistic product/service photographs** (not the clay illustrations in
`illustration-prompts.md`, which stay for empty/success states). Generate with GPT-image / DALL·E,
export as described, and drop into `mobile/apps/customer/assets/img/…`.

---

## House style (the consistency lock)

Every image shares ONE look so the grid feels like a single brand. Keep this block **identical** in
every prompt; only change the **Subject** line.

> **Medium:** high-resolution professional product photograph, e-commerce / app-catalog quality.
> **Lighting:** bright, soft, even studio softbox lighting; gentle soft shadow; no harsh highlights.
> **Background:** clean seamless solid background in soft blue **#DBEAFE** (category tiles) — no props,
> no clutter, no gradient.
> **Color:** true-to-life colors, cool/neutral white balance, brand-friendly (blues/teals welcome).
> **Composition:** single hero subject, centered, generous padding, shot slightly from a 3/4 angle.
> **Finish:** crisp focus, high detail, realistic materials, subtle reflection on the floor.
> **Strict:** NO text, NO logos, NO watermarks, NO people's faces, NO brand marks. Square 1:1.

For **hero / promo** images swap the background line to a **real, tidy modern Indian home interior,
softly blurred** and the ratio to **16:9**.

### Consistency workflow
Generate `ac-repair` first as the style anchor. Then, in the **same** ChatGPT image chat, say *"same
lighting, background #DBEAFE, angle and finish as the previous image"* and paste only the next Subject.

---

## Set A — Category tiles  (square 1:1, 512×512, soft-blue background)

Filenames → `assets/img/categories/<name>.png`. Used in the "What needs fixing?" grid + circles.

| name | Subject line (append to house style) |
|---|---|
| `ac-repair` | a modern white split-AC indoor unit, wall-mounted, front panel slightly open showing clean filters |
| `refrigerator` | a sleek stainless-steel double-door refrigerator, doors closed, one door slightly ajar with soft interior light |
| `washing-machine` | a modern white front-load washing machine, round chrome door, control panel lit |
| `plumbing` | a set of chrome plumbing fittings — a faucet, a pipe bend and a wrench — arranged neatly |
| `electrical` | a modern white electrical switchboard with a few switches and a socket, plus a screwdriver |
| `ceiling-fan` | a contemporary 3-blade ceiling fan in brushed metal, seen at a 3/4 angle |
| `tv-install` | a slim wall-mounted flat-screen TV (screen off, dark), with a small mounting bracket beside it |
| `gas-stove` | a modern 3-burner black glass-top gas stove, clean, one burner with a small blue flame |
| `water-purifier` | a modern white wall-mounted RO water purifier with a clear water glass in front |
| `handyman` | a tidy set of home tools — drill, hammer, measuring tape and screwdriver — arranged in a fan |

## Set B — Service hero cards  (16:9, 1280×720, blurred home interior background)

Filenames → `assets/img/services/<name>.png`. The wide image at the top of each service card / detail.

| name | Subject line (append to house style, 16:9, home-interior background) |
|---|---|
| `ac-service` | a freshly serviced split-AC indoor unit on a clean living-room wall, a faint water-spray mist, tools resting on a drop cloth below |
| `electrical` | a tidy modern electrical panel on a wall with a multimeter and neat wiring, warm room light |
| `plumbing` | a spotless modern bathroom sink with polished chrome tap and visible clean piping beneath |
| `cleaning` | a sparkling clean modern kitchen counter, sunlight, a spray bottle and microfiber cloth |

## Set C — Promo banners  (16:9, 1280×720 — solid blue #1D4ED8 background, room for a headline)

Filenames → `assets/img/promo/<name>.png`. Leave the **left third empty** (flat blue) for overlaid text.

| name | Subject line |
|---|---|
| `monsoon-ac` | right side: a clean split-AC unit with light water droplets; left two-thirds: flat solid blue #1D4ED8 empty space for text; no text in image |
| `first-booking` | right side: a friendly toolbox with a few tools; left: flat solid blue empty space; no text |

---

## Export & integrate

1. Export **transparent-free** PNG/JPG at the sizes above (add `@2x`/`@3x` for retina if easy).
2. Put them under `mobile/apps/customer/assets/img/{categories,services,promo}/`.
3. I wire them into the new `CategoryTile`, `ServiceCard`, and `PromoBanner` components (each has a
   graceful colored-placeholder fallback, so the app looks right even before the art lands).
4. Keep each file < ~200 KB (run through an optimiser / pngquant / squoosh).
