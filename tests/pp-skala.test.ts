import { afterEach, describe, expect, it, vi } from "vitest";

import kalibrierung from "@/data/generated/pp-skala-kalibrierung.json";
import { ppsAusArenaImpact } from "@/lib/resolve/battle-mode-arena-team-points";
import { ppAusSpielerScore } from "@/lib/resolve/battle-mode-pps-duell";
import {
  PP_SKALA_ALT_ANTEIL_MITTE,
  PP_SKALA_ALT_MAX,
  PP_SKALA_ANTEIL_MITTE,
  PP_SKALA_MAX,
  ppAusKurveSkaliert,
  ppSkalaAktiv,
  ppSkalaAnker,
  ppSkalaModus,
  skaliereUngedeckelt,
} from "@/lib/resolve/pp-skala";

// PP-SKALA-PROTOTYP (docs/design/pp-skala-18-11.md): Standard AUS, bei AUS betritt kein Aufrufer den Pfad.
const REFERENZ = { p50: 20, p995: 60 };
const ANKER = kalibrierung.disziplinen as Record<string, { rTop: number; rMed: number }>;

describe("pp-skala (Prototyp, Standard AUS)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ist ohne Umgebungsvariable aus", () => {
    vi.stubEnv("OLY_PP_SKALA", "");
    vi.stubEnv("NEXT_PUBLIC_OLY_PP_SKALA", "");
    expect(ppSkalaModus()).toBe("aus");
    expect(ppSkalaAktiv()).toBe(false);
    vi.stubEnv("OLY_PP_SKALA", "vielleicht");
    expect(ppSkalaAktiv()).toBe(false);
  });

  it("Modus roh: dieselbe Kurve wie heute, nur ohne Deckel (unterhalb des Deckels identisch)", () => {
    vi.stubEnv("OLY_PP_SKALA", "roh");
    for (const wert of [0, 3, 10, 20, 35, 59.9]) {
      const alt = ppAusSpielerScore(wert, REFERENZ);
      const roh = ppAusKurveSkaliert({ disciplineId: "tennis", wert, referenz: REFERENZ });
      expect(roh).toBe(alt);
      expect(ppsAusArenaImpact(wert, { iMittel: 20, iKrass: 60 }, PP_SKALA_ALT_MAX, PP_SKALA_ALT_ANTEIL_MITTE)).toBe(alt);
    }
    // Ueber dem alten Anker deckelt die alte Kurve bei 5,5, roh nicht.
    expect(ppAusSpielerScore(90, REFERENZ)).toBe(5.5);
    expect(ppAusKurveSkaliert({ disciplineId: "tennis", wert: 90, referenz: REFERENZ })).toBeGreaterThan(5.5);
  });

  it("Modus an: Zwei-Anker je Disziplin (R_top -> 5, R_med -> 1,25), Deckel 5, Boden 0, Entartung 0", () => {
    vi.stubEnv("OLY_PP_SKALA", "an");
    for (const [disziplin, { rTop, rMed }] of Object.entries(ANKER)) {
      const anker = ppSkalaAnker(disziplin);
      expect(anker).not.toBeNull();
      expect(skaliereUngedeckelt(disziplin, rTop)).toBe(PP_SKALA_MAX);
      expect(skaliereUngedeckelt(disziplin, rMed)).toBe(Math.round(PP_SKALA_MAX * PP_SKALA_ANTEIL_MITTE * 100) / 100);
      expect(skaliereUngedeckelt(disziplin, rTop * 3)).toBe(PP_SKALA_MAX);
      expect(skaliereUngedeckelt(disziplin, 0)).toBe(0);
    }
    // Ohne Anker: alter Wert, nur neu gedeckelt.
    expect(ppSkalaAnker("gibt-es-nicht")).toBeNull();
    expect(skaliereUngedeckelt("gibt-es-nicht", 3.21)).toBe(3.21);
    expect(ppAusKurveSkaliert({ disciplineId: "gibt-es-nicht", wert: 1000, referenz: REFERENZ })).toBe(PP_SKALA_MAX);
    expect(ppAusKurveSkaliert({ disciplineId: "gibt-es-nicht", wert: -5, referenz: REFERENZ })).toBe(0);
    expect(ppAusKurveSkaliert({ disciplineId: "gibt-es-nicht", wert: 10, referenz: null })).toBe(0);
    expect(ppAusKurveSkaliert({ disciplineId: "gibt-es-nicht", wert: 10, referenz: { p50: 60, p995: 20 } })).toBe(0);
    // Spurt-Zuschlag faellt unter denselben Deckel.
    expect(ppAusKurveSkaliert({ disciplineId: "gibt-es-nicht", wert: 1000, referenz: REFERENZ, zuschlag: 0.5 })).toBe(PP_SKALA_MAX);
  });

  it("Modus an ist monoton: die Reihenfolge innerhalb einer Disziplin bleibt", () => {
    vi.stubEnv("NEXT_PUBLIC_OLY_PP_SKALA", "an");
    for (const disziplin of [...Object.keys(ANKER), "gibt-es-nicht"]) {
      let vorher = -1;
      for (let wert = 0; wert <= 120; wert += 0.5) {
        const neu = ppAusKurveSkaliert({ disciplineId: disziplin, wert, referenz: REFERENZ });
        expect(neu).toBeGreaterThanOrEqual(vorher);
        expect(neu).toBeLessThanOrEqual(PP_SKALA_MAX);
        vorher = neu;
      }
    }
  });

  it("jede kalibrierte Disziplin hat gueltige Anker (0 < R_med < R_top)", () => {
    for (const { rTop, rMed } of Object.values(ANKER)) {
      expect(Number.isFinite(rTop) && Number.isFinite(rMed)).toBe(true);
      expect(rMed).toBeGreaterThan(0);
      expect(rTop).toBeGreaterThan(rMed);
    }
  });
});
