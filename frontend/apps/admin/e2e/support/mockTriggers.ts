/**
 * The fixtures for this suite are the mock triggers each feature documents in its own CLAUDE.md.
 * There is no backend and no seeded database — a booking id, an email or a code IS the fixture, and
 * every value below is copied from the feature that owns it.
 *
 * Sources:
 *  - `src/features/auth/CLAUDE.md` ("Walking every state") and `auth.constants.ts` MOCK_TRIGGERS
 *  - `src/features/booking-actions/CLAUDE.md` ("Mock triggers")
 *  - `src/features/providers/CLAUDE.md` ("Reaching each designed state")
 */

/** Any plausible email plus any password of 8+ characters signs in (features/auth/CLAUDE.md). */
export const MOCK_LOGIN = {
  email: "ops@setucare.in",
  password: "password123",
  /** Any six digits verify; 123456 is the documented happy path. */
  code: "123456",
} as const;

export const AUTH_TRIGGERS = {
  /** A password ending in `wrong` is rejected as invalid credentials (BOX 53 / 84). */
  wrongPassword: "hunterwrong",
  /** Locks the account with a running countdown (BOX 54 / 85). */
  lockedEmail: "locked@setucare.in",
  disabledEmail: "disabled@setucare.in",
  /** Skips the second factor entirely. */
  trustedDeviceEmail: "trusted@setucare.in",
  /** Rejected code: cells clear, focus returns to the first (BOX 56 / 89). */
  wrongCode: "000000",
  expiredCode: "111111",
  /** Trips the trusted-device cap and shows the revoke picker (BOX 57 / 91). */
  deviceLimitCode: "999999",
} as const;

export const BOOKING_TRIGGERS = {
  /** The ordinary path for cancel and manual completion — all evidence satisfied. */
  ordinary: "B-8823",
  /** Technician on site: amber strip with "Escalate instead". */
  technicianOnSite: "B-8805",
  /** Manual completion with evidence missing — Continue is blocked. */
  evidenceMissing: "B-8809",
  /** Manual completion interrupted by the completion OTP arriving. */
  otpArrivedMidFlow: "B-8801",
  /** Manual completion inside the 30-minute lock. */
  tooEarly: "B-8815",
  /** Refund: the ordinary path; goodwill above ₹500 shows the cap error. */
  refund: "B-8790",
  /** Refund: the gateway goes quiet and the receipt returns `isPending`. */
  refundPending: "B-8788",
  /** Refund: rate limited — the form is replaced, not disabled. */
  refundRateLimited: "B-8787",
  /** No such booking — the not-found state (spec §3.4 rule 3). */
  unknown: "B-0000",
} as const;

export const PROVIDER_TRIGGERS = {
  /** Healthy profile; suspending them walks all four steps because they hold active jobs. */
  withActiveJobs: "PRV-882",
  poorPerformer: "PRV-907",
  /** No active jobs — the suspend flow legitimately skips step 3. */
  withoutActiveJobs: "PRV-884",
  unknown: "PRV-0000",
} as const;

export const APPLICATION_TRIGGERS = {
  /** Pending review — the reject modal is reached from here. */
  pending: "APP-4471",
  approveBlocked: "APP-4473",
  alreadyDecided: "APP-4460",
} as const;

export const ALERT_TRIGGERS = {
  existing: "AL-8823",
  unknown: "AL-0000",
} as const;

/** ₹500 goodwill cap (`features/booking-actions/refundLimits.ts`). Anything above trips it. */
export const GOODWILL_CAP_BREACH_RUPEES = "900";
