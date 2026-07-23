import { describe, expect, it } from "vitest";

import type {
  ProviderProfile as ApiProviderProfile,
  ProviderRosterRow as ApiProviderRosterRow,
} from "@sethu/api-client";

import {
  documentTypeKeyFor,
  flagLineFor,
  mapProviderActiveJob,
  mapProviderProfile,
  mapRosterRow,
  stageLabelFor,
  toListProvidersParams,
} from "./providers.api.map";
import {
  newIdempotencyKey,
  toRequestDocumentsRequest,
  toSuspendProviderRequest,
} from "./providers.api.requests";
import { API_ERROR_CODES } from "../../lib/http/apiError";
import { isApiError } from "../../lib/http/apiError";
import { REJECT_STATUS_FAILURES, SUSPEND_STATUS_FAILURES, unwrap } from "./providers.api.errors";
import { DOCUMENT_TYPE_KEYS } from "./providers.types";
import { SUSPEND_ACTION_TYPES, SUSPEND_REASON_CODES } from "./suspend.types";
import type { SuspendProviderInput } from "./suspend.types";

function rosterRow(overrides: Partial<ApiProviderRosterRow> = {}): ApiProviderRosterRow {
  return {
    id: "c1000000-0000-4000-8000-000000000001",
    name: "Ravi Chandra",
    status: "free",
    skills: ["Electrical"],
    zone: "Kompally",
    jobsToday: 2,
    earningsTodayPaise: 180_000,
    rating: 4.8,
    completionRate: 0.97,
    lastSeenAt: null,
    ...overrides,
  };
}

function profile(overrides: Partial<ApiProviderProfile> = {}): ApiProviderProfile {
  return {
    id: "c1000000-0000-4000-8000-000000000001",
    name: "Ravi Chandra",
    phone: "+919000000011",
    status: "free",
    isVerified: true,
    rating: 4.8,
    jobsTotal: 132,
    joinedAt: "2025-11-02T05:30:00Z",
    zone: "Kompally",
    zones: ["Kompally"],
    jobsToday: 2,
    earningsTodayPaise: 180_000,
    skills: [{ name: "Electrical", isPending: false }],
    documents: [{ id: "doc-1", type: "POLICE_VERIFICATION", state: "verified" }],
    metrics: [],
    recentJobs: [],
    feedback: [],
    flags: [],
    payoutCyclePaise: 4_200_000,
    version: 0,
    ...overrides,
  };
}

describe("toListProvidersParams", () => {
  it("omits an empty search and always caps the page", () => {
    expect(toListProvidersParams({ segment: "online", search: "" })).toEqual({
      segment: "online",
      limit: 100,
    });
    expect(toListProvidersParams({ segment: "all", search: "Kompally" })).toEqual({
      segment: "all",
      search: "Kompally",
      limit: 100,
    });
  });
});

describe("mapRosterRow", () => {
  it("builds the stage label from structured data, without an ETA when it is null", () => {
    expect(stageLabelFor({ bookingId: "b-1", stage: "en_route", etaMinutes: 8 })).toBe(
      "En route · ETA 8m",
    );
    // The live backend sends null without location data — the label stays honest.
    expect(stageLabelFor({ bookingId: "b-1", stage: "en_route", etaMinutes: null })).toBe(
      "En route",
    );
    expect(stageLabelFor({ bookingId: "b-1", stage: "in_progress", etaMinutes: null })).toBe(
      "In progress",
    );
  });

  it("keeps lastSeenAt null (reporting right now) and copies the current job", () => {
    const mapped = mapRosterRow(
      rosterRow({
        status: "on_job",
        currentJob: { bookingId: "b-9", stage: "in_progress", etaMinutes: null },
      }),
    );
    expect(mapped.lastSeenAt).toBeNull();
    expect(mapped.currentJob).toEqual({ bookingId: "b-9", stageLabel: "In progress" });
    expect(mapped.suspendedUntil).toBeUndefined();
  });
});

describe("mapProviderProfile", () => {
  it("maps document types onto the i18n vocabulary and keeps honest empties empty", () => {
    const mapped = mapProviderProfile(profile());
    expect(mapped.documents[0]?.typeKey).toBe(DOCUMENT_TYPE_KEYS.policeVerification);
    expect(mapped.flags).toEqual([]);
    expect(mapped.metrics).toEqual([]);
    expect(mapped.suspension).toBeUndefined();
    expect(mapped.version).toBe(0);
  });

  it("renders a structured flag as the profile's free-text line", () => {
    expect(flagLineFor({ code: "late_arrival", count: 2, windowDays: 30 })).toBe(
      "2 late arrivals in 30 days",
    );
  });

  it("covers every wire document type", () => {
    expect(documentTypeKeyFor("BANK_PASSBOOK")).toBe(DOCUMENT_TYPE_KEYS.bankPassbook);
    expect(documentTypeKeyFor("AADHAAR_CARD")).toBe(DOCUMENT_TYPE_KEYS.aadhaarCard);
  });
});

describe("mapProviderActiveJob", () => {
  it("keeps the optional ETA and start time only when sent", () => {
    const mapped = mapProviderActiveJob({
      bookingId: "b-1",
      stage: "en_route",
      service: "Plumbing",
      customerName: "Anita Sharma",
      zone: "Gachibowli",
      amountPaise: 89_900,
      suggestedProviderName: "Kiran Rao",
    });
    expect(mapped.etaMinutes).toBeUndefined();
    expect(mapped.startedAt).toBeUndefined();
    expect(mapped.suggestedProviderName).toBe("Kiran Rao");
  });
});

describe("toSuspendProviderRequest", () => {
  const input: SuspendProviderInput = {
    providerId: "c1-1",
    version: 3,
    type: SUSPEND_ACTION_TYPES.suspend,
    durationDays: 7,
    reasonCode: SUSPEND_REASON_CODES.poorQuality,
    note: "Repeated complaints",
    jobResolutions: { "b-1": "reassign", "b-2": undefined },
    notifyImmediately: true,
  };

  it("strips undecided job resolutions rather than defaulting them", () => {
    const request = toSuspendProviderRequest(input);
    expect(request.jobResolutions).toEqual({ "b-1": "reassign" });
    expect(request.version).toBe(3);
    expect(request.type).toBe("suspend");
    expect(request.durationDays).toBe(7);
  });
});

describe("toRequestDocumentsRequest", () => {
  it("translates the i18n vocabulary back into wire codes", () => {
    const request = toRequestDocumentsRequest({
      applicationId: "app-1",
      version: 1,
      applicantName: "Chetan Naik",
      documentTypeKeys: [DOCUMENT_TYPE_KEYS.bankPassbook, DOCUMENT_TYPE_KEYS.policeVerification],
    });
    expect(request.documentTypes).toEqual(["BANK_PASSBOOK", "POLICE_VERIFICATION"]);
    expect(request.version).toBe(1);
  });
});

describe("newIdempotencyKey", () => {
  it("mints a fresh key per call", () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });
});

describe("unwrap", () => {
  it("returns the payload untouched on success", () => {
    expect(unwrap({ data: { ok: true } }, "failed")).toEqual({ ok: true });
  });

  it("curates VERSION_CONFLICT as a conflict, never the server's own text", () => {
    const thrown = capture(() =>
      unwrap(
        {
          error: { code: "VERSION_CONFLICT", currentVersion: 4, message: "the record moved" },
          response: { status: 409, statusText: "Conflict" },
        },
        "failed",
      ),
    );
    expect(isApiError(thrown) && thrown.code).toBe(API_ERROR_CODES.conflict);
    expect(isApiError(thrown) && thrown.message).toContain("changed while you were working");
  });

  it("curates ALREADY_DECIDED as a conflict so the review re-reads into the banner", () => {
    const thrown = capture(() =>
      unwrap(
        {
          error: {
            code: "ALREADY_DECIDED",
            message: "another admin decided first",
            decision: { outcome: "approved", byName: "Priya", at: "2026-07-22T09:00:00Z" },
          },
          response: { status: 409, statusText: "Conflict" },
        },
        "failed",
      ),
    );
    expect(isApiError(thrown) && thrown.code).toBe(API_ERROR_CODES.conflict);
    expect(isApiError(thrown) && thrown.message).toContain("already decided");
  });

  it("lands the reject 422 on the note field with a curated sentence", () => {
    const thrown = capture(() =>
      unwrap(
        {
          // The transport's generic 422 body carries no code/fields — curated per operation.
          error: { title: "Unprocessable Entity", status: 422, detail: "providerops: note" },
          response: { status: 422, statusText: "Unprocessable Entity" },
        },
        "This application could not be rejected.",
        REJECT_STATUS_FAILURES,
      ),
    );
    expect(isApiError(thrown) && thrown.code).toBe(API_ERROR_CODES.validation);
    expect(isApiError(thrown) && thrown.fieldErrors?.note).toBe("At least 20 characters.");
    expect(isApiError(thrown) && thrown.message).toContain("at least 20 characters");
  });

  it("curates the suspend 422 and falls back to the operation sentence elsewhere", () => {
    const unresolved = capture(() =>
      unwrap(
        { response: { status: 422, statusText: "Unprocessable Entity" } },
        "The suspension could not be applied.",
        SUSPEND_STATUS_FAILURES,
      ),
    );
    expect(isApiError(unresolved) && unresolved.message).toContain("still unresolved");

    const server = capture(() =>
      unwrap(
        { response: { status: 500, statusText: "Internal Server Error" } },
        "The suspension could not be applied.",
        SUSPEND_STATUS_FAILURES,
      ),
    );
    expect(isApiError(server) && server.code).toBe(API_ERROR_CODES.server);
    // Never the status text — the operation's own sentence.
    expect(isApiError(server) && server.message).toBe("The suspension could not be applied.");
  });
});

function capture(run: () => unknown): unknown {
  try {
    run();
  } catch (thrown) {
    return thrown;
  }
  throw new Error("expected unwrap to throw");
}
