import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Avatar } from "../../../components/ui/Avatar";
import { Card } from "../../../components/ui/Card";
import { Icon } from "../../../components/ui/Icon";
import { Pill } from "../../../components/ui/Pill";
import { formatDate, formatPhone } from "../../../lib/format";
import type { ApplicationReview } from "../applications.types";
import { SectionLabel } from "./SectionLabel";

export interface ApplicantCardProps {
  review: ApplicationReview;
  bare?: boolean;
}

/** Who is applying: the identity block both review surfaces lead with. */
export function ApplicantCard({ review, bare = false }: ApplicantCardProps) {
  const { t } = useTranslation("adminProviders");

  const body = (
    <div className="flex items-start gap-s4">
      <Avatar name={review.applicantName} size={bare ? "record" : "profile"} brand />
      <div className="grow min-w-0">
        <p className="text-title text-text-1">{review.applicantName}</p>
        <p className="mt-s1 font-mono text-body text-text-2">{formatPhone(review.phone)}</p>
        <p className="text-label text-text-2">{review.email}</p>
        <p className="mt-s1 text-label text-text-1">{review.address}</p>
        <p className="mt-s1 text-caption text-text-3">
          {t("applications.appliedOn", { date: formatDate(review.appliedAt) })}
        </p>
      </div>
    </div>
  );

  return bare ? <div className="px-s4 py-s4">{body}</div> : <Card>{body}</Card>;
}

export interface ApplicationFactsProps {
  review: ApplicationReview;
  bare?: boolean;
}

/** Categories with claimed experience, the background-check verdict, and prior applications. */
export function ApplicationFacts({ review, bare = false }: ApplicationFactsProps) {
  const { t } = useTranslation("adminProviders");

  const body = (
    <>
      <SectionLabel>{t("review.categories")}</SectionLabel>
      <div className="mt-s3 flex flex-wrap gap-s2">
        {review.categories.map((category) => (
          <Pill key={category.name} tone="info">
            {t("review.categoryClaim", { name: category.name, count: category.yearsClaimed })}
          </Pill>
        ))}
      </div>

      <hr className="my-s4 border-border-subtle" />

      <SectionLabel>{t("review.backgroundCheck")}</SectionLabel>
      <p className="mt-s2 flex items-center gap-s2 text-label text-text-1">
        {review.backgroundClearedAt ? (
          <>
            <Icon glyph={CheckCircle2} className="text-success" />
            {t("review.backgroundClearedShort", { date: formatDate(review.backgroundClearedAt) })}
          </>
        ) : (
          t("review.backgroundPending")
        )}
      </p>

      <hr className="my-s4 border-border-subtle" />

      <SectionLabel>{t("review.priorApplications")}</SectionLabel>
      <p className="mt-s2 text-label text-text-3">
        {review.priorApplications === 0 ? t("review.priorNone") : review.priorApplications}
      </p>
    </>
  );

  return bare ? <div className="px-s4 py-s4">{body}</div> : <Card>{body}</Card>;
}
