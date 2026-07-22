import { CardList } from "../../components/ui/Card";
import type { AttentionItem } from "./dashboard.types";
import { AttentionCard } from "./AttentionCard";
import type { AttentionPermissions } from "./useNeedsAttention";
import type { AcknowledgeController } from "./useAcknowledgeAlert";

export interface NeedsAttentionCardsProps {
  /**
   * The window of rows to draw. Kept as a plain array prop — with no internal fetching, scroll
   * ownership or measurement — so a windowing library can wrap this component unchanged if the
   * queue ever grows past the point where every row should be in the DOM (spec §2.4).
   */
  items: readonly AttentionItem[];
  permissions: AttentionPermissions;
  isBlocked: boolean;
  acknowledgement: AcknowledgeController;
}

/**
 * Mobile's rendering of the queue: stacked cards, never a squeezed table. The desktop table exists
 * because an operator scans the AGE and PROVIDER columns down the page; at 390px there are no
 * columns to scan, so each record states its own diagnosis in full instead.
 */
export function NeedsAttentionCards({
  items,
  permissions,
  isBlocked,
  acknowledgement,
}: NeedsAttentionCardsProps) {
  return (
    <CardList gap="roomy">
      {items.map((item) => (
        <AttentionCard
          key={item.alertId}
          item={item}
          permissions={permissions}
          isBlocked={isBlocked}
          isResolving={acknowledgement.resolvingIds.has(item.alertId)}
          onAcknowledge={() =>
            acknowledgement.acknowledge({ alertId: item.alertId, bookingRef: item.bookingRef })
          }
        />
      ))}
    </CardList>
  );
}
