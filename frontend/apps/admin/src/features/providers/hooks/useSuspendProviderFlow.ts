import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import { ROUTES } from "../../../routes/routes.constants";
import { useSuspendProviderMutation } from "../mutations/useProviderActions";
import { useProviderActiveJobsQuery, useProviderProfileQuery } from "../queries/providers.queries";
import { DEFAULT_SUSPEND_DURATION_DAYS } from "../providers.constants";
import { SUSPEND_ACTION_TYPES, SUSPEND_REASON_CODES } from "../suspend.types";
import type {
  JobResolution,
  JobResolutionMap,
  SuspendActionType,
  SuspendReasonCode,
} from "../suspend.types";
import { useSuspendMessages } from "./useSuspendMessages";

/** One rail stop per pane — "Action & reason" is a single stop, so the counter never jumps. */
export const RAIL_INDEX_FOR_PANE: readonly number[] = [0, 1, 2];
export const TOTAL_STEPS = 3;

export function useSuspendProviderFlow() {
  const { providerId = "" } = useParams<{ providerId: string }>();
  const navigate = useNavigate();

  const profileQuery = useProviderProfileQuery(providerId);
  const activeJobsQuery = useProviderActiveJobsQuery(providerId);
  const profile = profileQuery.data ?? null;
  const activeJobs = useMemo(() => activeJobsQuery.data ?? [], [activeJobsQuery.data]);

  const [paneIndex, setPaneIndex] = useState(0);
  const [type, setType] = useState<SuspendActionType>(SUSPEND_ACTION_TYPES.suspend);
  const [durationDays, setDurationDays] = useState(DEFAULT_SUSPEND_DURATION_DAYS);
  const [reasonCode, setReasonCode] = useState<SuspendReasonCode | null>(null);
  const [note, setNote] = useState("");
  const [jobResolutions, setJobResolutions] = useState<JobResolutionMap>({});
  const [notifyImmediately, setNotifyImmediately] = useState(false);
  const [isDiscardPrompted, setIsDiscardPrompted] = useState(false);

  const messages = useSuspendMessages({
    type,
    durationDays,
    reasonCode,
    providerName: profile?.name ?? providerId,
  });

  const close = useCallback(() => {
    void navigate(ROUTES.providerDetail(providerId));
  }, [navigate, providerId]);

  const mutation = useSuspendProviderMutation(type, {
    doneMessage: messages.doneMessage,
    onSuccess: close,
  });

  const unresolvedCount = activeJobs.filter(
    (job) => jobResolutions[job.bookingId] === undefined,
  ).length;

  const hasActiveJobs = activeJobs.length > 0;
  const isDirty = reasonCode !== null || note.length > 0 || Object.keys(jobResolutions).length > 0;

  // The first pane also waits for the active-jobs query to settle. `hasActiveJobs` drives whether
  // goNext skips the Active-jobs pane, and it reads an empty array until the data lands — so an
  // operator who picked a reason inside the request window jumped straight to Confirm and
  // suspended a provider mid-job with nobody reassigned. That pane exists precisely to stop this,
  // so it must not be skippable by being fast.
  const canContinue =
    paneIndex === 0
      ? reasonCode !== null &&
        (reasonCode !== SUSPEND_REASON_CODES.other || note.trim().length > 0) &&
        !activeJobsQuery.isPending
      : paneIndex === 1
        ? unresolvedCount === 0
        : true;

  const goNext = useCallback(() => {
    setPaneIndex((current) => (current === 0 && !hasActiveJobs ? 2 : current + 1));
  }, [hasActiveJobs]);

  const goBack = useCallback(() => {
    setPaneIndex((current) => {
      if (current === 0) return current;
      return current === 2 && !hasActiveJobs ? 0 : current - 1;
    });
  }, [hasActiveJobs]);

  const requestClose = useCallback(() => {
    if (isDirty) {
      setIsDiscardPrompted(true);
      return;
    }
    close();
  }, [isDirty, close]);

  const resolveJob = useCallback((bookingId: string, resolution: JobResolution | undefined) => {
    setJobResolutions((current) => ({ ...current, [bookingId]: resolution }));
  }, []);

  const submit = useCallback(() => {
    if (!profile || reasonCode === null) return;
    void mutation.submit({
      providerId,
      version: profile.version,
      type,
      durationDays: type === SUSPEND_ACTION_TYPES.suspend ? durationDays : null,
      reasonCode,
      note,
      jobResolutions,
      notifyImmediately,
    });
  }, [
    profile,
    reasonCode,
    mutation,
    providerId,
    type,
    durationDays,
    note,
    jobResolutions,
    notifyImmediately,
  ]);

  return {
    providerId,
    profile,
    profileQuery,
    activeJobs,
    activeJobsQuery,
    paneIndex,
    railIndex: RAIL_INDEX_FOR_PANE[paneIndex] ?? 0,
    stepNumber: (RAIL_INDEX_FOR_PANE[paneIndex] ?? 0) + 1,
    type,
    setType,
    durationDays,
    setDurationDays,
    reasonCode,
    setReasonCode,
    note,
    setNote,
    jobResolutions,
    resolveJob,
    unresolvedCount,
    notifyImmediately,
    setNotifyImmediately,
    canContinue,
    goNext,
    goBack,
    requestClose,
    isDiscardPrompted,
    keepEditing: () => setIsDiscardPrompted(false),
    discard: close,
    submit,
    messages,
    stepUp: mutation.stepUp,
    canAct: mutation.canAct,
    policy: mutation.policy,
    isSubmitting: mutation.isPending,
  };
}
