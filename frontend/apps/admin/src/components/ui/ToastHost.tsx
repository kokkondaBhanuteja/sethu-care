import { useEffect, useState } from "react";

import { cx } from "../../lib/cx";
import { useToastStore, type Toast } from "../../lib/toast/toastStore";

export interface ToastHostProps {
  /** Lift the toast above a sticky bottom action bar so it never buries the button it describes. */
  aboveActionBar?: boolean;
}

/** Mounted once per shell. Screens raise toasts through the store, never by rendering one. */
export function ToastHost({ aboveActionBar = false }: ToastHostProps) {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);
  const [toast] = toasts;

  if (!toast) return null;
  return (
    <ToastView key={toast.id} toast={toast} onDismiss={dismiss} aboveActionBar={aboveActionBar} />
  );
}

/**
 * Whole seconds left of the toast's window. The 2px progress line alone is not a legible deadline
 * for a destructive undo, so the action also states it ("Undo · 8s").
 */
function useRemainingSeconds(durationMs: number, enabled: boolean): number {
  const [remainingSeconds, setRemainingSeconds] = useState(() => Math.ceil(durationMs / 1000));

  useEffect(() => {
    if (!enabled) return;
    const deadline = Date.now() + durationMs;
    const interval = window.setInterval(() => {
      setRemainingSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(interval);
  }, [durationMs, enabled]);

  return remainingSeconds;
}

interface ToastViewProps {
  toast: Toast;
  onDismiss: (id: string) => void;
  aboveActionBar: boolean;
}

function ToastView({ toast, onDismiss, aboveActionBar }: ToastViewProps) {
  // A countdown only where there is a deadline to beat: an action inside a draining window.
  const showsCountdown = toast.action !== undefined && toast.showProgress;
  const remainingSeconds = useRemainingSeconds(toast.durationMs, showsCountdown);

  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.durationMs, onDismiss]);

  function handleAction() {
    toast.action?.onAction();
    onDismiss(toast.id);
  }

  return (
    <div
      // "assertive" only for failures: an undo confirmation should not interrupt a screen reader
      // mid-sentence, but a failed refund must.
      role={toast.tone === "danger" ? "alert" : "status"}
      aria-live={toast.tone === "danger" ? "assertive" : "polite"}
      className={cx("toast", aboveActionBar && "toast--above-action")}
    >
      <span className="toast__text">{toast.message}</span>
      {toast.action ? (
        <button type="button" className="toast__action" onClick={handleAction}>
          {toast.action.label}
          {showsCountdown ? (
            // aria-hidden keeps the accessible name stable ("Undo") instead of renaming the
            // button every second.
            <span aria-hidden className="toast__action-count">
              {` · ${remainingSeconds}s`}
            </span>
          ) : null}
        </button>
      ) : null}
      {toast.showProgress ? (
        <span className="toast__progress" style={{ animationDuration: `${toast.durationMs}ms` }} />
      ) : null}
    </div>
  );
}
