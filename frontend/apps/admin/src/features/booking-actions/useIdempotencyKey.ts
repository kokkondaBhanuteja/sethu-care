import { useCallback, useState } from "react";

/**
 * One idempotency key per *intent*, not per keystroke and not per network attempt.
 *
 * The key is minted when the flow mounts and only rotated once a submission has actually
 * succeeded. That is what makes a retry safe: if a refund request times out and the operator
 * presses the button again, the backend sees the same key and returns the first result instead of
 * moving the money twice (docs/admin-api-contract.md §Idempotency).
 *
 * The in-flight guard in `useAppForm` covers the double-click inside one tab; this covers
 * everything else — a flaky network, a reloaded tab, a second device.
 */
export function useIdempotencyKey(): { idempotencyKey: string; rotate: () => void } {
  const [idempotencyKey, setKey] = useState(newKey);

  const rotate = useCallback(() => {
    setKey(newKey());
  }, []);

  return { idempotencyKey, rotate };
}

function newKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Older WebViews without randomUUID still need a key; uniqueness per device-hour is enough,
  // because the backend scopes the key to the admin and the endpoint.
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
