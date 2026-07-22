// The one clock-time treatment for every alert surface.
//
// All actual formatting is the shared en-IN helper (lib/format, spec §4.7) — never a local
// Intl call. The approved alert artifacts write meridiems uppercase ("Created 3:12 PM", the
// timeline gutter sized to "3:12 PM"), while current ICU data lowercases en-IN day periods
// ("3:12 pm"). This adapter fixes ONLY the casing, so alert times, the ownership line and the
// related-record fixture line all read in one style instead of two.

import { formatTime } from "../../lib/format";

/** `3:12 PM` — the shared IST formatter's output, in the artifacts' uppercase-meridiem casing. */
export function formatAlertTime(iso: string | Date): string {
  return formatTime(iso).toUpperCase();
}
