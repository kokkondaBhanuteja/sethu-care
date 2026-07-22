import { ArrowRight, BellRing, Clock, MessageCircle, TriangleAlert } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Avatar } from "../../components/ui/Avatar";
import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { formatTime } from "../../lib/format";
import type { BookingActionSubject, ProviderCandidate } from "./booking-actions.types";

export interface AssignConfirmBodyProps {
  candidate: ProviderCandidate;
  booking: BookingActionSubject;
}

/**
 * The confirm step's substance, shared by the mobile sheet and the desktop dialog (the anti-drift
 * rule, spec §2.1): the PAIRING — this technician, this customer, this area — plus the consequences
 * and the on-job warning. Restating the pairing tests something; "Are you sure?" tests nothing. If
 * the wrong row was picked, the wrong name is the first thing on this surface.
 */
export function AssignConfirmBody({ candidate, booking }: AssignConfirmBodyProps) {
  const { t } = useTranslation("adminBookingActions");

  return (
    <div className="flex flex-col gap-s3">
      <Card tone="surface" density="tight" className="flex items-center gap-s3">
        <Avatar name={candidate.name} size="lg" />
        <span className="flex-1 truncate text-emph text-text-1">{candidate.name}</span>
        <Icon glyph={ArrowRight} className="text-text-3" />
        <span className="flex-1 text-right">
          <span className="block truncate text-emph text-text-1">{booking.customerName}</span>
          <span className="block text-caption text-text-2">{booking.zone}</span>
        </span>
      </Card>

      <ul className="flex flex-col">
        <ConsequenceRow
          icon={Clock}
          label={t("assign.consequenceEta", { value: candidate.etaMinutes })}
        />
        <ConsequenceRow icon={MessageCircle} label={t("assign.consequenceCustomer")} />
        <ConsequenceRow icon={BellRing} label={t("assign.consequenceProvider")} />
      </ul>

      {/* The warning sits directly above the commit controls: a caution read on the way in is a
          caption; one read with a thumb already travelling toward the button is a decision. */}
      {candidate.availability === "onJob" && candidate.freeAtIso ? (
        <Card tone="warning" className="flex items-start gap-s2">
          <Icon glyph={TriangleAlert} className="text-warning" />
          <span className="text-label text-warning">
            {t("assign.busyWarning", {
              name: candidate.name,
              time: formatTime(candidate.freeAtIso),
            })}
          </span>
        </Card>
      ) : null}
    </div>
  );
}

function ConsequenceRow({
  icon,
  label,
}: {
  icon: React.ComponentProps<typeof Icon>["glyph"];
  label: string;
}) {
  return (
    <li className="flex h-row-40 items-center gap-s2">
      <Icon glyph={icon} className="text-text-2" />
      <span className="text-label text-text-1">{label}</span>
    </li>
  );
}
