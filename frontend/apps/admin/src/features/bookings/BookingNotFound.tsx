import { FileX2 } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { ROUTES } from "../../routes/routes.constants";

/**
 * A dead booking id. Keeps no chrome at all — no app bar, no action bar: there is nothing here to
 * act on, and an empty frame around an empty state only invites the operator to keep hunting.
 *
 * The copy commits to a cause ("merged or removed") rather than "something went wrong", because an
 * ops manager reaching a dead id needs to know whether to search for a merge target or stop looking.
 */
export function BookingNotFound() {
  const { t } = useTranslation("adminBookings");
  const navigate = useNavigate();

  return (
    <EmptyState
      icon={FileX2}
      title={t("notFound.title")}
      body={t("notFound.body")}
      grow
      actions={
        <Button
          variant="outline"
          size="secondary"
          block
          onClick={() => void navigate(ROUTES.bookings)}
        >
          {t("actions.backToBookings")}
        </Button>
      }
    />
  );
}
