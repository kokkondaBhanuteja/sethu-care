import { useTranslation } from "@sethu/i18n";

import { QueryBoundary } from "../../components/states/QueryBoundary";
import { Button } from "../../components/ui/Button";
import { SkeletonList } from "../../components/ui/Skeleton";
import { NotFoundState } from "../../components/ui/states/NotFoundState";
import { Topbar } from "../../layouts/Topbar";
import { ROUTES } from "../../routes/routes.constants";
import { ApplicantCard, ApplicationFacts } from "./components/ApplicantCard";
import { ApplicationAgePill } from "./components/ApplicationAge";
import {
  ApplicationDecidedBanner,
  ApproveBlockedBanner,
} from "./components/ApplicationStateBanners";
import { AutoValidationPanel } from "./components/AutoValidationPanel";
import { DocumentFilmstrip } from "./components/DocumentFilmstrip.desktop";
import { DocumentViewer } from "./components/DocumentViewer.desktop";
import { PageMain } from "../../layouts/PageMain";
import { RejectApplicationDialog } from "./components/RejectApplicationDialog";
import { ReviewerNotesCard } from "./components/ReviewerNotesCard";
import { StepUpChallenge } from "../../components/ui/StepUpChallenge";
import { useApplicationReview } from "./hooks/useApplicationReview";

/**
 * BOX 45–47. The right 60% is a real viewer — filmstrip, full-height preview, and the
 * auto-validation verdict directly beneath the page it was computed from.
 */
export function ApplicationReviewDesktop() {
  const { t } = useTranslation("adminProviders");
  const screen = useApplicationReview();
  const review = screen.review;
  const blocker = screen.blockers[0];

  return (
    <>
      <Topbar
        crumbs={[
          { label: t("profile.breadcrumb"), to: ROUTES.providers },
          { label: t("applications.breadcrumb"), to: ROUTES.applications },
          { label: review?.applicantName ?? screen.applicationId },
        ]}
        actions={
          review?.daysWaiting !== null && review?.daysWaiting !== undefined ? (
            <ApplicationAgePill days={review.daysWaiting} />
          ) : null
        }
      />

      {review?.decision ? <ApplicationDecidedBanner decision={review.decision} /> : null}

      <QueryBoundary
        query={screen.query}
        isEmpty={(loaded) => loaded === null}
        empty={<NotFoundState subject={t("review.notFound")} />}
        skeleton={
          <PageMain>
            <SkeletonList rows={6} rowClassName="h-row-72" label={t("review.loadingLabel")} />
          </PageMain>
        }
      >
        {(loaded) =>
          loaded === null ? null : (
            <PageMain>
              <div className="grid grid-cols-1 gap-s3 lg:grid-cols-5">
                <div className="flex flex-col gap-s3 lg:col-span-2">
                  <ApplicantCard review={loaded} />
                  <ApplicationFacts review={loaded} />
                  <ReviewerNotesCard />
                </div>

                <div className="flex flex-col gap-s3 lg:col-span-3">
                  {screen.selectedDocument ? (
                    <>
                      <DocumentFilmstrip
                        documents={screen.documents}
                        selectedId={screen.selectedDocument.id}
                        onSelect={screen.selectDocument}
                      />
                      <DocumentViewer document={screen.selectedDocument} />
                    </>
                  ) : null}
                  <AutoValidationPanel checks={loaded.autoValidation} />
                </div>
              </div>
            </PageMain>
          )
        }
      </QueryBoundary>

      {review && !screen.isDecided ? (
        <>
          {blocker ? <ApproveBlockedBanner blocker={blocker} /> : null}
          {/* Secondary actions lead, the decisive pair sits last, Approve outermost — the same
              order as the mobile bar. "Put on hold" returns only once a real mutation backs it. */}
          <div className="flex flex-none flex-wrap items-center justify-end gap-2 border-t border-border bg-surface px-6 py-3">
            <Button
              variant="outline"
              disabled={!screen.decisions.canRequestDocuments}
              isLoading={screen.decisions.isRequestingDocuments}
              onClick={screen.decisions.requestDocuments}
            >
              {t("review.requestDocuments")}
            </Button>
            <Button
              variant="outlineDanger"
              disabled={!screen.decisions.canReject}
              onClick={screen.openReject}
            >
              {t("review.reject")}
            </Button>
            <Button
              variant="success"
              disabled={!screen.canApproveNow}
              isLoading={screen.decisions.isApproving}
              onClick={screen.decisions.approve}
            >
              {t("review.approve")}
            </Button>
          </div>

          <RejectApplicationDialog
            isOpen={screen.isRejecting}
            review={review}
            isSubmitting={screen.decisions.isRejecting}
            requiresStepUp={screen.decisions.rejectPolicy.requiresStepUp}
            noteError={screen.rejectNoteError}
            onCancel={screen.closeReject}
            onSubmit={(input) => void screen.submitRejection(input)}
          />
        </>
      ) : null}

      <StepUpChallenge stepUp={screen.decisions.rejectStepUp} />
    </>
  );
}
