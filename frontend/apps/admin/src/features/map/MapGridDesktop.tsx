// Abstract Hyderabad for the 1440-wide canvas, traced from BOX 24: arterials, a street grid, three
// green patches and a river band. Drawn rather than fetched, so the page needs no network and
// nothing on the base map can out-shout a marker — a real tile layer's own reds, greens and yellows
// would make the one escalation impossible to find.
//
// Stroke widths are SVG geometry, not CSS lengths: they scale with the viewBox, so they are numbers
// here rather than spacing tokens. Every colour is a token-backed Tailwind utility.

const GRID_STROKE = 4;
const ARTERIAL_STROKE = 11;
const CASING_STROKE = 1;

export function MapGridDesktop() {
  return (
    <svg
      className="map__svg"
      viewBox="0 0 880 844"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="0" y="0" width="880" height="844" className="fill-inset" />

      <g className="fill-bg-success">
        <rect x="474" y="596" width="150" height="104" rx="18" />
        <rect x="196" y="214" width="104" height="82" rx="16" />
        <rect x="700" y="120" width="120" height="70" rx="16" />
      </g>

      <path
        className="fill-bg-info"
        d="M0 700 C 140 664, 250 742, 392 706 S 640 630, 880 664 L 880 704 C 640 672, 520 748, 392 746 S 140 706, 0 740 Z"
      />

      <g className="fill-none stroke-canvas" strokeWidth={GRID_STROKE}>
        <path d="M62 0V844M244 0V844M322 0V844M402 0V844M482 0V844M562 0V844M642 0V844M722 0V844M802 0V844" />
        <path d="M0 78H880M0 262H880M0 340H880M0 420H880M0 500H880M0 620H880M0 700H880M0 782H880" />
      </g>

      <g className="fill-none stroke-canvas" strokeWidth={ARTERIAL_STROKE} strokeLinecap="round">
        <path d="M0 182 C 210 158, 372 246, 556 202 S 806 148, 880 194" />
        <path d="M126 0 C 150 220, 132 420, 168 844" />
        <path d="M0 548 C 240 520, 520 588, 880 540" />
        <path d="M60 844 L 684 0" />
      </g>

      {/* Block casings, so the grid is not perfectly regular. */}
      <g className="fill-none stroke-border-subtle" strokeWidth={CASING_STROKE}>
        <rect x="322" y="340" width="160" height="160" />
        <rect x="562" y="262" width="160" height="158" />
        <rect x="62" y="420" width="182" height="128" />
      </g>
    </svg>
  );
}
