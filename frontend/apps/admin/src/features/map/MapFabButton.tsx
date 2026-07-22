import type { LucideIcon } from "lucide-react";

import { Icon } from "../../components/ui/Icon";

export interface MapFabButtonProps {
  glyph: LucideIcon;
  /** Icon-only, so the accessible name has to come from here. */
  label: string;
  onClick: () => void;
}

/**
 * A round control floating over the map (BOX 41). Mobile has no room for a docked panel, so the
 * header controls sit on the canvas instead of pushing it down — the map is the screen.
 */
export function MapFabButton({ glyph, label, onClick }: MapFabButtonProps) {
  return (
    <button type="button" className="map-fab" aria-label={label} onClick={onClick}>
      <Icon glyph={glyph} size="lg" />
    </button>
  );
}
