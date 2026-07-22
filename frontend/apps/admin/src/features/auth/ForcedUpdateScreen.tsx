import { Download } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { AuthLayout, AUTH_FRAMES } from "../../layouts/AuthLayout";
import { APP_UPDATE_URL } from "./auth.constants";

/**
 * The blocking update wall (design BOX 82).
 *
 * No app bar, no back chevron, no close and no "Later" — the screen has exactly one exit. An
 * unsupported build of an ops console can misreport live state, which is worse than being locked
 * out of it, so the block is absolute and the layout says so by offering nothing to hunt for.
 *
 * The download glyph is secondary grey rather than brand or danger: this is a routine instruction.
 */
export function ForcedUpdateScreen() {
  const { t } = useTranslation("adminAuth");

  return (
    <AuthLayout frame={AUTH_FRAMES.centred}>
      <EmptyState
        icon={Download}
        title={t("update.title")}
        body={t("update.body")}
        actions={
          <Button
            variant="primary"
            size="primary"
            block
            className="text-body"
            onClick={() => window.location.assign(APP_UPDATE_URL)}
          >
            {t("update.action")}
          </Button>
        }
      />
    </AuthLayout>
  );
}
