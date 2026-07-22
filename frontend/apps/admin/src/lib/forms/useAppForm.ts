import { useCallback, useRef, useState } from "react";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";

import { isApiError, normalizeError, type ApiError } from "../http/apiError";

export interface UseAppFormOptions<TValues extends FieldValues> {
  /** Input and output are the same shape: forms here validate, they do not transform. */
  schema: ZodType<TValues, TValues>;
  defaultValues: DefaultValues<TValues>;
  onSubmit: (values: TValues) => Promise<void>;
}

export interface AppForm<TValues extends FieldValues> {
  form: UseFormReturn<TValues>;
  /** Wire to <form onSubmit>. Guards against double submission by itself. */
  handleSubmit: (event?: React.BaseSyntheticEvent) => Promise<void>;
  /** True while the submit handler is running — disable the primary action on this. */
  isSubmitting: boolean;
  /** A failure that belongs to the form as a whole rather than to one field. */
  formError: ApiError | null;
  /** Per-field message, already mapped from the API's fieldErrors where it sent any. */
  errorFor: (field: Path<TValues>) => string | undefined;
  reset: () => void;
}

/**
 * The single form wrapper. Every form in this console gets, without re-implementing any of it:
 * typed values, schema validation, field-level errors, a submit-in-flight flag, duplicate-submission
 * prevention, API errors mapped back onto their fields, and reset.
 *
 * Duplicate-submission prevention matters more here than in most apps: submitting a refund twice
 * spends real money, and the backend's idempotency key is not yet in place on admin mutations.
 */
export function useAppForm<TValues extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
}: UseAppFormOptions<TValues>): AppForm<TValues> {
  const form = useForm<TValues>({
    // zodResolver is typed against a concrete schema; inside a generic wrapper TS cannot prove the
    // generic TValues is the schema's output even though the signature guarantees it. The assertion
    // is to Resolver<TValues> — a real type, not `any` — and is the only one in the form layer.
    resolver: zodResolver(schema) as Resolver<TValues>,
    defaultValues,
    mode: "onBlur",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<ApiError | null>(null);

  // The ref, not the state, is the guard. RHF's own isSubmitting resets between the await and the
  // re-render, and a `useState` flag is no better: two taps 40ms apart land in the same commit, so
  // both handlers close over the pre-submit `false` and the refund is issued twice. The ref is
  // written synchronously, so the second handler sees the first one's decision.
  const inFlightRef = useRef(false);

  const submit = form.handleSubmit(async (values) => {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setIsSubmitting(true);
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (thrown) {
      const error = normalizeError(thrown, "The form could not be submitted.");
      applyFieldErrors(form, error);
      setFormError(error);
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  });

  const handleSubmit = useCallback(
    async (event?: React.BaseSyntheticEvent) => {
      await submit(event);
    },
    [submit],
  );

  const errorFor = useCallback(
    (field: Path<TValues>): string | undefined => {
      const message = form.formState.errors[field]?.message;
      return typeof message === "string" ? message : undefined;
    },
    [form.formState.errors],
  );

  const reset = useCallback(() => {
    form.reset(defaultValues);
    setFormError(null);
  }, [form, defaultValues]);

  return { form, handleSubmit, isSubmitting, formError, errorFor, reset };
}

/** Push a backend's per-field messages onto the matching controls, ignoring unknown field names. */
function applyFieldErrors<TValues extends FieldValues>(
  form: UseFormReturn<TValues>,
  error: ApiError,
): void {
  if (!isApiError(error) || !error.fieldErrors) return;

  for (const [field, message] of Object.entries(error.fieldErrors)) {
    form.setError(field as Path<TValues>, { type: "server", message });
  }
}
