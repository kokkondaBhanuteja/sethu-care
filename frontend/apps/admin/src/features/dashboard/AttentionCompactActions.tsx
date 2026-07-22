import { MoreHorizontal, Phone } from "lucide-react";
import { useTranslation } from "@sethu/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@sethu/ui-web";

import { Button } from "../../components/ui/Button";
import { PRIORITY_PRESENTATION } from "./dashboard.constants";
import { ATTENTION_ACTIONS, type AttentionAction, type AttentionItem } from "./dashboard.types";
import type { AttentionPermissions } from "./useNeedsAttention";
import {
  ATTENTION_ACTION_LABEL_KEYS,
  ATTENTION_ACTION_PERMISSION,
  useAttentionActionRunner,
} from "./useAttentionActionRunner";

export interface AttentionCompactActionsProps {
  item: AttentionItem;
  permissions: AttentionPermissions;
  /** Offline: the controls stay visible and disabled with a stated reason (spec §4.10). */
  isBlocked: boolean;
  onAcknowledge: () => void;
}

/**
 * The dashboard panel's action cell: the row's PRIMARY rescue as the one visible button
 * (Acknowledge for an escalation, Assign where nobody is assigned — the first action of the
 * priority's pair) and the rest behind an overflow menu. Two text buttons per row is what made
 * the compact table wider than its card and clipped this very column (UX audit, 1440 and 1024).
 */
export function AttentionCompactActions({
  item,
  permissions,
  isBlocked,
  onAcknowledge,
}: AttentionCompactActionsProps) {
  const { t } = useTranslation("adminDashboard");
  const run = useAttentionActionRunner({ item, onAcknowledge });

  const [primaryAction, ...overflowActions] = PRIORITY_PRESENTATION[item.priority].actions;
  const isDisabled = (action: AttentionAction) =>
    isBlocked || !permissions[ATTENTION_ACTION_PERMISSION[action]];
  const disabledReason = isBlocked ? t("actions.offlineReason") : t("actions.noPermission");
  const primaryLabel = t(ATTENTION_ACTION_LABEL_KEYS[primaryAction]);

  return (
    <>
      <Button
        size="inline"
        variant="outline"
        disabled={isDisabled(primaryAction)}
        title={isDisabled(primaryAction) ? disabledReason : undefined}
        aria-label={isDisabled(primaryAction) ? `${primaryLabel} — ${disabledReason}` : undefined}
        iconStart={primaryAction === ATTENTION_ACTIONS.call ? Phone : undefined}
        onClick={() => run(primaryAction)}
      >
        {primaryLabel}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="inline"
            variant="outline"
            iconStart={MoreHorizontal}
            aria-label={t("actions.rowActions", { booking: item.bookingRef })}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {overflowActions.map((action) => (
            <DropdownMenuItem
              key={action}
              tone={action === ATTENTION_ACTIONS.cancel ? "destructive" : "default"}
              disabled={isDisabled(action)}
              onSelect={() => run(action)}
            >
              {t(ATTENTION_ACTION_LABEL_KEYS[action])}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
