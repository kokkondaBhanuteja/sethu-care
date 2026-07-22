import { useState } from "react";
import { useTranslation } from "@sethu/i18n";

import type { TabItem } from "../../../components/ui/Tabs";
import { APPLICATION_SEGMENT_LABEL_KEYS, APPLICATION_SEGMENT_ORDER } from "../providers.constants";
import { useApplicationQueueQuery } from "../queries/applications.queries";
import { APPLICATION_SEGMENTS } from "../applications.types";
import type { ApplicationCounts, ApplicationSegment } from "../applications.types";

function countFor(segment: ApplicationSegment, counts: ApplicationCounts | undefined): number {
  if (!counts) return 0;
  if (segment === APPLICATION_SEGMENTS.pending) return counts.pending;
  if (segment === APPLICATION_SEGMENTS.awaitingDocs) return counts.awaitingDocs;
  return counts.decided;
}

/**
 * Segment state and counts for both application queues.
 *
 * `includeDecided` is the one surface difference: the desktop table keeps decided rows under the
 * live ones because they answer "did we already look at this person?" without a second screen
 * (BOX 43); the phone list does not have the room.
 */
export function useApplicationsQueue(includeDecided: boolean) {
  const { t } = useTranslation("adminProviders");
  const [segment, setSegment] = useState<ApplicationSegment>(APPLICATION_SEGMENTS.pending);
  const query = useApplicationQueueQuery(segment, includeDecided);

  const segmentItems: readonly TabItem<ApplicationSegment>[] = APPLICATION_SEGMENT_ORDER.map(
    (value) => ({
      value,
      label: t(APPLICATION_SEGMENT_LABEL_KEYS[value]),
      count: countFor(value, query.data?.counts),
    }),
  );

  return { segment, setSegment, query, segmentItems };
}
