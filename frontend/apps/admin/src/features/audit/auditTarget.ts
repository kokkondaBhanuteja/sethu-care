// Where a target reference navigates to. The only tappable value on the entry screen navigates
// OUTWARD to the record, never acting on the entry itself (BOX 76) — there is nothing to do to an
// audit entry.

import { ROUTES } from "../../routes/routes.constants";
import { AUDIT_TARGET_TYPES, type AuditTarget } from "./audit.types";

/** Null for target types the console has no detail screen for — payments and devices. */
export function auditTargetRoute(target: AuditTarget): string | null {
  switch (target.type) {
    case AUDIT_TARGET_TYPES.booking:
      return ROUTES.bookingDetail(target.id);
    case AUDIT_TARGET_TYPES.provider:
      return ROUTES.providerDetail(target.id);
    case AUDIT_TARGET_TYPES.customer:
      return ROUTES.customerDetail(target.id);
    case AUDIT_TARGET_TYPES.application:
      return ROUTES.applicationReview(target.id);
    case AUDIT_TARGET_TYPES.alert:
      return ROUTES.alertDetail(target.id);
    default:
      return null;
  }
}
