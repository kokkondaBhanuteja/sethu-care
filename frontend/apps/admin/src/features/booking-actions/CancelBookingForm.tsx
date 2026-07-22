import { TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { TextArea } from "../../components/ui/form/TextArea";
import { ROUTES } from "../../routes/routes.constants";
import { CancelImpactCard } from "./CancelImpactCard";
import { CancelRefundCard } from "./CancelRefundCard";
import { ReasonCodeField } from "./ReasonCodeField";
import {
  CANCEL_REASON_ORDER,
  NOTE_MAX_LENGTH,
  SAFETY_REVIEW_REASONS,
  type CancelReasonCode,
} from "./booking-actions.constants";
import type { CancelContext } from "./booking-actions.types";
import type { CancelBookingState } from "./useCancelBooking";

export interface CancelBookingFormProps {
  context: CancelContext;
  state: CancelBookingState;
}

/**
 * Everything both shells render between the header and the commit button. Reasons and the money
 * decision sit side by side from `lg` up (the desktop wide modal): at 900px of viewport the stacked
 * layout put the refund/override card below the fold with no cue that it existed. Below `lg` (the
 * mobile shell) the same markup stacks.
 */
export function CancelBookingForm({ context, state }: CancelBookingFormProps) {
  const { t } = useTranslation("adminBookingActions");
  const navigate = useNavigate();
  const { form, errorFor } = state.form;
  const values = form.watch();
  const markDirty = state.markDirty;

  return (
    <div className="flex flex-col gap-s5">
      <CancelImpactCard context={context} />

      {/* Amber, not red: the impact card above already owns the red, and a second red block would
          flatten the hierarchy. Cancelling mid-visit is the one case where the cheaper action is
          almost always better, so the alternative goes in FRONT of the reason list. */}
      {context.technicianOnSite && context.booking.providerName ? (
        <Banner
          tone="warning"
          icon={TriangleAlert}
          title={t("cancel.onSiteWarning", { name: context.booking.providerName })}
          actions={
            <Button
              variant="textBrand"
              size="inline"
              onClick={() => void navigate(ROUTES.bookingDetail(context.booking.bookingId))}
            >
              {t("cancel.escalateInstead")}
            </Button>
          }
        />
      ) : null}

      <div className="grid gap-s5 lg:grid-cols-2">
        <ReasonCodeField<CancelReasonCode>
          name="cancel-reason"
          legend={t("cancel.reasonLegend")}
          tone="danger"
          value={(values.reasonCode as CancelReasonCode) || null}
          onValueChange={(code) => {
            form.setValue("reasonCode", code);
            markDirty();
          }}
          flaggedMeaning={t("cancel.safetyReviewMeaning")}
          flaggedLegend={t("cancel.safetyReviewLegend")}
          {...(errorFor("reasonCode") ? { error: t("cancel.reasonRequired") } : {})}
          options={CANCEL_REASON_ORDER.map((code) => ({
            value: code,
            label: t(`cancel.reason.${code}`),
            isFlagged: SAFETY_REVIEW_REASONS.has(code),
          }))}
        />

        <div className="flex flex-col gap-s5">
          <TextArea
            label={t("cancel.noteLabel")}
            tall
            maxLength={NOTE_MAX_LENGTH}
            valueLength={values.note.length}
            placeholder={t("cancel.notePlaceholder")}
            {...(errorFor("note") ? { error: t("cancel.noteRequiredForOther") } : {})}
            {...form.register("note", { onChange: markDirty })}
          />

          <div className="flex flex-col gap-s2">
            <p className="text-pill text-text-2">{t("cancel.refundLegend")}</p>
            <CancelRefundCard
              form={form}
              policyRefundPaise={context.policyRefundPaise}
              isPolicyRefundFull={context.isPolicyRefundFull}
              errorFor={errorFor}
              onChange={markDirty}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
