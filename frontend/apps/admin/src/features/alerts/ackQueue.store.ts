import { create } from "zustand";

// Acknowledgements taken while offline (mobile BOX 24).
//
// Acknowledging is the one write in this console that is safe to queue: it cannot double-book
// anyone and it cannot be raced into a wrong outcome — the worst case is two admins owning the same
// alert, which the idempotent endpoint already treats as normal. Assignment, cancellation and
// refunds are blocked offline instead; they are not here for that reason.
//
// LIMITATION — the queue is in memory only. It survives navigation between screens, but NOT a
// reload or an app kill, because durable storage would have to go through @sethu/core's storage
// adapter and `savePreference`/`loadPreference` are not exported from that package today. The state
// this file drives is real; its durability is not. See CLAUDE.md.

interface AckQueueState {
  /** Alert ids whose acknowledgement is waiting on the network, oldest first. */
  readonly queued: readonly string[];
  enqueue: (alertId: string) => void;
  dequeue: (alertId: string) => void;
  clear: () => void;
}

export const useAckQueueStore = create<AckQueueState>((set) => ({
  queued: [],
  enqueue: (alertId) =>
    set((state) =>
      // Tapping four times must not send four acknowledgements when the network returns.
      state.queued.includes(alertId) ? state : { queued: [...state.queued, alertId] },
    ),
  dequeue: (alertId) =>
    set((state) => ({ queued: state.queued.filter((queuedId) => queuedId !== alertId) })),
  clear: () => set({ queued: [] }),
}));
