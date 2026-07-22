import { IndianRupee } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Card } from "../../../components/ui/Card";
import { Icon } from "../../../components/ui/Icon";

/**
 * The impact notice leads with income, not policy: "This stops their income" is the fact an ops
 * manager needs at the top of a suspend flow, before any of the mechanics.
 */
export function SuspendImpactCard() {
  const { t } = useTranslation("adminProviders");

  return (
    <Card tone="danger" edge="danger">
      <div className="flex items-start gap-s2">
        <Icon glyph={IndianRupee} className="text-danger" />
        <div className="grow">
          <p className="text-emph text-danger">{t("suspend.impactTitle")}</p>
          <p className="mt-s1 text-label text-text-1">{t("suspend.impactDetail")}</p>
        </div>
      </div>
    </Card>
  );
}
