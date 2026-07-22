import { cx } from "../../../lib/cx";
import { PROVIDER_STATUSES, type ProviderStatus } from "../providers.types";

const PIN_TONE: Readonly<Record<ProviderStatus, string>> = {
  [PROVIDER_STATUSES.free]: "text-success",
  [PROVIDER_STATUSES.onJob]: "text-warning",
  [PROVIDER_STATUSES.offline]: "text-text-3",
  [PROVIDER_STATUSES.suspended]: "text-text-3",
  [PROVIDER_STATUSES.offboarded]: "text-text-3",
};

export interface LocationThumbProps {
  status: ProviderStatus;
  /** Names the graphic for assistive tech; the zone is already stated in the surrounding text. */
  label: string;
  /** `wide` is the desktop panel; `thumb` is the small square beside the mobile live line. */
  size?: "wide" | "thumb";
  className?: string;
}

/**
 * An abstract street grid, drawn rather than fetched: the record has to render with zero network,
 * and a real tile server would turn a provider's live position into a third-party request.
 *
 * The SVG keeps its intrinsic aspect ratio so height follows width — no fixed pixel box.
 */
export function LocationThumb({ status, label, size = "wide", className }: LocationThumbProps) {
  const isWide = size === "wide";

  return (
    <svg
      viewBox={isWide ? "0 0 244 140" : "0 0 96 80"}
      role="img"
      aria-label={label}
      className={cx(
        "h-auto overflow-hidden rounded-pill border border-border-subtle bg-surface",
        isWide ? "w-full" : "w-row-72 flex-none",
        className,
      )}
    >
      {isWide ? <WideGrid /> : <ThumbGrid />}
      <g className={PIN_TONE[status]} fill="currentColor">
        {isWide ? (
          <>
            <circle cx={124} cy={66} r={22} opacity={0.14} />
            <path d="M124 52a7 7 0 0 0-7 7c0 5 7 12 7 12s7-7 7-12a7 7 0 0 0-7-7z" />
          </>
        ) : (
          <>
            <circle cx={52} cy={38} r={11} opacity={0.16} />
            <path d="M52 30a5 5 0 0 0-5 5c0 3.5 5 8 5 8s5-4.5 5-8a5 5 0 0 0-5-5z" />
          </>
        )}
      </g>
    </svg>
  );
}

function WideGrid() {
  return (
    <>
      <g className="text-border-subtle" stroke="currentColor" strokeWidth={2} fill="none">
        <path d="M0 38h244M0 96h244M62 0v140M162 0v140" />
      </g>
      <g
        className="text-border-strong"
        stroke="currentColor"
        strokeWidth={1}
        fill="none"
        opacity={0.6}
      >
        <path d="M0 120h244M112 38v58M210 0v140" />
      </g>
    </>
  );
}

function ThumbGrid() {
  return (
    <>
      <g className="text-border-subtle" stroke="currentColor" strokeWidth={1.5} fill="none">
        <path d="M0 22h96M0 52h96M26 0v80M64 0v80" />
      </g>
      <g
        className="text-border-strong"
        stroke="currentColor"
        strokeWidth={1}
        fill="none"
        opacity={0.6}
      >
        <path d="M0 68h96M46 22v30" />
      </g>
    </>
  );
}
