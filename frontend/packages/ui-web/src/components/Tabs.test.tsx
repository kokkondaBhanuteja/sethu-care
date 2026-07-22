import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

// The workspace vitest setup registers no RTL auto-cleanup (no `globals: true`), so unmount
// explicitly — a stale open overlay would otherwise leak `pointer-events: none` across tests.
afterEach(cleanup);

function renderPartyTabs(look: "segmented" | "underline") {
  return render(
    <Tabs defaultValue="creditors">
      <TabsList look={look}>
        <TabsTrigger value="creditors">Creditors</TabsTrigger>
        <TabsTrigger value="debtors">Debtors</TabsTrigger>
      </TabsList>
      <TabsContent value="creditors">Creditors list</TabsContent>
      <TabsContent value="debtors">Debtors list</TabsContent>
    </Tabs>,
  );
}

describe("Tabs", () => {
  it("renders an accessible tablist and switches panels on click", async () => {
    renderPartyTabs("segmented");
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByText("Creditors list")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Debtors" }));
    expect(screen.getByText("Debtors list")).toBeInTheDocument();
    expect(screen.queryByText("Creditors list")).not.toBeInTheDocument();
  });

  it("passes the segmented look from the list to its triggers via context", () => {
    renderPartyTabs("segmented");
    expect(screen.getByRole("tab", { name: "Creditors" })).toHaveClass("rounded-md");
  });

  it("passes the underline look from the list to its triggers via context", () => {
    renderPartyTabs("underline");
    expect(screen.getByRole("tab", { name: "Creditors" })).toHaveClass("border-b-2");
  });
});
