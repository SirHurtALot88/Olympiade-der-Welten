import { describe, expect, it } from "vitest";

import {
  formatGermanDate,
  formatGermanDateTime,
  formatGermanSaveTimestamp,
  GERMAN_TIME_ZONE,
} from "@/lib/utils/format-datetime";

describe("format-datetime (German wall-clock, explicit timeZone)", () => {
  it("uses Europe/Berlin as the shared timezone constant", () => {
    expect(GERMAN_TIME_ZONE).toBe("Europe/Berlin");
  });

  it("renders a summer UTC instant as MESZ (+2) regardless of the host's ambient timezone", () => {
    // 2026-07-26T12:00:00Z is during German summer time (MESZ, UTC+2) -> 14:00 local.
    expect(formatGermanDateTime("2026-07-26T12:00:00Z")).toBe("26.7.2026, 14:00:00");
  });

  it("renders a winter UTC instant as MEZ (+1) regardless of the host's ambient timezone", () => {
    // 2026-01-15T12:00:00Z is during German winter time (MEZ, UTC+1) -> 13:00 local.
    expect(formatGermanDateTime("2026-01-15T12:00:00Z")).toBe("15.1.2026, 13:00:00");
  });

  it("accepts Date instances and millisecond timestamps, not just ISO strings", () => {
    const instant = new Date("2026-07-26T12:00:00Z");
    expect(formatGermanDateTime(instant)).toBe("26.7.2026, 14:00:00");
    expect(formatGermanDateTime(instant.getTime())).toBe("26.7.2026, 14:00:00");
  });

  it("formats date-only output in German wall-clock time", () => {
    // Just before midnight UTC still falls on the next German calendar day in summer (+2).
    expect(formatGermanDate("2026-07-25T23:00:00Z")).toBe("26.7.2026");
    expect(formatGermanDate("2026-01-15T12:00:00Z")).toBe("15.1.2026");
  });

  it("formats the short save-name timestamp with day/month/hour/minute in German local time", () => {
    expect(formatGermanSaveTimestamp("2026-07-26T12:00:00Z")).toBe("26.07., 14:00");
    expect(formatGermanSaveTimestamp("2026-01-15T12:00:00Z")).toBe("15.01., 13:00");
  });

  it("lets callers override format fields while keeping the timeZone fixed to Europe/Berlin", () => {
    const formatted = formatGermanDateTime("2026-07-26T12:00:00Z", { hour: "2-digit", minute: "2-digit" });
    expect(formatted).toBe("14:00");
  });
});
