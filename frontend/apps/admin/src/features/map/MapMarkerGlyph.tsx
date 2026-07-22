import { StatusDot } from "../../components/ui/StatusDot";
import { JOB_MAP_STATES, PROVIDER_MAP_STATUSES } from "./map.types";
import type { JobMapState, ProviderMapStatus } from "./map.types";

// Shape carries meaning before colour does (BOX 24/41): providers are circles, jobs are triangles,
// so a colourblind manager can tell "who is free" from "what is running" at a glance. The one
// escalation is the only marker with a pulse ring and a glyph inside it.
//
// These are the only feature files that touch the design system's `.map-marker__*` classes; the
// classes are the artifacts' marker geometry ported verbatim and there is no primitive for them.

const JOB_STATE_CLASSES: Readonly<Record<JobMapState, string>> = {
  enRoute: "map-marker__job",
  onSite: "map-marker__job map-marker__job--success",
  delayed: "map-marker__job map-marker__job--warning",
  escalated: "map-marker__job map-marker__job--danger",
};

export interface ProviderGlyphProps {
  status: ProviderMapStatus;
  /** Announced by the marker button's own name; passed on for the legend's static swatches. */
  statusLabel: string;
}

export function ProviderGlyph({ status, statusLabel }: ProviderGlyphProps) {
  // An offline provider has no live position, so it gets the roster's hollow ring rather than a
  // filled pin: the silhouette says "last known", not "here now".
  if (status === PROVIDER_MAP_STATUSES.offline) {
    return <StatusDot tone="neutral" fill="hollow" size="lg" label={statusLabel} />;
  }

  return (
    <span
      className={
        status === PROVIDER_MAP_STATUSES.busy
          ? "map-marker__provider map-marker__provider--busy"
          : "map-marker__provider"
      }
    />
  );
}

export function JobGlyph({ state }: { state: JobMapState }) {
  if (state === JOB_MAP_STATES.escalated) {
    return (
      <>
        <span className="map-marker__pulse" />
        <span className={JOB_STATE_CLASSES.escalated} />
        <span className="absolute top-s1 text-pill text-text-on-brand" aria-hidden>
          !
        </span>
      </>
    );
  }

  return <span className={JOB_STATE_CLASSES[state]} />;
}

export function ClusterGlyph({ count }: { count: number }) {
  return (
    <span className="map-marker__cluster" aria-hidden>
      {count}
    </span>
  );
}
