import { BellOff, Lock } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { Icon } from "../../components/ui/Icon";
import { ROUTES } from "../../routes/routes.constants";

export interface AlertMuteControlProps {
  canMute: boolean;
}

/**
 * Mute is present but visibly inert on a critical alert, and the caveat sits UNDER the button rather
 * than behind a toast after the click: showing the ceiling before the attempt respects the manager
 * more than letting her discover it (spec §6.21).
 *
 * Muting itself belongs to notification settings (§6.30), so this navigates rather than acting.
 */
export function AlertMuteControl({ canMute }: AlertMuteControlProps) {
  const { t } = useTranslation("adminAlerts");
  const navigate = useNavigate();

  return (
    <div>
      <Button
        variant="outlineMuted"
        size="inline"
        iconStart={BellOff}
        disabled={!canMute}
        onClick={() => void navigate(ROUTES.notificationSettings)}
      >
        {t("actions.mute")}
      </Button>
      {canMute ? null : (
        <p className="mt-s2 mb-0 flex items-center gap-s2 text-caption text-text-3">
          <Icon glyph={Lock} size="sm" />
          {t("mute.blocked")}
        </p>
      )}
    </div>
  );
}
