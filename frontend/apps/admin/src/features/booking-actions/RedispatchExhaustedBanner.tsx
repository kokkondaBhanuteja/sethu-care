import { TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { ROUTES } from "../../routes/routes.constants";

export interface RedispatchExhaustedBannerProps {
  bookingId: string;
}

/**
 * After three failed cycles the automation is no longer the likely answer, so the weight moves to
 * the manual-assignment link and the primary button is DEMOTED rather than disabled — a disabled
 * button would force the operator to guess why, an outlined one says "you can, but read this first".
 *
 * It sits between the header and the scroll region so it cannot be scrolled away from the button it
 * is qualifying.
 */
export function RedispatchExhaustedBanner({ bookingId }: RedispatchExhaustedBannerProps) {
  const { t } = useTranslation("adminBookingActions");
  const navigate = useNavigate();

  return (
    <Banner
      tone="danger"
      icon={TriangleAlert}
      title={t("redispatch.exhaustedTitle")}
      actions={
        <Button
          variant="textBrand"
          size="inline"
          onClick={() => void navigate(ROUTES.bookingAssign(bookingId))}
        >
          {t("redispatch.assignManuallyInstead")}
        </Button>
      }
    />
  );
}
