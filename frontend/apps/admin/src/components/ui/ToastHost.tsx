import { useEffect } from "react";

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

interface ToastViewProps {
  toast: Toast;
  onDismiss: (id: string) => void;
  aboveActionBar: boolean;
}

function ToastView({ toast, onDismiss, aboveActionBar }: ToastViewProps) {
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
        </button>
      ) : null}
      {toast.showProgress ? (
        <span className="toast__progress" style={{ animationDuration: `${toast.durationMs}ms` }} />
      ) : null}
    </div>
  );
}
