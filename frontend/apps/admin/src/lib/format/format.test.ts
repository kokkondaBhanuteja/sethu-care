import { describe, expect, it } from "vitest";

import {
  formatAge,
  formatDate,
  formatDateShort,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatMoneyCompact,
  formatMoneyWhole,
  formatPercent,
  formatPhone,
  formatRelative,
  formatTime,
} from "./index";

// Every expectation here is a line from Admin spec §4.7's formatting table. A change that breaks one
// of these is a change to the product's stated conventions, not a refactor.

describe("money", () => {
  it("groups in lakhs, not thousands", () => {
    // ₹2,14,500 — the Indian grouping, which is the whole reason en-IN is pinned.
    expect(formatMoney(21_450_000)).toBe("₹2,14,500.00");
  });

  it("keeps paise, because a reconcilable amount must be exact", () => {
    expect(formatMoney(149_950)).toBe("₹1,499.50");
  });

  it("drops paise for list and card amounts", () => {
    expect(formatMoneyWhole(149_900)).toBe("₹1,499");
  });

  it("abbreviates to lakh and crore for KPI tiles", () => {
    // Paise, so a lakh of rupees is 10^7 and a crore is 10^9. The units are the easy thing to get
    // wrong here, which is why they are asserted rather than assumed.
    expect(formatMoneyCompact(21_000_000)).toBe("₹2.1L");
    expect(formatMoneyCompact(1_400_000_000)).toBe("₹1.4Cr");
    expect(formatMoneyCompact(250_000)).toBe("₹2.5K");
    expect(formatMoneyCompact(45_000)).toBe("₹450");
  });

  it("trims a trailing zero rather than printing ₹2.0L", () => {
    expect(formatMoneyCompact(20_000_000)).toBe("₹2L");
  });

  it("handles zero and negatives without producing NaN", () => {
    expect(formatMoney(0)).toBe("₹0.00");
    expect(formatMoneyCompact(-21_000_000)).toBe("₹-2.1L");
  });
});

describe("dates and times, rendered IST", () => {
  // 2026-07-20T10:12:11Z is 15:42 IST. The offset is the point of the assertion: a distributed ops
  // team reading two different clocks is a source of real error (spec §4.7).
  const stamp = "2026-07-20T10:12:11.482Z";

  it("renders DD/MM/YYYY", () => {
    expect(formatDate(stamp)).toBe("20/07/2026");
  });

  it("renders the short form as DD MMM", () => {
    expect(formatDateShort(stamp)).toBe("20 Jul");
  });

  it("converts UTC to IST rather than to the machine's zone", () => {
    expect(formatTime(stamp)).toBe("3:42 pm");
  });

  it("composes the timeline stamp", () => {
    expect(formatDateTime(stamp)).toBe("20 Jul, 3:42 pm");
  });

  it("accepts a Date as readily as a string", () => {
    expect(formatDate(new Date(stamp))).toBe("20/07/2026");
  });
});

describe("relative time", () => {
  const now = new Date("2026-07-20T12:00:00.000Z");

  it("collapses the first minute to 'just now'", () => {
    expect(formatRelative("2026-07-20T11:59:31.000Z", now)).toBe("just now");
  });

  it("counts minutes, then hours", () => {
    expect(formatRelative("2026-07-20T11:58:00.000Z", now)).toBe("2m ago");
    expect(formatRelative("2026-07-20T08:00:00.000Z", now)).toBe("4h ago");
  });

  it("switches to an absolute date past a day, because '3 days ago' is a worse answer", () => {
    expect(formatRelative("2026-07-17T08:00:00.000Z", now)).toBe("17 Jul");
  });
});

describe("duration versus age", () => {
  it("keeps seconds in a duration that IS the measurement", () => {
    expect(formatDuration(192_000)).toBe("3m 12s");
    expect(formatDuration(45_000)).toBe("45s");
    expect(formatDuration(7_440_000)).toBe("2h 04m");
  });

  it("drops the seconds from a scanned age column", () => {
    const now = new Date("2026-07-20T12:00:00.000Z");
    // The queue column reads 34m, not 34m 15s: the seconds are noise that changes while it is read.
    expect(formatAge("2026-07-20T11:25:45.000Z", now)).toBe("34m");
    expect(formatAge("2026-07-20T11:59:15.000Z", now)).toBe("45s");
    expect(formatAge("2026-07-20T09:56:00.000Z", now)).toBe("2h 04m");
  });

  it("never renders a negative age from a clock skew", () => {
    const now = new Date("2026-07-20T12:00:00.000Z");
    expect(formatAge("2026-07-20T12:05:00.000Z", now)).toBe("0s");
  });
});

describe("phone and percent", () => {
  it("spaces an E.164 Indian number as the design shows it", () => {
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
  });

  it("returns anything it does not recognise untouched rather than mangling it", () => {
    expect(formatPhone("+14155550123")).toBe("+14155550123");
    expect(formatPhone("")).toBe("");
  });

  it("shows at most one decimal, because a second is noise at a glance", () => {
    expect(formatPercent(0.942)).toBe("94.2%");
    expect(formatPercent(1)).toBe("100%");
    expect(formatPercent(0.9426)).toBe("94.3%");
  });
});

describe("unrenderable dates", () => {
  // These formatters are called from ~40 screens and Intl throws on an invalid date rather than
  // returning something useless. One absent timestamp used to take down a whole route: the
  // manual-completion flow rendered a closed modal that formatted "", and died before its data
  // arrived. A missing date is worth a dash, not a lost screen.
  it.each(["", "not-a-date", "2026-13-45T99:99:99Z"])(
    "renders %o as a dash, never throws",
    (bad) => {
      expect(formatDate(bad)).toBe("—");
      expect(formatDateShort(bad)).toBe("—");
      expect(formatTime(bad)).toBe("—");
      expect(formatDateTime(bad)).toBe("—");
      expect(formatRelative(bad)).toBe("—");
      expect(formatAge(bad)).toBe("—");
    },
  );

  it("still formats a valid date, so the guard cannot swallow real values", () => {
    expect(formatDate("2026-07-20T10:12:11.482Z")).toBe("20/07/2026");
  });
});
