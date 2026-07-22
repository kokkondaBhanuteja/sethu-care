// Abstract Hyderabad for the 390-wide screen, traced from BOX 41. City blocks are the inset grey
// and the roads are the white canvas — one step of contrast, which is all the base map is allowed
// if a 12px marker is to win the eye.
//
// Stroke widths are SVG geometry rather than CSS lengths: they scale with the viewBox.

const ARTERIAL_STROKE = 13;
const SIDE_STREET_STROKE = 6;
const CASING_STROKE = 0.75;

export function MapGridMobile() {
  return (
    <svg
      className="map__svg"
      viewBox="0 0 390 844"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="390" height="844" className="fill-inset" />

      {/* Open ground and parks — the only non-grey on the base map. */}
      <g className="fill-bg-success">
        <rect x="18" y="146" width="60" height="46" rx="6" />
        <rect x="272" y="398" width="96" height="72" rx="8" />
        <rect x="104" y="470" width="82" height="44" rx="6" />
      </g>

      <g className="fill-none stroke-canvas" strokeWidth={ARTERIAL_STROKE} strokeLinecap="round">
        <path d="M-10 120 H400" />
        <path d="M-10 380 H400" />
        <path d="M-10 632 H400" />
        <path d="M90 -10 V854" />
        <path d="M250 -10 V854" />
        <path d="M-10 706 L400 236" />
      </g>

      <g className="fill-none stroke-canvas" strokeWidth={SIDE_STREET_STROKE} strokeLinecap="round">
        <path d="M-10 58 H400" />
        <path d="M-10 196 H400" />
        <path d="M-10 300 H400" />
        <path d="M-10 462 H400" />
        <path d="M-10 548 H400" />
        <path d="M-10 772 H400" />
        <path d="M38 -10 V854" />
        <path d="M160 -10 V854" />
        <path d="M200 -10 V854" />
        <path d="M320 -10 V854" />
        <path d="M360 -10 V854" />
      </g>

      {/* A hair-thin casing so the arterials read as roads rather than gaps between blocks. */}
      <g className="fill-none stroke-border-subtle" strokeWidth={CASING_STROKE}>
        <path d="M-10 113.5 H400 M-10 126.5 H400" />
        <path d="M-10 373.5 H400 M-10 386.5 H400" />
        <path d="M-10 625.5 H400 M-10 638.5 H400" />
        <path d="M83.5 -10 V854 M96.5 -10 V854" />
        <path d="M243.5 -10 V854 M256.5 -10 V854" />
      </g>
    </svg>
  );
}
