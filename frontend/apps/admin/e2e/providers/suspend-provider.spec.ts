import { expect, test } from "../fixtures";
import { PROVIDER_TRIGGERS } from "../support/mockTriggers";
import { chooseOption } from "../support/controls";

/**
 * Suspension (BOX 36–38): three deliberate steps, and the active-jobs step is the point of the
 * whole flow —
 * suspending a provider mid-job is invisible to the admin and catastrophic to the person waiting
 * at home, so every live booking must be explicitly handled before the flow can continue.
 *
 * Action type and reason share the first pane, and the rail says so: "Action & reason" →
 * "Active jobs" → "Confirm".
 */

const REASON = "Customer safety complaint";

test.beforeEach(async ({ suspendProvider }) => {
  await suspendProvider.goto(PROVIDER_TRIGGERS.withActiveJobs);
});

test("the rail names all three steps up front", async ({ suspendProvider }) => {
  await suspendProvider.expectAllSteps();
  await suspendProvider.expectStepNumber(1);
});

test("the cost of the action is pinned at every step", async ({ suspendProvider }) => {
  await expect(suspendProvider.impact).toBeVisible();

  await suspendProvider.continueFromStepOne(REASON);

  await expect(suspendProvider.impact).toBeVisible();
});

test("step 1 gates on a reason code", async ({ suspendProvider }) => {
  await expect(suspendProvider.continueButton).toBeDisabled();

  await suspendProvider.chooseReason(REASON);

  await expect(suspendProvider.continueButton).toBeEnabled();
});

/**
 * Guards the race where `goNext` read an unresolved active-jobs query as zero jobs and skipped
 * the handling step.
 */
test("the active-jobs step must not be skipped while the active-jobs query is still in flight", async ({
  suspendProvider,
}) => {
  // No wait for the record: this is exactly what a fast operator does.
  await suspendProvider.chooseReason(REASON);
  await suspendProvider.continueButton.click();

  await expect(suspendProvider.activeJobsHeading).toBeVisible();
});

test("the active-jobs step lists the provider's active jobs", async ({ suspendProvider }) => {
  await suspendProvider.continueFromStepOne(REASON);

  await suspendProvider.expectStepNumber(2);
  await expect(suspendProvider.activeJobsHeading).toBeVisible();
  await expect(
    suspendProvider.dialog.getByText(/has \d+ active jobs\. Each must be handled/),
  ).toBeVisible();
  await expect(suspendProvider.letThemFinish.first()).toBeVisible();
  await expect(suspendProvider.reassign.first()).toBeVisible();
});

test("the active-jobs step refuses to continue while a job is unhandled", async ({
  suspendProvider,
}) => {
  await suspendProvider.continueFromStepOne(REASON);
  await expect(suspendProvider.activeJobsHeading).toBeVisible();

  await expect(suspendProvider.continueButton).toBeDisabled();
  await expect(
    suspendProvider.dialog.getByText(/Handle \d+ more jobs? to continue\./),
  ).toBeVisible();
});

test("handling every job unlocks the confirm step", async ({ suspendProvider }) => {
  await suspendProvider.continueFromStepOne(REASON);
  await expect(suspendProvider.activeJobsHeading).toBeVisible();

  await suspendProvider.letEveryJobFinish();
  await expect(suspendProvider.continueButton).toBeEnabled();
  await suspendProvider.continueButton.click();

  await suspendProvider.expectStepNumber(3);
  await expect(suspendProvider.dialog.getByRole("heading", { name: "Confirm" })).toBeVisible();
});

test("the confirm step shows the message the provider will actually receive", async ({
  suspendProvider,
}) => {
  await suspendProvider.continueFromStepOne(REASON);
  await expect(suspendProvider.activeJobsHeading).toBeVisible();
  await suspendProvider.letEveryJobFinish();
  await suspendProvider.continueButton.click();

  await expect(
    suspendProvider.dialog.getByText(/Your SetuCare account is suspended/),
  ).toBeVisible();
  await expect(suspendProvider.group("When to notify")).toBeVisible();
});

test("a suspension length is only offered for a temporary suspension", async ({
  suspendProvider,
}) => {
  const actionType = suspendProvider.group("What should happen?");
  await expect(
    suspendProvider.page.getByRole("radiogroup", { name: "Suspension length" }),
  ).toBeVisible();

  await chooseOption(actionType, "Block (indefinite)");

  await expect(
    suspendProvider.page.getByRole("radiogroup", { name: "Suspension length" }),
  ).toHaveCount(0);
});

test("a provider with no active jobs skips the jobs step legitimately", async ({
  suspendProvider,
}) => {
  await suspendProvider.goto(PROVIDER_TRIGGERS.withoutActiveJobs);
  await suspendProvider.continueFromStepOne("Document expired or invalid");

  await suspendProvider.expectStepNumber(3);
  await expect(suspendProvider.activeJobsHeading).toHaveCount(0);
});
