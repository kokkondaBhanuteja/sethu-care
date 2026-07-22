import { expect, test } from "../fixtures";
import { APPLICATION_TRIGGERS } from "../support/mockTriggers";

/**
 * Rejecting an application (BOX 46). Rejection is final and the applicant is notified by SMS, so it
 * needs both halves of an explanation: a reason CODE, which the audit log and the safety-review
 * router key off, and a NOTE long enough to be a sentence rather than a keystroke.
 */

test.beforeEach(async ({ applicationReview }) => {
  await applicationReview.goto(APPLICATION_TRIGGERS.pending);
  await applicationReview.openReject();
});

test("the reject modal states its finality before anything is filled in", async ({
  applicationReview,
}) => {
  await expect(applicationReview.finality).toBeVisible();
  await expect(applicationReview.confirmReject).toBeDisabled();
});

test("a reason code alone is not enough", async ({ applicationReview }) => {
  await applicationReview.chooseRejectReason("Failed background check");

  await expect(applicationReview.confirmReject).toBeDisabled();
  await applicationReview.expectNoteCounter(0);
});

test("a note under the minimum is not enough either", async ({ applicationReview }) => {
  await applicationReview.chooseRejectReason("Failed background check");
  await applicationReview.rejectNote.fill("Too short");

  await applicationReview.expectNoteCounter(9);
  await expect(applicationReview.confirmReject).toBeDisabled();
});

test("a reason code plus a real note unlocks the commit", async ({ applicationReview }) => {
  await applicationReview.chooseRejectReason("Failed background check");
  await applicationReview.rejectNote.fill(
    "Police verification came back with an unresolved case; re-apply once it is cleared.",
  );

  await expect(applicationReview.confirmReject).toBeEnabled();
});

test("a note without a reason code is not enough", async ({ applicationReview }) => {
  await applicationReview.rejectNote.fill(
    "Police verification came back with an unresolved case; re-apply once it is cleared.",
  );

  await expect(applicationReview.confirmReject).toBeDisabled();
});
