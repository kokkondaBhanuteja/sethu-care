import { Flag, IndianRupee } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Card, CardList } from "../../../components/ui/Card";
import { Icon } from "../../../components/ui/Icon";
import { formatDateShort, formatMoney } from "../../../lib/format";
import { METRIC_BANDS, type ProviderFeedback, type ProviderMetric } from "../providers.types";
import { RatingValue } from "./Rating";
import { SectionLabel } from "./SectionLabel";

export interface ProviderFeedbackCardProps {
  feedback: readonly ProviderFeedback[];
  bare?: boolean;
}

/**
 * Lowest rated first, on purpose: a 4.8 average hides the two reviews that explain why this
 * profile was opened at all.
 */
export function ProviderFeedbackCard({ feedback, bare = false }: ProviderFeedbackCardProps) {
  const { t } = useTranslation("adminProviders");

  const body = (
    <>
      <SectionLabel className="mb-s3">{t("profile.feedback")}</SectionLabel>
      <CardList>
        {feedback.map((entry) => (
          <Card key={entry.id} density="tight">
            <RatingValue value={entry.rating} tight tone="danger" className="text-caption" />
            <p className="mt-s1 text-label text-text-1">{entry.comment}</p>
            <p className="mt-s1 text-caption text-text-3">
              {t("profile.feedbackAuthor", {
                author: entry.author,
                date: formatDateShort(entry.at),
              })}
            </p>
          </Card>
        ))}
      </CardList>
    </>
  );

  return bare ? <div className="px-s4 py-s4">{body}</div> : <Card>{body}</Card>;
}

export interface ProviderFlagsCardProps {
  flags: readonly string[];
  metrics: readonly ProviderMetric[];
}

/**
 * One flags card, never two. When performance is poor the amber card is promoted to danger and
 * absorbs the verdict line — a red "below threshold" card above a separate amber "Flags" card
 * would make the reader work out which one is the real one (BOX 41).
 */
export function ProviderFlagsCard({ flags, metrics }: ProviderFlagsCardProps) {
  const { t } = useTranslation("adminProviders");
  const failing = metrics.filter((metric) => metric.band === METRIC_BANDS.poor).length;
  const isPoor = failing > 0;

  if (flags.length === 0 && !isPoor) return null;

  return (
    <Card tone={isPoor ? "danger" : "warning"} edge={isPoor ? "danger" : "none"}>
      <div className="mb-s2 flex items-center gap-s2">
        <Icon glyph={Flag} size="sm" className={isPoor ? "text-danger" : "text-warning"} />
        <SectionLabel tone={isPoor ? "danger" : "warning"}>{t("profile.flags")}</SectionLabel>
      </div>
      {isPoor ? (
        <p className="text-emph text-danger">
          {t("profile.flagsBelowThreshold", { failing, total: metrics.length })}
        </p>
      ) : null}
      {flags.map((flag) => (
        <p key={flag} className="mt-s2 text-label text-text-1">
          {flag}
        </p>
      ))}
    </Card>
  );
}

/** Read-only. Payouts settle in desktop finance; this states the number and nothing else. */
export function ProviderPayoutsCard({ amountPaise }: { amountPaise: number }) {
  const { t } = useTranslation("adminProviders");

  return (
    <Card tone="surface">
      <div className="mb-s3 flex items-center gap-s2">
        <Icon glyph={IndianRupee} size="sm" className="text-text-2" />
        <SectionLabel>{t("profile.payouts")}</SectionLabel>
      </div>
      <p className="text-label text-text-2">{t("profile.payoutsCycle")}</p>
      <p className="mt-s1 text-section tabular-nums text-text-1">{formatMoney(amountPaise)}</p>
      <p className="mt-s2 text-caption text-text-3">{t("profile.payoutsNote")}</p>
    </Card>
  );
}
