import { useTranslation } from "@sethu/i18n";

import type { TabItem } from "../../../components/ui/Tabs";
import { ROSTER_SEGMENT_LABEL_KEYS, ROSTER_SEGMENT_ORDER } from "../providers.constants";
import { ROSTER_SEGMENTS, type RosterCounts, type RosterSegment } from "../providers.types";

function countFor(segment: RosterSegment, counts: RosterCounts | undefined): number {
  if (!counts) return 0;
  if (segment === ROSTER_SEGMENTS.online) return counts.online;
  if (segment === ROSTER_SEGMENTS.onJob) return counts.onJob;
  return counts.total;
}

/** Segment labels and their counts, built once so both shells show the same three numbers. */
export function useRosterSegmentItems(
  counts: RosterCounts | undefined,
): readonly TabItem<RosterSegment>[] {
  const { t } = useTranslation("adminProviders");

  return ROSTER_SEGMENT_ORDER.map((segment) => ({
    value: segment,
    label: t(ROSTER_SEGMENT_LABEL_KEYS[segment]),
    count: countFor(segment, counts),
  }));
}
