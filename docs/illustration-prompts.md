# SETHU-CARE Illustration Prompts

Copy-paste prompts for generating the app's illustration set (GPT / DALL·E / gpt-image). Each prompt
is self-contained — it includes the full style lock plus its subject — so you can paste them one at a
time. Art direction and integration steps live in [`illustration-system.md`](./illustration-system.md).

## How to keep the set consistent

1. Generate **`welcome`** first, in a single ChatGPT image chat.
2. For every following image, stay in the **same chat** and say:
   _"Same exact clay-render style, lighting, and palette as the previous image"_, then paste only the
   new **Subject** line. This locks the set together far better than starting fresh chats.
3. Export each as a **transparent PNG**, 512×512 (add `@2x` / `@3x` if easy).
4. Save into `mobile/packages/ui/assets/illustrations/` with the exact filename listed, then uncomment
   its line in `mobile/packages/ui/src/components/Illustration.tsx`.

The shared **style lock** (already embedded in every prompt below):

> Soft 3D clay-render illustration, smooth rounded matte surfaces, gentle claymorphism, single soft
> top-left studio light with a soft contact shadow, isometric 3/4 view, friendly and approachable,
> brand palette teal #0F766E and blue #1D4ED8 as dominant colors with warm cream/beige accents, no
> text, no logos, no hard reflections, transparent background (PNG with alpha), square 1:1, subject
> centered with generous padding, product-render quality.

---

## 1 · `welcome.png` — auth / onboarding

```
Soft 3D clay-render illustration, smooth rounded matte surfaces, gentle claymorphism, single soft top-left studio light with a soft contact shadow, isometric 3/4 view, friendly and approachable, brand palette teal #0F766E and blue #1D4ED8 as dominant colors with warm cream/beige accents, no text, no logos, no hard reflections, transparent background (PNG with alpha), square 1:1, subject centered with generous padding, product-render quality. Subject: a friendly home-service technician character in a teal uniform and cap, holding a toolbox in one hand and giving a small welcoming wave with the other, rounded approachable proportions.
```

## 2 · `empty-bookings.png` — customer, no bookings yet

```
Soft 3D clay-render illustration, smooth rounded matte surfaces, gentle claymorphism, single soft top-left studio light with a soft contact shadow, isometric 3/4 view, friendly and approachable, brand palette teal #0F766E and blue #1D4ED8 as dominant colors with warm cream/beige accents, no text, no logos, no hard reflections, transparent background (PNG with alpha), square 1:1, subject centered with generous padding, product-render quality. Subject: a single upright wall calendar with blank pages next to a small potted green plant, calm and tidy, conveying "nothing scheduled yet".
```

## 3 · `empty-jobs.png` — provider, no jobs assigned

```
Soft 3D clay-render illustration, smooth rounded matte surfaces, gentle claymorphism, single soft top-left studio light with a soft contact shadow, isometric 3/4 view, friendly and approachable, brand palette teal #0F766E and blue #1D4ED8 as dominant colors with warm cream/beige accents, no text, no logos, no hard reflections, transparent background (PNG with alpha), square 1:1, subject centered with generous padding, product-render quality. Subject: a parked teal delivery scooter at rest with its kickstand down, slightly angled 3/4 view, quiet idle mood, conveying "no jobs right now".
```

## 4 · `no-results.png` — empty search

```
Soft 3D clay-render illustration, smooth rounded matte surfaces, gentle claymorphism, single soft top-left studio light with a soft contact shadow, isometric 3/4 view, friendly and approachable, brand palette teal #0F766E and blue #1D4ED8 as dominant colors with warm cream/beige accents, no text, no logos, no hard reflections, transparent background (PNG with alpha), square 1:1, subject centered with generous padding, product-render quality. Subject: a large magnifying glass with a teal rim hovering over a small rounded house, lens tilted as if searching, conveying "nothing found".
```

## 5 · `payment-success.png`

```
Soft 3D clay-render illustration, smooth rounded matte surfaces, gentle claymorphism, single soft top-left studio light with a soft contact shadow, isometric 3/4 view, friendly and approachable, brand palette teal #0F766E and blue #1D4ED8 as dominant colors with warm cream/beige accents, no text, no logos, no hard reflections, transparent background (PNG with alpha), square 1:1, subject centered with generous padding, product-render quality. Subject: an open rounded wallet with a gold Indian rupee coin dropping into it and a small teal circular check-mark badge floating above, celebratory but clean, conveying "payment received".
```

## 6 · `job-complete.png`

```
Soft 3D clay-render illustration, smooth rounded matte surfaces, gentle claymorphism, single soft top-left studio light with a soft contact shadow, isometric 3/4 view, friendly and approachable, brand palette teal #0F766E and blue #1D4ED8 as dominant colors with warm cream/beige accents, no text, no logos, no hard reflections, transparent background (PNG with alpha), square 1:1, subject centered with generous padding, product-render quality. Subject: a small clean rounded house with a few sparkle accents around it and a teal circular check-mark badge in front, conveying "work done, all clean".
```

## 7 · Rider map marker — live tracking

Not part of the `Illustration` registry — used by the map. **Note the different top-down framing** and
the small-size readability requirement.

```
Soft 3D clay-render illustration, smooth rounded matte surfaces, gentle claymorphism, soft even lighting with a soft shadow directly beneath, TOP-DOWN bird's-eye view, brand palette teal #0F766E, no text, no logos, transparent background (PNG with alpha), square 1:1, VERY SMALL subject centered with large empty padding around it, clean bold silhouette that stays readable when scaled down to 48px. Subject: a single teal delivery scooter with a helmeted rider seen from directly above, designed as a compact map pin.
```

Suggested filename: `rider-marker.png` (export at 3× — e.g. 144×144 — for crispness on the map).
