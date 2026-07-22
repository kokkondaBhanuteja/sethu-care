import { useIsDesktop } from "../hooks/useBreakpoint";
import { AuditLogScreenDesktop } from "../features/audit/AuditLogScreen.desktop";
import { AuditLogScreenMobile } from "../features/audit/AuditLogScreen.mobile";
import { AuditEntryScreenMobile } from "../features/audit/AuditEntryScreen.mobile";
import { useAuditSelection } from "../features/audit/useAuditEntry";

/**
 * `/audit`. Desktop keeps the entry beside the ledger; mobile pushes it as its own screen. Both are
 * the same `?entry=` selection rendered differently, so a link to a disputed action opens on either.
 */
export default function AuditLogPage() {
  const isDesktop = useIsDesktop();
  const { selectedId, select, clearSelection } = useAuditSelection();

  if (isDesktop) return <AuditLogScreenDesktop />;

  if (selectedId) {
    return (
      <AuditEntryScreenMobile entryId={selectedId} onBack={clearSelection} onOpenEntry={select} />
    );
  }

  return <AuditLogScreenMobile onSelect={select} />;
}
