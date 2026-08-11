import { describe, expect, it } from "vitest";

import { getArenaAxisValueTier, getCoreStatGrade } from "@/lib/matchday-arena/arena-stat-visuals";

/**
 * Die Rang-Tier-Haelfte dieser Suite (`getArenaRankTier`, `buildArenaRankPoolSizes`,
 * `resolveArenaEntryRankPools`, `getArenaFocusEntryCardTier`) ist am 11.08.2026 mit dem
 * geprueften Code entfallen: die Funktionen hatten 0 Aufrufer ausserhalb dieser Datei. Ein
 * Test, der nur noch seine eigene Testfunktion am Leben haelt, misst nichts.
 *
 * Uebrig bleibt, was die Oberflaeche wirklich benutzt (VeloStatOrbitChip, VeloAxisRail) —
 * und die Schwellen sind an der GEMESSENEN Achsverteilung verankert (Median ~42,5).
 */
describe("arena-stat-visuals · Achsen-Einfaerbung", () => {
  it("liest den Median neutral statt rot", () => {
    expect(getArenaAxisValueTier(42.5)).toBe("mid");
    expect(getArenaAxisValueTier(50)).toBe("good");
    expect(getArenaAxisValueTier(70)).toBe("high");
    expect(getArenaAxisValueTier(20)).toBe("low");
  });

  it("faerbt nur an den Schwellen um", () => {
    expect(getArenaAxisValueTier(58)).toBe("high");
    expect(getArenaAxisValueTier(57.9)).toBe("good");
    expect(getArenaAxisValueTier(46)).toBe("good");
    expect(getArenaAxisValueTier(45.9)).toBe("mid");
    expect(getArenaAxisValueTier(30)).toBe("mid");
    expect(getArenaAxisValueTier(29.9)).toBe("low");
  });

  it("hat fuer fehlende Werte einen eigenen, stummen Zustand", () => {
    expect(getArenaAxisValueTier(null)).toBe("muted");
    expect(getArenaAxisValueTier(undefined)).toBe("muted");
    expect(getArenaAxisValueTier(Number.NaN)).toBe("muted");
  });
});

describe("arena-stat-visuals · Note fuer Kernwerte", () => {
  it("gibt dem Median ein C, nicht ein F", () => {
    expect(getCoreStatGrade(42.5)).toBe("C");
  });

  it("trifft jede Notenstufe an ihrer Schwelle", () => {
    expect(getCoreStatGrade(64)).toBe("S");
    expect(getCoreStatGrade(63.9)).toBe("A");
    expect(getCoreStatGrade(55)).toBe("A");
    expect(getCoreStatGrade(54.9)).toBe("B");
    expect(getCoreStatGrade(45)).toBe("B");
    expect(getCoreStatGrade(44.9)).toBe("C");
    expect(getCoreStatGrade(30)).toBe("C");
    expect(getCoreStatGrade(29.9)).toBe("D");
    expect(getCoreStatGrade(20)).toBe("D");
    expect(getCoreStatGrade(19.9)).toBe("F");
  });

  it("wertet einen fehlenden Wert als F, nicht als Luecke", () => {
    expect(getCoreStatGrade(null)).toBe("F");
    expect(getCoreStatGrade(Number.NaN)).toBe("F");
  });
});
