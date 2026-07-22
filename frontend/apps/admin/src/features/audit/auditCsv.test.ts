import { describe, expect, it } from "vitest";

import { RISK_LEVELS } from "../../lib/permissions/actions";
import { auditCsvFilename, buildAuditCsv, type AuditCsvHeaders } from "./auditCsv";
import { AUDIT_ACTIONS, AUDIT_SURFACES, AUDIT_TARGET_TYPES, type AuditEntry } from "./audit.types";

const BOM = "\uFEFF";

const HEADERS: AuditCsvHeaders = {
  entryId: "Entry ID",
  timestamp: "Timestamp",
  admin: "Admin",
  action: "Action",
  target: "Target",
  change: "Change",
  reason: "Reason",
};

/** A full §10.4-shaped entry; the CSV must never depend on optional-by-convenience fields. */
function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: "aud_4c81de20",
    timestamp: "2026-07-20T10:12:11.482Z",
    admin: { id: "adm_011", name: "Priya Sharma", email: "priya@setucare.in" },
    action: AUDIT_ACTIONS.paymentRefund,
    riskLevel: RISK_LEVELS.high,
    target: { type: AUDIT_TARGET_TYPES.booking, id: "bkg_8790", reference: "#B-8790" },
    before: { refunded: "₹0" },
    after: { refunded: "₹1,499" },
    reason: { code: "POOR_SERVICE_QUALITY", note: 'Customer said "not done", left early' },
    evidence: { photoIds: [], callLogIds: [], reportIds: [] },
    context: {
      surface: AUDIT_SURFACES.desktop,
      appVersion: "1.4.0",
      otaBundle: "ota_218",
      deviceId: "dev_9f2",
      deviceName: "MacBook Pro",
      ipAddress: "103.24.56.10",
      approximateLocation: "Hyderabad, IN",
      stepUpVerified: true,
    },
    immutable: true,
    compensatesEntryId: null,
    compensatedByEntryId: null,
    ...overrides,
  };
}

describe("buildAuditCsv", () => {
  it("renders a BOM, one header row and one quoted row per entry, timestamps in IST en-IN", () => {
    const csv = buildAuditCsv([makeEntry()], HEADERS);
    const rows = csv.split("\r\n");

    expect(csv.startsWith(BOM)).toBe(true);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(
      `${BOM}"Entry ID","Timestamp","Admin","Action","Target","Change","Reason"`,
    );
    // 10:12 UTC is 3:42 pm IST; the date renders DD/MM/YYYY (en-IN, spec §4.7).
    expect(rows[1]).toContain('"20/07/2026 3:42 pm IST"');
    expect(rows[1]).toContain('"aud_4c81de20"');
    expect(rows[1]).toContain('"Priya Sharma"');
    expect(rows[1]).toContain(`"${AUDIT_ACTIONS.paymentRefund}"`);
    expect(rows[1]).toContain('"#B-8790"');
    expect(rows[1]).toContain('"₹0 → ₹1,499"');
    expect(rows[1]).toContain('"POOR_SERVICE_QUALITY"');
  });

  it("escapes embedded quotes by doubling them and leaves absent reasons empty", () => {
    const withQuotes = makeEntry({
      target: { type: AUDIT_TARGET_TYPES.payment, id: "pay_11", reference: 'PAY-"11"' },
      reason: null,
    });

    const csv = buildAuditCsv([withQuotes], HEADERS);
    const dataRow = csv.split("\r\n")[1] ?? "";

    expect(dataRow).toContain('"PAY-""11"""');
    expect(dataRow.endsWith(',""')).toBe(true);
  });
});

describe("auditCsvFilename", () => {
  it("stamps the export with the ISO date", () => {
    expect(auditCsvFilename(new Date("2026-07-23T09:00:00Z"))).toBe("audit-log-2026-07-23.csv");
  });
});
