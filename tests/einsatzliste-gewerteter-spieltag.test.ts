import { describe, expect, it } from "vitest";

import { buildLineupFlowSummary } from "@/lib/lineups/lineup-audit";

/**
 * EIN GEWERTETER SPIELTAG HAT KEINEN NAECHSTEN SCHRITT — Befund B2, zweiter Teil, aus
 * `docs/AUDIT-INGAME-2026-08-19.md`.
 *
 * CHRIS: „mach mit B2 weiter."
 *
 * GEMESSEN am echten Spielstand (Saison 1, Spieltag 10, beide Disziplinen gewertet, Saison
 * abgeschlossen): die Einsatzliste sagte „Lineup speichern" und darueber „ERWARTETE PUNKTE
 * 306,6–356,6". Beides Zukunftsform ueber etwas, das gelaufen und gebucht ist.
 *
 * KEIN DATENRISIKO — nachgemessen, nicht angenommen: nach „Optimieren" ist die
 * Spielstand-Datei md5-identisch, der Aufstellungs-Entwurf hat denselben Hash, und „Lineup
 * speichern" war ohnehin nur ein Hinweistext (`<span class="nl-lineup-nextstep">`), kein Knopf.
 * Der Schaden ist die Aufforderung selbst: sie schickt den Spieler auf einen Weg, der nirgends
 * hinfuehrt.
 */

function eingabe(overrides: Record<string, unknown> = {}) {
  return {
    activeSlot: null,
    captainBudgetExceeded: false,
    captainDraftUsedCount: 0,
    captainSeasonLimit: 3,
    captainUsedBeforeCurrentDraft: 0,
    captains: { d1: "p1", d2: "p2" },
    d1RequiredPlayers: 4,
    d2RequiredPlayers: 5,
    hasDraft: true,
    duplicateSelectionsCount: 0,
    lineupMetaD1Selected: 4,
    lineupMetaD2Selected: 5,
    moraleAtRiskCount: 0,
    moraleNetDelta: 0,
    lineupReadyToSave: true,
    openSlots: 0,
    ...overrides,
  } as Parameters<typeof buildLineupFlowSummary>[0];
}

describe("Einsatzliste: ein gewerteter Spieltag spricht in der Vergangenheit", () => {
  it("sagt „Spieltag gewertet“ statt „Lineup speichern“", () => {
    const summary = buildLineupFlowSummary(eingabe({ matchdayAlreadyScored: true }));
    expect(summary.nextStep.label).toBe("Spieltag gewertet");
    expect(summary.nextStep.label).not.toBe("Lineup speichern");
    expect(summary.matchdayAlreadyScored).toBe(true);
  });

  it("nennt den Grund, statt nur die Aufforderung wegzunehmen", () => {
    const summary = buildLineupFlowSummary(eingabe({ matchdayAlreadyScored: true }));
    expect(summary.nextStep.detail).toContain("Die Punkte stehen");
  });

  it("schlägt jede andere Aufgabe — die sind an einem gewerteten Spieltag Geschichte", () => {
    /*
     * Der Zweig steht bewusst GANZ VORNE. Offene Slots, doppelte Spieler oder ein gerissenes
     * Captain-Limit sind nach der Wertung keine Aufgaben mehr; sie als naechsten Schritt
     * anzubieten waere derselbe Fehler in gruen.
     */
    for (const lage of [
      { openSlots: 3 },
      { duplicateSelectionsCount: 2 },
      { captainBudgetExceeded: true },
      { moraleAtRiskCount: 2, moraleNetDelta: -5 },
    ]) {
      const summary = buildLineupFlowSummary(eingabe({ ...lage, matchdayAlreadyScored: true }));
      expect({ lage, label: summary.nextStep.label }).toEqual({ lage, label: "Spieltag gewertet" });
    }
  });

  it("lässt einen offenen Spieltag völlig unverändert", () => {
    // Gegenprobe in der Sache: ohne Wertung muss die alte Kette Zeile fuer Zeile gelten.
    expect(buildLineupFlowSummary(eingabe({ openSlots: 3 })).nextStep.label).toBe("Slots füllen");
    expect(buildLineupFlowSummary(eingabe({ duplicateSelectionsCount: 2 })).nextStep.label).toBe(
      "Doppelte Spieler lösen",
    );
    expect(buildLineupFlowSummary(eingabe()).nextStep.label).toBe("Lineup speichern");
    expect(buildLineupFlowSummary(eingabe()).matchdayAlreadyScored).toBe(false);
  });

  it("das Feld fehlt nie — die Anzeige muss sich darauf verlassen können", () => {
    // `matchdayAlreadyScored` ist im Eingang optional; in der Ausgabe darf es das nicht sein,
    // sonst muesste jede Anzeige selbst raten.
    expect(buildLineupFlowSummary(eingabe()).matchdayAlreadyScored).toBe(false);
  });
});
