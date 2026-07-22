import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inbox } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { API_ERROR_CODES, apiError } from "../../lib/http/apiError";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

// One failed read looks the same on every screen, and no screen invents its own wording. The
// property with teeth is the Retry button: offering one for a 403 hands the operator a control that
// can never work, and withholding one for a 503 hides the control that would.

describe("EmptyState", () => {
  it("states what is missing and why, never just 'No data'", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="No bookings need attention"
        body="Everything in the last hour is progressing normally."
      />,
    );

    expect(screen.getByText("No bookings need attention")).toBeInTheDocument();
    expect(
      screen.getByText("Everything in the last hour is progressing normally."),
    ).toBeInTheDocument();
  });

  it("renders the way forward when the caller has one to offer", () => {
    render(
      <EmptyState icon={Inbox} title="Nothing here yet" actions={<Button>Clear filters</Button>} />,
    );

    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("reads an all-clear as relief rather than absence", () => {
    // P3 restyle: positive turns the title success-green; grow fills the remaining height.
    render(<EmptyState icon={Inbox} title="All caught up" positive grow />);

    const title = screen.getByRole("heading", { name: "All caught up" });
    expect(title).toHaveClass("text-success-fg");
    expect(title.closest(".flex-1")).not.toBeNull();
  });
});

describe("ErrorState copy", () => {
  it.each([
    [API_ERROR_CODES.network, "You're offline"],
    [API_ERROR_CODES.timeout, "You're offline"],
    [API_ERROR_CODES.forbidden, "You don't have access to this"],
    [API_ERROR_CODES.unauthorized, "You don't have access to this"],
    [API_ERROR_CODES.notFound, "This no longer exists"],
    [API_ERROR_CODES.server, "Something went wrong"],
    [API_ERROR_CODES.conflict, "Something went wrong"],
    [API_ERROR_CODES.unknown, "Something went wrong"],
  ])("titles a %s failure '%s'", (code, title) => {
    render(<ErrorState error={apiError(code, "Details.")} />);

    expect(screen.getByText(title)).toBeInTheDocument();
  });

  it("prints the error's own message as the body, so the detail is not lost to the heading", () => {
    render(
      <ErrorState
        error={apiError(API_ERROR_CODES.conflict, "This booking was already cancelled.")}
      />,
    );

    expect(screen.getByText("This booking was already cancelled.")).toBeInTheDocument();
  });
});

describe("ErrorState retry", () => {
  it.each([
    API_ERROR_CODES.network,
    API_ERROR_CODES.timeout,
    API_ERROR_CODES.server,
    API_ERROR_CODES.rateLimited,
  ])("offers Retry for a %s failure, which the same request could survive", (code) => {
    render(<ErrorState error={apiError(code, "Details.")} onRetry={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it.each([
    API_ERROR_CODES.forbidden,
    API_ERROR_CODES.unauthorized,
    API_ERROR_CODES.notFound,
    API_ERROR_CODES.conflict,
    API_ERROR_CODES.validation,
  ])("withholds Retry for a %s failure, which repeating cannot fix", (code) => {
    render(<ErrorState error={apiError(code, "Details.")} onRetry={vi.fn()} />);

    // Asserted as an absence: a button that can only ever fail is worse than no button.
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("withholds Retry when the screen has no way to retry, however retryable the error is", () => {
    render(<ErrorState error={apiError(API_ERROR_CODES.server, "Details.")} />);

    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("runs the caller's retry when the operator takes it", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState error={apiError(API_ERROR_CODES.network, "Details.")} onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
