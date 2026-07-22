import { MapPin, MessageCircle, Phone } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { formatDateShort, formatMoney, formatPhone, formatTime } from "../../lib/format";
import { MonoText, RecordSection } from "./RecordText";
import type { BookingCustomer, BookingPayment, BookingProvider } from "./bookings.types";

export interface CustomerBlockProps {
  customer: BookingCustomer;
  /** Contacting a party is a write path: it is logged to the timeline, so it greys out with the rest. */
  isDisabled?: boolean;
}

export function CustomerBlock({ customer, isDisabled = false }: CustomerBlockProps) {
  const { t } = useTranslation("adminBookings");

  return (
    <RecordSection label={t("section.customer")}>
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
    </RecordSection>
  );
}

export interface ProviderBlockProps {
  provider: BookingProvider | null;
  roundCount: number;
  declinedTotal: number;
  /** Rendered under the block — the rescue "Assign provider" button, when the state permits one. */
  action?: React.ReactNode;
}

/** Avatars are drawn initials, never fetched imagery: these screens must render with zero network. */
export function ProviderBlock({ provider, roundCount, declinedTotal, action }: ProviderBlockProps) {
  const { t } = useTranslation("adminBookings");

  return (
    <RecordSection label={t("section.provider")}>
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
        <>
          <p className="text-emph text-danger">{t("detail.notAssigned")}</p>
          <p className="text-label text-text-2 mt-s1">
            {t("detail.dispatchSummary", { rounds: roundCount, declined: declinedTotal })}
          </p>
        </>
      )}
      {action ? <div className="mt-s3">{action}</div> : null}
    </RecordSection>
  );
}

export interface PaymentBlockProps {
  payment: BookingPayment;
}

export function PaymentBlock({ payment }: PaymentBlockProps) {
  const { t } = useTranslation("adminBookings");

  return (
    <RecordSection label={t("section.payment")}>
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
    </RecordSection>
  );
}
