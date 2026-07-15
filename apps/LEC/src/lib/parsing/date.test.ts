import { describe, expect, it } from "vitest";
import {
  classifyWindow,
  parseBillbeeZeitraum,
  parseEbayReportDateRange,
  parseGermanDDMMYYYY,
} from "./date";

describe("parseGermanDDMMYYYY", () => {
  it("parst TT.MM.JJJJ", () => {
    const d = parseGermanDDMMYYYY("15.06.2026");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(5);
    expect(d.getUTCDate()).toBe(15);
  });

  it("wirft bei ungueltigem Format", () => {
    expect(() => parseGermanDDMMYYYY("2026-06-15")).toThrow();
  });
});

describe("parseBillbeeZeitraum", () => {
  it("liest von/bis aus dem Zeitraum-Feld", () => {
    const { from, to } = parseBillbeeZeitraum("15.06.2026 - 15.07.2026");
    expect(from.getUTCDate()).toBe(15);
    expect(from.getUTCMonth()).toBe(5);
    expect(to.getUTCMonth()).toBe(6);
  });

  it("funktioniert fuer den Lebenszeit-Zeitraum", () => {
    const { from, to } = parseBillbeeZeitraum("16.01.2021 - 15.07.2026");
    expect(from.getUTCFullYear()).toBe(2021);
    expect(to.getUTCFullYear()).toBe(2026);
  });
});

describe("parseEbayReportDateRange", () => {
  it("liest den deutschen Berichtszeitraum", () => {
    const range = parseEbayReportDateRange("Bericht vom 1. Jan 2026 bis 15. Jul 2026");
    expect(range).not.toBeNull();
    expect(range!.from.getUTCMonth()).toBe(0);
    expect(range!.to.getUTCMonth()).toBe(6);
    expect(range!.to.getUTCDate()).toBe(15);
  });

  it("gibt null bei unlesbarem Text zurueck", () => {
    expect(parseEbayReportDateRange("irgendein Text ohne Datum")).toBeNull();
  });
});

describe("classifyWindow", () => {
  it("klassifiziert 30/90/365/all korrekt", () => {
    expect(classifyWindow(new Date("2026-06-15"), new Date("2026-07-15"))).toBe("30");
    expect(classifyWindow(new Date("2026-04-15"), new Date("2026-07-15"))).toBe("90");
    expect(classifyWindow(new Date("2025-07-16"), new Date("2026-07-15"))).toBe("365");
    expect(classifyWindow(new Date("2021-01-16"), new Date("2026-07-15"))).toBe("all");
  });
});
