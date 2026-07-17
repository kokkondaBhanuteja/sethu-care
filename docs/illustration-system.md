# SETHU-CARE Illustration System

Art direction for all in-app illustrations, the live-tracking rider marker, and any generated
imagery. The goal is a single, consistent visual language that reads as premium and trustworthy for
a paid in-home service, and stays legible for users of every age.

## Direction: soft-3D "clay" render

We use a soft, rounded 3D ("claymorphism" / Spline) style — not flat or hand-drawn. Rationale:

- **Premium + trustworthy.** A paid service where a stranger enters the home needs to feel
  professional. Soft-3D reads as higher production value than flat vector.
- **Legible across ages.** Tangible, rounded objects (a wrench, an AC unit, a scooter) are instantly
  recognisable — abstract flat art is not.
- **The rider marker needs 3D.** A small 3/4-view vehicle on the live map matches Uber/Rapido; a
  flat icon looks out of place on real map tiles.

If we ever want a warmer, lighter feel, the fallback direction is flat hand-drawn (Storyset-style) —
but do not mix the two.

## Style lock (paste as the preamble to EVERY generation)

> Soft 3D clay-render illustration, rounded edges, matte surfaces, single soft top-left studio
> light, gentle contact shadow, isometric 3/4 view, **transparent background**, brand palette blue
> #1D4ED8 as the dominant color and teal #0D9488 as accent, with warm neutral accents, friendly and
> approachable, no text, no hard reflections, consistent 512×512 framing, subject centered with padding.

Only the subject line changes per asset. Keep everything else identical so the set stays coherent.

## Asset slots

| Registry name (`Illustration.tsx`) | Filename | Subject prompt |
|---|---|---|
| `welcome` | `welcome.png` | a friendly home-service technician with a toolbox |
| `emptyBookings` | `empty-bookings.png` | an empty calendar with a small plant |
| `emptyJobs` | `empty-jobs.png` | a parked delivery scooter, resting |
| `noResults` | `no-results.png` | a magnifying glass over a house |
| `paymentSuccess` | `payment-success.png` | a rupee coin dropping into a wallet with a check mark |
| `jobComplete` | `job-complete.png` | a sparkling clean house with a check badge |

Live-tracking **rider marker** (not in the registry — used by the map): "top-down / slight-3⁄4 view
teal delivery scooter, tiny, centered." Export at 3× for crispness on the map.

## Delivery + integration

1. Generate each subject with the style lock, export a **transparent PNG**.
2. Export at 512×512 (@1x) plus `name@2x.png` and `name@3x.png` for retina.
3. Drop the files in `mobile/packages/ui/assets/illustrations/`.
4. Uncomment the matching line in `ASSETS` in
   `mobile/packages/ui/src/components/Illustration.tsx`.
5. Use it: `<Illustration name="emptyBookings" size={180} />`. Until an asset is registered, a soft
   brand icon stands in automatically, so screens can reference illustrations before the art lands.

Rendering goes through `expo-image` (cached, fades in). Keep individual PNGs under ~150 KB — run them
through an optimiser (e.g. `pngquant`) before committing.
