import { create } from "zustand";
import { loadPreference, savePreference } from "@sethu/core";

// Acknowledgements taken while offline (mobile BOX 24).
//
// Acknowledging is the one write in this console that is safe to queue: it cannot double-book anyone
// and it cannot be raced into a wrong outcome — the worst case is two admins owning the same alert,
// which the idempotent endpoint already treats as normal. Assignment, cancellation and refunds are
// blocked offline instead; they are not here for that reason.
//
// Durability matters more than it looks. An operator who acknowledges an escalation in a basement
// with no signal, then loses the app to the OS before reconnecting, would otherwise leave the alert
// unacknowledged and the badge lit for someone else to trip over. So the queue is persisted through
// @sethu/core's storage adapter — the same one that holds the session token, which means it moves to
// the OS keystore for free when the native adapter lands.

const QUEUE_KEY = "sethu.admin.ackQueue";

interface AckQueueState {
  /** Alert ids whose acknowledgement is waiting on the network, oldest first. */
  readonly queued: readonly string[];
  /** True until the persisted queue has been read, so replay does not run against an empty list. */
  readonly isHydrated: boolean;
  hydrate: () => Promise<void>;
  enqueue: (alertId: string) => void;
  dequeue: (alertId: string) => void;
  clear: () => void;
}

function parseQueue(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    // A corrupt queue is dropped rather than retried forever; the alerts stay unacknowledged, which
    // is the safe failure — the badge keeps asking for attention.
    return [];
  }
}

function persist(queued: readonly string[]): void {
  void savePreference(QUEUE_KEY, JSON.stringify(queued));
}

export const useAckQueueStore = create<AckQueueState>((set, get) => ({
  queued: [],
  isHydrated: false,
  hydrate: async () => {
    if (get().isHydrated) return;
    const queued = parseQueue(await loadPreference(QUEUE_KEY));
    set({ queued, isHydrated: true });
  },
  enqueue: (alertId) =>
    set((state) => {
      // Tapping four times must not send four acknowledgements when the network returns.
      if (state.queued.includes(alertId)) return state;
      const queued = [...state.queued, alertId];
      persist(queued);
      return { queued };
    }),
  dequeue: (alertId) =>
    set((state) => {
      const queued = state.queued.filter((queuedId) => queuedId !== alertId);
      persist(queued);
      return { queued };
    }),
  clear: () => {
    persist([]);
    set({ queued: [] });
  },
}));
