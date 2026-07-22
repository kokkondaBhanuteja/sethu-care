import { ApplicationReviewDesktop } from "../features/providers/ApplicationReview.desktop";
import { ApplicationReviewMobile } from "../features/providers/ApplicationReview.mobile";
import { useIsDesktop } from "../hooks/useBreakpoint";

/**
 * Route target for `/providers/applications/:applicationId`. Desktop gets the document viewer;
 * mobile gets thumbnails and an honest "review on desktop" notice.
 */
export default function ApplicationReviewPage() {
  return useIsDesktop() ? <ApplicationReviewDesktop /> : <ApplicationReviewMobile />;
}
