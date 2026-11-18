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

// PP-SKALA C2 (docs/design/pp-skala-18-11.md): die Skala kommt aus dem Saison-Stempel
// (lib/resolve/wertungs-skalen.ts); ohne Stempel (alte Saison) betritt kein Aufrufer den neuen Pfad.
const REFERENZ = { p50: 20, p995: 60 };
const ANKER = kalibrierung.disziplinen as Record<string, { rTop: number; rMed: number; feldgroessen?: Record<string, { rTop: number; rMed: number }> }>;
const C2_SAISON = { seasonState: { seasonId: "season-1", wertungsSkalen: { seasonId: "season-1", pp: "c2" as const, ergebnis: "e1" as const } } };

describe("pp-skala C2", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ohne Stempel aus, mit C2-Stempel an", () => {
    vi.stubEnv("OLY_PP_SKALA", "");
    vi.stubEnv("NEXT_PUBLIC_OLY_PP_SKALA", "");
    expect(ppSkalaModus()).toBe("aus");
    expect(ppSkalaAktiv()).toBe(false);
    expect(ppSkalaModus(C2_SAISON)).toBe("an");
    vi.stubEnv("OLY_PP_SKALA", "vielleicht");
    expect(ppSkalaAktiv()).toBe(false);
    expect(ppSkalaAktiv(C2_SAISON)).toBe(true);
  });

  it("Modus roh: dieselbe Kurve wie heute, nur ohne Deckel (unterhalb des Deckels identisch)", () => {
    vi.stubEnv("OLY_PP_SKALA", "roh");
    for (const wert of [0, 3, 10, 20, 35, 59.9]) {
      const alt = ppAusSpielerScore(wert, REFERENZ);
      const roh = ppAusKurveSkaliert({ disciplineId: "tennis", wert, referenz: REFERENZ, modus: ppSkalaModus() });
      expect(roh).toBe(alt);
      expect(ppsAusArenaImpact(wert, { iMittel: 20, iKrass: 60 }, PP_SKALA_ALT_MAX, PP_SKALA_ALT_ANTEIL_MITTE)).toBe(alt);
    }
    // Ueber dem alten Anker deckelt die alte Kurve bei 5,5, roh nicht.
    expect(ppAusSpielerScore(90, REFERENZ)).toBe(5.5);
    expect(ppAusKurveSkaliert({ disciplineId: "tennis", wert: 90, referenz: REFERENZ, modus: "roh" })).toBeGreaterThan(5.5);
  });

  it("Modus an: Zwei-Anker je Disziplin und Feldgroesse (R_top -> 5, R_med -> 1,25), Deckel 5, Boden 0, Entartung 0", () => {
    for (const [disziplin, { rTop, rMed, feldgroessen }] of Object.entries(ANKER)) {
      const anker = ppSkalaAnker(disziplin);
      expect(anker).not.toBeNull();
      expect(skaliereUngedeckelt(disziplin, rTop)).toBe(PP_SKALA_MAX);
      expect(skaliereUngedeckelt(disziplin, rMed)).toBe(Math.round(PP_SKALA_MAX * PP_SKALA_ANTEIL_MITTE * 100) / 100);
      expect(skaliereUngedeckelt(disziplin, rTop * 3)).toBe(PP_SKALA_MAX);
      expect(skaliereUngedeckelt(disziplin, 0)).toBe(0);
      for (const [n, f] of Object.entries(feldgroessen ?? {})) {
        expect(ppSkalaAnker(disziplin, Number(n))?.rTop).toBe(f.rTop);
        expect(skaliereUngedeckelt(disziplin, f.rTop, 0, { playerCount: Number(n) })).toBe(PP_SKALA_MAX);
        expect(skaliereUngedeckelt(disziplin, f.rMed, 0, { playerCount: Number(n) })).toBe(Math.round(PP_SKALA_MAX * PP_SKALA_ANTEIL_MITTE * 100) / 100);
      }
      // Eine nicht gezogene Feldgroesse faellt auf die Disziplin-weiten Anker.
      expect(ppSkalaAnker(disziplin, 99)?.rTop).toBe(rTop);
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
    for (const disziplin of [...Object.keys(ANKER), "gibt-es-nicht"]) {
      let vorher = -1;
      for (let wert = 0; wert <= 120; wert += 0.5) {
        const neu = ppAusKurveSkaliert({ disciplineId: disziplin, wert, referenz: REFERENZ, playerCount: 3 });
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
