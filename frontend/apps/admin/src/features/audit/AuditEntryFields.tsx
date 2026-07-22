import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "@sethu/i18n";

import { Icon } from "../../components/ui/Icon";
import { Pill } from "../../components/ui/Pill";
import { formatDate, formatTime } from "../../lib/format";
import { AuditDefList, AuditDefRow, AuditMono } from "./AuditDefList";
import { AuditEvidenceTags } from "./AuditEvidenceTags";
import { AuditTargetLink } from "./AuditTargetLink";
import {
  ACTION_REGISTRY_IDS,
  REASON_LABEL_KEYS,
  RISK_LABEL_KEYS,
  RISK_PILL_TONES,
} from "./audit.constants";
import { toTransitions } from "./auditChange";
import type { AuditEntry, AuditStateSnapshot } from "./audit.types";

export interface AuditEntryFieldsProps {
  entry: AuditEntry;
  twoColumn?: boolean;
}

/**
 * Every field of the §10.4 schema, including the context block. IP and approximate location appear
 * here and only here — never in the list, never in a log line (spec §6.29, Privacy).
 */
export function AuditEntryFields({ entry, twoColumn = false }: AuditEntryFieldsProps) {
  const { t } = useTranslation("adminAudit");
  const reasonKey = entry.reason ? REASON_LABEL_KEYS[entry.reason.code] : undefined;

  return (
    <AuditDefList twoColumn={twoColumn}>
      <AuditDefRow label={t("detail.entryId")}>
        <AuditMono>{entry.id}</AuditMono>
      </AuditDefRow>
      <AuditDefRow label={t("detail.timestamp")}>
        <AuditMono>{`${formatDate(entry.timestamp)} ${formatTime(entry.timestamp)} IST`}</AuditMono>
      </AuditDefRow>

      <AuditDefRow label={t("detail.admin")}>
        {entry.admin.name} <AuditMono muted>({entry.admin.id})</AuditMono>
      </AuditDefRow>
      <AuditDefRow label={t("detail.action")}>
        <AuditMono>{ACTION_REGISTRY_IDS[entry.action]}</AuditMono>
      </AuditDefRow>

      <AuditDefRow label={t("detail.risk")}>
        <Pill tone={RISK_PILL_TONES[entry.riskLevel]}>{t(RISK_LABEL_KEYS[entry.riskLevel])}</Pill>
      </AuditDefRow>
      <AuditDefRow label={t("detail.target")}>
        <AuditTargetLink target={entry.target} withTypeLabel />
      </AuditDefRow>

      <AuditDefRow label={t("detail.before")}>
        <SnapshotValues snapshot={entry.before} other={entry.after} side="before" />
      </AuditDefRow>
      <AuditDefRow label={t("detail.after")}>
        <SnapshotValues snapshot={entry.after} other={entry.before} side="after" />
      </AuditDefRow>

      <AuditDefRow label={t("detail.reasonCode")} wide>
        {entry.reason ? (
          <AuditMono>{reasonKey ? t(reasonKey) : entry.reason.code}</AuditMono>
        ) : (
          <span className="text-text-3">{t("detail.noReason")}</span>
        )}
      </AuditDefRow>
      <AuditDefRow label={t("detail.note")} wide>
        {entry.reason?.note ? `“${entry.reason.note}”` : <span className="text-text-3">—</span>}
      </AuditDefRow>

      <AuditDefRow label={t("detail.evidence")} wide>
        <AuditEvidenceTags evidence={entry.evidence} />
      </AuditDefRow>

      <AuditDefRow label={t("detail.stepUp")}>
        {entry.context.stepUpVerified ? (
          <span className="flex items-center gap-s1">
            <Icon glyph={CheckCircle2} size="sm" className="text-success" />
            {t("detail.stepUpVerified")}
          </span>
        ) : (
          <span className="text-text-3">{t("detail.stepUpNotRequired")}</span>
        )}
      </AuditDefRow>
      <AuditDefRow label={t("detail.device")}>
        {entry.context.deviceName} <AuditMono muted>({entry.context.deviceId})</AuditMono>
      </AuditDefRow>

      <AuditDefRow label={t("detail.surface")}>{entry.context.surface}</AuditDefRow>
      <AuditDefRow label={t("detail.appVersion")}>
        <AuditMono>
          {entry.context.appVersion} · {entry.context.otaBundle}
        </AuditMono>
      </AuditDefRow>

      <AuditDefRow label={t("detail.location")}>{entry.context.approximateLocation}</AuditDefRow>
      <AuditDefRow label={t("detail.ip")}>
        <AuditMono>{entry.context.ipAddress}</AuditMono>
      </AuditDefRow>
    </AuditDefList>
  );
}

function SnapshotValues({
  snapshot,
  other,
  side,
}: {
  snapshot: AuditStateSnapshot;
  other: AuditStateSnapshot;
  side: "before" | "after";
}) {
  const transitions =
    side === "before" ? toTransitions(snapshot, other) : toTransitions(other, snapshot);

  return (
    <span className="flex flex-col gap-s1">
      {transitions.map((transition) => (
        <AuditMono key={transition.field}>
          {transition.field}: {side === "before" ? transition.before : transition.after}
        </AuditMono>
      ))}
    </span>
  );
}
