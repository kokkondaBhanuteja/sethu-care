import { CircleCheckBig, Clock, IndianRupee, Lock, MessageSquare, ShieldCheck, TriangleAlert, Waves } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Card } from "../../components/ui/Card";
import { Icon } from "../../components/ui/Icon";
import { Pill } from "../../components/ui/Pill";
import type { ManualCompletionContext } from "./booking-actions.types";

export interface ManualCompletionConfirmStepProps {
  context: ManualCompletionContext;
}

/** Three or more manual completions for the same provider in 7 days is a pattern, not a coincidence. */
const PATTERN_THRESHOLD = 3;

/**
 * Step 4. Five things that WILL happen, not a restatement of what was entered — by this step the
 * operator knows what they typed; what they need before the commit is the blast radius.
 */
export function ManualCompletionConfirmStep({ context }: ManualCompletionConfirmStepProps) {
  const { t } = useTranslation("adminBookingActions");
  const isFlagged = context.providerCompletionsInSevenDays >= PATTERN_THRESHOLD;

  const consequences = [
    { id: "state", glyph: CircleCheckBig, tone: "text-success", text: t("manual.willClose") },
    {
      id: "customer",
      glyph: MessageSquare,
      tone: "text-text-2",
      text: t("manual.willNotify", { name: context.booking.customerName }),
    },
    { id: "dispute", glyph: Clock, tone: "text-text-2", text: t("manual.willOpenDispute") },
    {
      id: "payout",
      glyph: IndianRupee,
      tone: "text-text-2",
      text: t("manual.willReleasePayout", { name: context.providerName }),
    },
    { id: "audit", glyph: Lock, tone: "text-text-2", text: t("manual.willRecord") },
  ];

  return (
    <div className="flex flex-col gap-s4">
      <h2 className="text-section text-text-1">{t("manual.confirmTitle")}</h2>

      <Card tone="surface">
        <ul className="flex flex-col gap-s3">
          {consequences.map((consequence) => (
            <li key={consequence.id} className="flex items-center gap-s2">
              <Icon glyph={consequence.glyph} className={consequence.tone} />
              <span className="text-label text-text-1">{consequence.text}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* The exact badge the booking will wear. It reads as a success, but the hatch marks it as a
          human override rather than a clean OTP completion — an auditor sees the difference. */}
      <div>
        <p className="mb-s2 text-caption text-text-3">{t("manual.willShow")}</p>
        <Pill tone="success" icon={ShieldCheck} striped>
          {t("manual.adminVerifiedPill")}
        </Pill>
      </div>

      <Card tone={isFlagged ? "danger" : "warning"} density="tight">
        <div className="flex items-start gap-s2">
          <Icon
            glyph={isFlagged ? TriangleAlert : Waves}
            size="sm"
            className={isFlagged ? "text-danger" : "text-warning"}
          />
          <span className={isFlagged ? "text-label text-danger" : "text-caption text-warning"}>
            {isFlagged
              ? t("manual.providerFlagged", {
                  name: context.providerName,
                  count: context.providerCompletionsInSevenDays,
                })
              : t("manual.frequencyNotice", { count: context.adminCompletionsThisWeek })}
          </span>
        </div>
      </Card>
    </div>
  );
}
