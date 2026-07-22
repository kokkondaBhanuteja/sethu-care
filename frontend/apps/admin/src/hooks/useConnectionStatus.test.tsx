import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CONNECTION_STATES, useConnectionStatus, useIsOnline } from "./useConnectionStatus";

// Three features read this: the dashboard's offline banner, the map's staleness chip and the
// bookings list's disabled actions. `canMutate` is the load-bearing field — a destructive action
// offered with no connection either fails silently or queues without saying so.

function setOnline(isOnline: boolean): void {
  Object.defineProperty(window.navigator, "onLine", { value: isOnline, configurable: true });
}

afterEach(() => {
  setOnline(true);
});

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("useIsOnline", () => {
  it("reads the browser's own verdict rather than inferring one", () => {
    setOnline(false);

    expect(renderHook(() => useIsOnline()).result.current).toBe(false);
  });
});

describe("useConnectionStatus", () => {
  it("refuses mutations while the device is offline", () => {
    setOnline(false);
    const client = newClient();

    const { result } = renderHook(() => useConnectionStatus(), { wrapper: wrapper(client) });

    expect(result.current.state).toBe(CONNECTION_STATES.offline);
    // Screens disable the action AND state the reason; an action that silently does nothing is
    // worse than one that explains itself (spec §4.10).
    expect(result.current.canMutate).toBe(false);
  });

  it("reports nothing in flight while offline, so no screen shows a spinner it cannot resolve", () => {
    setOnline(false);
    const client = newClient();

    const { result } = renderHook(() => useConnectionStatus(), { wrapper: wrapper(client) });

    expect(result.current.isBusy).toBe(false);
  });

  it("allows mutations when the device is online and idle", () => {
    setOnline(true);
    const client = newClient();

    const { result } = renderHook(() => useConnectionStatus(), { wrapper: wrapper(client) });

    expect(result.current).toEqual({
      state: CONNECTION_STATES.online,
      canMutate: true,
      isBusy: false,
    });
  });

  it("reports busy while a read is in flight, which is what drives the shell's activity hint", async () => {
    setOnline(true);
    const client = newClient();
    void client.fetchQuery({ queryKey: ["never"], queryFn: () => new Promise<string>(() => {}) });

    const { result } = renderHook(() => useConnectionStatus(), { wrapper: wrapper(client) });

    await waitFor(() => {
      expect(result.current.isBusy).toBe(true);
    });
    // Busy is not a reason to block an action — only being offline is.
    expect(result.current.canMutate).toBe(true);
  });
});
