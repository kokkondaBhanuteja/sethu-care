import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { cn } from "../lib/cn";

// Minimal dependency-free toasts: ToastProvider owns the queue, useToast() enqueues, and the app
// shell mounts one <ToastViewport> (aria-live=polite). Tones reuse the StatusPill tint pairs.
const DEFAULT_TOAST_DURATION_MS = 5000;
const toastVariants = cva(
  "pointer-events-auto flex w-full items-start gap-3 rounded-lg border p-4 shadow-overlay",
  {
    variants: {
      tone: {
        success: "border-success-border bg-success-bg text-success-fg",
        danger: "border-danger-border bg-danger-bg text-danger-fg",
        info: "border-info-border bg-info-bg text-info-fg",
        neutral: "border-border bg-surface text-ink",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type ToastTone = NonNullable<VariantProps<typeof toastVariants>["tone"]>;

export interface ToastOptions {
  title: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  /** Auto-dismiss delay; pass 0 to keep the toast until dismissed manually. */
  durationMs?: number;
}
type ToastRecord = ToastOptions & { id: number };

interface ToastContextValue {
  toasts: ToastRecord[];
  showToast: (options: ToastOptions) => number;
  dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    clearTimeout(timersRef.current.get(id));
    timersRef.current.delete(id);
    setToasts((currentToasts) => currentToasts.filter((toastRecord) => toastRecord.id !== id));
  }, []);

  const showToast = useCallback(
    (options: ToastOptions) => {
      const id = nextIdRef.current;
      nextIdRef.current += 1;
      setToasts((currentToasts) => [...currentToasts, { ...options, id }]);
      const durationMs = options.durationMs ?? DEFAULT_TOAST_DURATION_MS;
      if (durationMs > 0) {
        const autoDismissTimer = setTimeout(() => dismissToast(id), durationMs);
        timersRef.current.set(id, autoDismissTimer);
      }
      return id;
    },
    [dismissToast],
  );

  // Lifecycle cleanup (standards Part 11): no timer may outlive the provider.
  useEffect(() => {
    const pendingTimers = timersRef.current;
    return () => {
      pendingTimers.forEach((pendingTimer) => clearTimeout(pendingTimer));
      pendingTimers.clear();
    };
  }, []);

  const contextValue = useMemo(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast],
  );
  return <ToastContext.Provider value={contextValue}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}

export interface ToastViewportProps extends HTMLAttributes<HTMLDivElement> {
  /** Accessible name for each toast's dismiss button (localized by the app). */
  dismissLabel?: string;
  toastClassName?: string;
}

export function ToastViewport({
  dismissLabel = "Dismiss",
  className,
  toastClassName,
  ...props
}: ToastViewportProps) {
  const { toasts, dismissToast } = useToast();
  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed bottom-4 left-4 right-4 z-50 flex flex-col gap-2 " +
          "sm:bottom-6 sm:left-auto sm:right-6 sm:w-full sm:max-w-sm",
        className,
      )}
      {...props}
    >
      {toasts.map((toastRecord) => (
        <div
          key={toastRecord.id}
          className={cn(toastVariants({ tone: toastRecord.tone }), toastClassName)}
        >
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{toastRecord.title}</div>
            {toastRecord.description ? (
              <div className="mt-0.5 text-sm opacity-80">{toastRecord.description}</div>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={dismissLabel}
            onClick={() => dismissToast(toastRecord.id)}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}

export { toastVariants };
