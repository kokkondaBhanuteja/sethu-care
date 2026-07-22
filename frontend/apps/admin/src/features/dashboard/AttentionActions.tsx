import { Phone } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button, type ButtonVariant } from "../../components/ui/Button";
import { PRIORITY_PRESENTATION } from "./dashboard.constants";
import { ATTENTION_ACTIONS, type AttentionAction, type AttentionItem } from "./dashboard.types";
import type { AttentionPermissions } from "./useNeedsAttention";
import {
  ATTENTION_ACTION_LABEL_KEYS,
  ATTENTION_ACTION_PERMISSION,
  useAttentionActionRunner,
} from "./useAttentionActionRunner";

export interface AttentionActionsProps {
  item: AttentionItem;
  permissions: AttentionPermissions;
  /** Offline: the buttons stay visible and disabled with a stated reason (spec §4.10). */
  isBlocked: boolean;
  onAcknowledge: () => void;
  /** Mobile promotes Acknowledge to the filled button; the desktop table keeps both outline. */
  emphasiseAcknowledge?: boolean;
}

/**
 * The two inline buttons a queue row offers on the full feed and the mobile cards. The reason
 * decides which two, not the booking state — the reason column is the diagnosis, and it is what
 * decides which button the manager reaches for. The dashboard panel's narrower rows use
 * `AttentionCompactActions` (one primary + overflow) over the same runner.
 */
export function AttentionActions({
  item,
  permissions,
  isBlocked,
  onAcknowledge,
  emphasiseAcknowledge = false,
}: AttentionActionsProps) {
  const { t } = useTranslation("adminDashboard");
  const run = useAttentionActionRunner({ item, onAcknowledge });

  return (
    <div className="flex gap-s2">
      {PRIORITY_PRESENTATION[item.priority].actions.map((action) => {
        const label = t(ATTENTION_ACTION_LABEL_KEYS[action]);
        const disabled = isBlocked || !permissions[ATTENTION_ACTION_PERMISSION[action]];
        const reason = isBlocked ? t("actions.offlineReason") : t("actions.noPermission");

        return (
          <Button
            key={action}
            size="inline"
            variant={variantFor(action, emphasiseAcknowledge)}
            disabled={disabled}
            title={disabled ? reason : undefined}
            aria-label={disabled ? `${label} — ${reason}` : undefined}
            iconStart={action === ATTENTION_ACTIONS.call ? Phone : undefined}
            onClick={() => run(action)}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}

function variantFor(action: AttentionAction, emphasise: boolean): ButtonVariant {
  if (!emphasise) return "outline";
  if (action === ATTENTION_ACTIONS.acknowledge) return "primary";
  if (action === ATTENTION_ACTIONS.cancel) return "outlineDanger";
  return "outline";
}
