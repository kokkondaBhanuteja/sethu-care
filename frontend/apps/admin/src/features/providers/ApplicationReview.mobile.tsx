import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Button } from "../../components/ui/Button";
import { SkeletonList } from "../../components/ui/Skeleton";
import { NotFoundState } from "../../components/ui/states/NotFoundState";
import { MobileAppBar } from "../../layouts/MobileAppBar";
import { cx } from "../../lib/cx";
import { ActionBar } from "../../layouts/ActionBar";
import { ApplicationAgePill } from "./components/ApplicationAge";
import { ApplicationReviewSections } from "./components/ApplicationReviewSections.mobile";
import {
  ApplicationDecidedBanner,
  ApproveBlockedBanner,
} from "./components/ApplicationStateBanners";
import { MobileScroll } from "../../layouts/PageMain";
import { RejectApplicationDialog } from "./components/RejectApplicationDialog";
import { StepUpChallenge } from "../../components/ui/StepUpChallenge";
import { useApplicationReview } from "./hooks/useApplicationReview";

/**
 * M71–M74. Thumbnails and verdicts; the judgement itself is honestly pushed to desktop. An
 * already-decided application is a record: dimmed, every action gone, and the decision attributed
 * by name and timestamp — an informational banner, never an error.
 */
export function ApplicationReviewMobile() {
  const { t } = useTranslation("adminProviders");
  const screen = useApplicationReview();
  const review = screen.review;
  const blocker = screen.blockers[0];

  return (
    <>
      <MobileAppBar
        title={t("review.title")}
        showBack
        compact
        bordered
        actions={
          review && review.daysWaiting !== null && !screen.isDecided ? (
            <ApplicationAgePill days={review.daysWaiting} />
          ) : null
        }
      />

      {review?.decision ? <ApplicationDecidedBanner decision={review.decision} /> : null}

      <MobileScroll className={cx(screen.isDecided && "opacity-70")}>
        <QueryBoundary
          query={screen.query}
          isEmpty={(loaded) => loaded === null}
          empty={<NotFoundState subject={t("review.notFound")} />}
          skeleton={
            <SkeletonList rows={5} rowClassName="h-row-72" label={t("review.loadingLabel")} />
          }
        >
          {(loaded) =>
            loaded === null ? null : (
              <ApplicationReviewSections
                review={loaded}
                hasFailedValidation={screen.hasFailedValidation}
              />
            )
          }
        </QueryBoundary>
        <div aria-hidden className="h-s4" />
      </MobileScroll>

      {blocker && !screen.isDecided ? <ApproveBlockedBanner blocker={blocker} /> : null}

      {review && !screen.isDecided ? (
        <>
          <ActionBar>
            <div className="flex gap-s2">
              <Button
                variant="success"
                size="primary"
                block
                disabled={!screen.canApproveNow}
                isLoading={screen.decisions.isApproving}
                onClick={screen.decisions.approve}
              >
                {t("review.approve")}
              </Button>
              <Button
                variant="outline"
                size="primary"
                block
                disabled={!screen.decisions.canRequestDocuments}
                isLoading={screen.decisions.isRequestingDocuments}
                onClick={screen.decisions.requestDocuments}
              >
                {t("review.requestDocumentsShort")}
              </Button>
              <Button
                variant="outlineDanger"
                size="primary"
                block
                disabled={!screen.decisions.canReject}
                onClick={screen.openReject}
              >
                {t("review.reject")}
              </Button>
            </div>
          </ActionBar>

          <RejectApplicationDialog
            isOpen={screen.isRejecting}
            review={review}
            isSubmitting={screen.decisions.isRejecting}
            requiresStepUp={screen.decisions.rejectPolicy.requiresStepUp}
            onCancel={screen.closeReject}
            onSubmit={(input) => void screen.submitRejection(input)}
          />
        </>
      ) : null}

      <StepUpChallenge stepUp={screen.decisions.rejectStepUp} />
    </>
  );
}
