import { useTranslation } from "@sethu/i18n";

import { DOCUMENT_VALIDATIONS, type ApplicationReview } from "../applications.types";
import { ApplicantCard, ApplicationFacts } from "./ApplicantCard";
import { ApplicationDocumentList } from "./ApplicationDocumentList";
import { DesktopRecommendedCard } from "./ApplicationStateBanners";
import { SectionGap } from "../../../layouts/Layout";
import { SectionLabel } from "./SectionLabel";

export interface ApplicationReviewSectionsProps {
  review: ApplicationReview;
  /** True when any document is unvalidated — the honest "review on desktop" prompt (spec §6.18). */
  hasFailedValidation: boolean;
}

/** The scrolling body of M71–M74, in the order the design stacks it. */
export function ApplicationReviewSections({
  review,
  hasFailedValidation,
}: ApplicationReviewSectionsProps) {
  const { t } = useTranslation("adminProviders");
  const presentCount = review.documents.filter(
    (document) => document.validation !== DOCUMENT_VALIDATIONS.missing,
  ).length;

  return (
    <>
      <ApplicantCard review={review} bare />
      <SectionGap />
      <ApplicationFacts review={review} bare />

      <SectionGap />
      <div className="py-s4">
        <SectionLabel className="mb-s2 px-s4">
          {t("review.documents", {
            present: presentCount,
            required: review.documentsRequired,
          })}
        </SectionLabel>
        <ApplicationDocumentList documents={review.documents} />
      </div>

      {hasFailedValidation ? (
        <>
          <SectionGap />
          <div className="px-s4 py-s4">
            <DesktopRecommendedCard />
          </div>
        </>
      ) : null}
    </>
  );
}
