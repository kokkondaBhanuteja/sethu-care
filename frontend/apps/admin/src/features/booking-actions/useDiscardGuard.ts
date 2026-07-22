import { useCallback, useState } from "react";

export interface DiscardGuard {
  /** True while the "Discard changes?" prompt is on screen. */
  isPrompting: boolean;
  /** Call instead of leaving. Leaves immediately when nothing has been entered. */
  requestExit: () => void;
  /** The operator chose to lose their input. */
  confirmDiscard: () => void;
  /** The operator chose to stay. */
  keepEditing: () => void;
}

/**
 * Spec §3.3: a back or close gesture in a dirty flow must neither silently lose input nor trap the
 * operator. So the prompt appears only once something has actually been entered — a confirmation on
 * an untouched form is the kind of friction people learn to click through, which is exactly what
 * makes the prompt useless on the form where it matters.
 */
export function useDiscardGuard(isDirty: boolean, onExit: () => void): DiscardGuard {
  const [isPrompting, setIsPrompting] = useState(false);

  const requestExit = useCallback(() => {
    if (!isDirty) {
      onExit();
      return;
    }
    setIsPrompting(true);
  }, [isDirty, onExit]);

  const confirmDiscard = useCallback(() => {
    setIsPrompting(false);
    onExit();
  }, [onExit]);

  const keepEditing = useCallback(() => {
    setIsPrompting(false);
  }, []);

  return { isPrompting, requestExit, confirmDiscard, keepEditing };
}
