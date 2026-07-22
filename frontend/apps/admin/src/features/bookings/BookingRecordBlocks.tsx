import { MapPin, MessageCircle, Phone } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { formatDateShort, formatMoney, formatPhone, formatTime } from "../../lib/format";
import { MonoText } from "./RecordText";
import type { BookingCustomer, BookingPayment, BookingProvider } from "./bookings.types";

// Content-only blocks: each renders INSIDE a BookingSectionCard, whose icon-chip header carries
// the section title — so no block repeats a heading of its own.

export interface CustomerBlockProps {
  customer: BookingCustomer;
  /** Contacting a party is a write path: it is logged to the timeline, so it greys out with the rest. */
  isDisabled?: boolean;
}

export function CustomerBlock({ customer, isDisabled = false }: CustomerBlockProps) {
  const { t } = useTranslation("adminBookings");

  return (
    <div>
      <div className="flex items-start justify-between gap-s2">
        <p className="text-emph text-text-1 break-words">{customer.name}</p>
        <div className="flex items-center gap-s1">
          <Button
            variant="text"
            size="inline"
            iconStart={Phone}
            disabled={isDisabled}
            aria-label={t("actions.callParty", { name: customer.name })}
          />
          <Button
            variant="text"
            size="inline"
            iconStart={MessageCircle}
            disabled={isDisabled}
            aria-label={t("actions.messageParty", { name: customer.name })}
          />
        </div>
      </div>

      <MonoText className="text-text-2">{formatPhone(customer.phone)}</MonoText>

      <div className="flex items-start justify-between gap-s2 mt-s2">
        <p className="text-label text-text-2 break-words">{customer.address}</p>
        <Button
          variant="text"
          size="inline"
          iconStart={MapPin}
          disabled={isDisabled}
          aria-label={t("detail.viewOnMap")}
        />
      </div>

      <p className="text-caption text-text-3 mt-s2">
        {t("detail.customerHistory", {
          count: customer.bookingCount,
          joined: formatDateShort(customer.joinedAt),
        })}
      </p>
    </div>
  );
}

export interface ProviderBlockProps {
  provider: BookingProvider | null;
  /** Rendered under the block — the rescue "Assign provider" button, when the state permits one. */
  action?: React.ReactNode;
}

/**
 * Avatars are drawn initials, never fetched imagery: these screens must render with zero network.
 *
 * An unassigned provider card says only "Not assigned" — the rounds-and-declines diagnostic
 * belongs to the escalation banner and the timeline, and repeating it a third time here taught
 * the eye to skip all three (screen audit).
 */
export function ProviderBlock({ provider, action }: ProviderBlockProps) {
  const { t } = useTranslation("adminBookings");

  return (
    <div>
      {provider ? (
        <div className="flex items-start gap-s3">
          <Avatar name={provider.name} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-emph text-text-1 break-words">{provider.name}</p>
            <p className="text-label text-text-2">
              {t("detail.providerRating", { rating: provider.rating.toFixed(1) })}
            </p>
            {provider.startedAt ? (
              <p className="text-label text-text-2">
                {t("detail.providerStarted", { time: formatTime(provider.startedAt) })}
              </p>
            ) : null}
            {provider.completedAt ? (
              <p className="text-label text-text-2">
                {t("detail.providerCompleted", { time: formatTime(provider.completedAt) })}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-emph text-danger">{t("detail.notAssigned")}</p>
      )}
      {action ? <div className="mt-s3">{action}</div> : null}
    </div>
  );
}

export interface PaymentBlockProps {
  payment: BookingPayment;
}

export function PaymentBlock({ payment }: PaymentBlockProps) {
  const { t } = useTranslation("adminBookings");

  return (
    <div>
      <p className="text-body text-text-1 break-words">
        {t("detail.paymentLine", {
          amount: formatMoney(payment.amountPaise),
          method: payment.methodLabel,
          last4: payment.last4,
        })}
      </p>
      <MonoText className="text-text-3">
        {t("detail.paymentMeta", {
          time: formatTime(payment.paidAt),
          transactionId: payment.transactionId,
        })}
      </MonoText>
    </div>
  );
}
