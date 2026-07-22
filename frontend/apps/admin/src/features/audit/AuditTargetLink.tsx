import type { MouseEvent } from "react";
import { Link } from "react-router";
import { useTranslation } from "@sethu/i18n";

import { cx } from "../../lib/cx";
import { AuditMono } from "./AuditDefList";
import { TARGET_TYPE_LABEL_KEYS } from "./audit.constants";
import { auditTargetRoute } from "./auditTarget";
import type { AuditTarget } from "./audit.types";

export interface AuditTargetLinkProps {
  target: AuditTarget;
  /** Detail views lead with the record's kind — "Booking #B-8790"; list cells show the bare ref. */
  withTypeLabel?: boolean;
  className?: string;
}

/**
 * The target reference as a real link to the record it names. A row click selects the entry; the
 * reference click navigates outward to the target — so the click must not bubble into the row.
 * Target types the console has no screen for (payments, devices) render as plain mono text, and
 * brand colour is reserved for the references that genuinely navigate.
 */
export function AuditTargetLink({
  target,
  withTypeLabel = false,
  className,
}: AuditTargetLinkProps) {
  const { t } = useTranslation("adminAudit");
  const route = auditTargetRoute(target);
  const typeLabel = t(TARGET_TYPE_LABEL_KEYS[target.type]);

  if (!route) {
    return (
      <span className={className}>
        {withTypeLabel ? <>{typeLabel} </> : null}
        <AuditMono>{target.reference}</AuditMono>
      </span>
    );
  }

  return (
    <Link
      to={route}
      onClick={(clickEvent: MouseEvent<HTMLAnchorElement>) => clickEvent.stopPropagation()}
      aria-label={`${typeLabel} ${target.reference}`}
      className={cx(
        "rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {withTypeLabel ? <>{typeLabel} </> : null}
      <AuditMono brand>{target.reference}</AuditMono>
    </Link>
  );
}
