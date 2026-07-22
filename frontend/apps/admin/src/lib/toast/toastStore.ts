import { create } from "zustand";

// Toasts are transient UI state, not server state — so zustand, not TanStack Query (Part 9).
// The undo window is the reason this store exists at all: the risk register gives cancel, suspend
// and block a 10s undo and assign/approve a 30s one, and that timer has to outlive the component
// that started the action (spec §10.3).

export const TOAST_TONES = {
  success: "success",
  danger: "danger",
  info: "info",
} as const;

export type ToastTone = (typeof TOAST_TONES)[keyof typeof TOAST_TONES];

/** Default dwell for a toast with no undo (spec §3.3). */
const DEFAULT_DURATION_MS = 4_000;

export interface ToastAction {
  readonly label: string;
  readonly onAction: () => void;
}

export interface Toast {
  readonly id: string;
  readonly message: string;
  readonly tone: ToastTone;
  readonly durationMs: number;
  readonly action?: ToastAction;
  /** Draws the draining progress bar — set for undo windows so the deadline is visible. */
  readonly showProgress: boolean;
}

export interface ShowToastInput {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
  action?: ToastAction;
  showProgress?: boolean;
}

interface ToastState {
  toasts: readonly Toast[];
  show: (input: ShowToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let sequence = 0;
function nextId(): string {
  sequence += 1;
  return `toast-${sequence}`;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  show: (input) => {
    const toast: Toast = {
      id: nextId(),
      message: input.message,
      tone: input.tone ?? TOAST_TONES.info,
      durationMs: input.durationMs ?? DEFAULT_DURATION_MS,
      showProgress: input.showProgress ?? Boolean(input.action),
      ...(input.action ? { action: input.action } : {}),
    };
    // One at a time: stacked toasts over a bottom action bar bury the action they describe.
    set({ toasts: [toast] });
    return toast.id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/** Non-hook accessor, so the query client's mutation-error bridge can raise a toast. */
export function showToast(input: ShowToastInput): string {
  return useToastStore.getState().show(input);
}
