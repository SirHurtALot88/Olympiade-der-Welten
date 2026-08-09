/**
 * APRON-SERVICE — Gummiband gegen "Reich wird reicher" (siehe lib/season/apron-service.ts).
 *
 * Geprueft werden genau die Kriterien aus dem Entwurf (Stand nach der Nutzer-Entscheidung
 * "Empfaenger-Deckel raus" in PR #468 — der Topf wird vollstaendig verteilt):
 *  1. Konjunkturhebel: 0 bei f <= 0,95, 1 bei f >= 1,24, linear dazwischen.
 *  2. Deckel greift NUR auf der Abgabe-Seite: ein Team mit hohem Gehalt und kleinem
 *     Wertungsanteil zahlt hoechstens die Haelfte davon.
 *  3. Erhaltung: Σ Abgaben = Topf = Σ Ausgleiche, Σ Netto = 0 — IMMER; es entsteht und
 *     verschwindet kein Geld.
 *  4. Referenz-Fallback: bei leerer Liga stehen die Linien auf 64,9 × 1,10 bzw. × 1,28.
 *  5. Ein Team genau auf einer Linie zahlt nichts (Grenzfall).
 *  6. Vollstaendige Ausschuettung: die Empfaenger teilen den GANZEN Topf zu gleichen
 *     Kopfteilen, unabhaengig vom Rang. Randfall: ohne einen einzigen Empfaenger wird auch
 *     nichts eingesammelt (bestraft wird nur, was umverteilt werden kann).
 */
import { describe, expect, it } from "vitest";

import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import {
  APRON_CAP_SHARE_OF_RANK_PAYOUT,
  APRON_KONJUNKTUR_FACTOR_MAX,
  APRON_KONJUNKTUR_FACTOR_MIN,
  APRON_LINE_1_MEDIAN_FACTOR,
  APRON_LINE_2_MEDIAN_FACTOR,
  SPONSOR_V3_REFERENCE_SALARY_PER_TEAM,
  apronKonjunkturhebel,
  apronWertungsanteil,
  computeApronLines,
  computeApronSettlement,
  type ApronTeamInput,
} from "@/lib/season/apron-service";

describe("Apron — Konjunkturhebel", () => {
  it("ist 0 bei f <= 0,95", () => {
    expect(apronKonjunkturhebel(0.95)).toBe(0);
    expect(apronKonjunkturhebel(0.82)).toBe(0);
    expect(apronKonjunkturhebel(0)).toBe(0);
  });

  it("ist 1 bei f >= 1,24", () => {
    expect(apronKonjunkturhebel(1.24)).toBe(1);
    expect(apronKonjunkturhebel(1.5)).toBe(1);
  });

  it("ist linear dazwischen", () => {
    const mid = (APRON_KONJUNKTUR_FACTOR_MIN + APRON_KONJUNKTUR_FACTOR_MAX) / 2;
    expect(apronKonjunkturhebel(mid)).toBeCloseTo(0.5, 9);
    // Ein Viertel des Wegs von 0,95 nach 1,24.
    const quarter = APRON_KONJUNKTUR_FACTOR_MIN + (APRON_KONJUNKTUR_FACTOR_MAX - APRON_KONJUNKTUR_FACTOR_MIN) * 0.25;
    expect(apronKonjunkturhebel(quarter)).toBeCloseTo(0.25, 9);
  });

  it("klammert statt zu extrapolieren", () => {
    expect(apronKonjunkturhebel(Number.NaN)).toBe(0);
    expect(apronKonjunkturhebel(-1)).toBe(0);
    expect(apronKonjunkturhebel(99)).toBe(1);
  });
});

describe("Apron — Linien und Referenz-Fallback", () => {
  it("Season-1/leere Liga: Linien stehen auf 64,9 × 1,10 bzw. × 1,28", () => {
    const gs = structuredClone(createSingleplayerGameState());
    gs.rosters = [];
    const lines = computeApronLines(gs);
    expect(lines.usedReferenceSalary).toBe(true);
    // Linien werden beim Einfrieren auf 1 Nachkommastelle gerundet (Anzeige-/Buchungsgenauigkeit) —
    // Toleranz 1 Nachkommastelle statt exakter Gleichheit.
    expect(lines.medianSalary).toBeCloseTo(SPONSOR_V3_REFERENCE_SALARY_PER_TEAM, 1);
    expect(lines.line1).toBeCloseTo(SPONSOR_V3_REFERENCE_SALARY_PER_TEAM * APRON_LINE_1_MEDIAN_FACTOR, 1);
    expect(lines.line2).toBeCloseTo(SPONSOR_V3_REFERENCE_SALARY_PER_TEAM * APRON_LINE_2_MEDIAN_FACTOR, 1);
  });
});

function buildTeam(teamId: string, salary: number, rankShare: number): ApronTeamInput {
  return { teamId, salary, rankShare };
}

describe("Apron — Abgaben und Ausgleiche", () => {
  const lines = { line1: 70, line2: 90 };

  it("Topf ist exakt 0, wenn der Konjunkturhebel 0 ist (f=0,82), unabhängig vom Gehalt", () => {
    const teams = [buildTeam("A", 200, 500), buildTeam("B", 40, 10)];
    const settlement = computeApronSettlement({ lines, salaryFactor: 0.82, teams });
    expect(settlement.topf).toBe(0);
    expect(settlement.zahlerCount).toBe(0);
  });

  it("ein Team GENAU auf der 1. Linie zahlt nichts und bekommt nichts (Grenzfall)", () => {
    const teams = [buildTeam("A", lines.line1, 200), buildTeam("B", 40, 10)];
    const settlement = computeApronSettlement({ lines, salaryFactor: 1.24, teams });
    const onLine = settlement.rows.find((row) => row.teamId === "A")!;
    expect(onLine.abgabe).toBe(0);
    expect(onLine.ausgleich).toBe(0);
  });

  it("ein Team GENAU auf der 2. Linie zahlt nur den Zone-1-Satz, nicht den Zone-2-Satz", () => {
    const teams = [buildTeam("A", lines.line2, 500)];
    const settlement = computeApronSettlement({ lines, salaryFactor: 1.24, teams });
    const row = settlement.rows[0]!;
    expect(row.ueberLinie2).toBe(0);
    expect(row.ueberLinie1).toBeCloseTo(lines.line2 - lines.line1, 9);
  });

  it("Deckel greift: hohes Gehalt, kleiner Wertungsanteil zahlt höchstens die Hälfte davon", () => {
    // Extremfall: Gehalt weit über Linie 2, aber ein winziger Wertungsanteil (schlechter Endrang).
    const rankShare = 4;
    const teams = [buildTeam("Ueberzahler", 500, rankShare), buildTeam("Sparer", 40, 500)];
    const settlement = computeApronSettlement({ lines, salaryFactor: 1.24, teams });
    const row = settlement.rows.find((entry) => entry.teamId === "Ueberzahler")!;
    // Die rohe (ungedeckelte) Abgabe muss den Deckel tatsächlich reißen — sonst testet der Fall den
    // Deckel gar nicht.
    expect(row.rohAbgabe).toBeGreaterThan(APRON_CAP_SHARE_OF_RANK_PAYOUT * rankShare);
    expect(row.abgabe).toBeCloseTo(APRON_CAP_SHARE_OF_RANK_PAYOUT * rankShare, 9);
    expect(row.abgabe).toBeLessThanOrEqual(rankShare * 0.5 + 1e-9);
  });

  it("Erhaltung: Σ Abgaben = Topf = Σ Ausgleiche und Σ Netto = 0, über mehrere Konstellationen", () => {
    const configs: ApronTeamInput[][] = [
      [buildTeam("A", 150, 300), buildTeam("B", 40, 400), buildTeam("C", 60, 350), buildTeam("D", 95, 120)],
      // Empfänger B mit winzigem Wertungsanteil — sein Kopfanteil ist trotzdem der volle
      // (kein Empfänger-Deckel mehr), die Erhaltung gilt exakt.
      [buildTeam("A", 150, 300), buildTeam("B", 40, 5), buildTeam("C", 60, 40), buildTeam("D", 95, 120)],
      Array.from({ length: 32 }, (_, index) =>
        buildTeam(`T${index}`, 30 + index * 3, Math.max(1, 200 - index * 6)),
      ),
      [buildTeam("Solo", 30, 10)],
    ];
    for (const teams of configs) {
      for (const salaryFactor of [0.82, 1.0, 1.1, 1.24]) {
        const settlement = computeApronSettlement({ lines, salaryFactor, teams });
        const totalAbgabe = settlement.rows.reduce((sum, row) => sum + row.abgabe, 0);
        const totalAusgleich = settlement.rows.reduce((sum, row) => sum + row.ausgleich, 0);
        expect(totalAusgleich).toBeCloseTo(totalAbgabe, 9);
        expect(totalAbgabe).toBeCloseTo(settlement.topf, 9);
        expect(settlement.rows.reduce((sum, row) => sum + row.nettoDelta, 0)).toBeCloseTo(0, 9);
      }
    }
  });

  it("Randfall: ohne einen einzigen Empfänger wird auch nichts eingesammelt (keine Abgabe ins Nichts)", () => {
    // Alle Teams über der 1. Linie — niemand ist empfangsberechtigt. Früher zahlten die Zahler
    // trotzdem und das Geld verschwand; jetzt gilt: bestraft wird nur, was auch umverteilt wird.
    const teams = [buildTeam("A", 150, 300), buildTeam("B", 120, 200), buildTeam("C", 95, 120)];
    const settlement = computeApronSettlement({ lines, salaryFactor: 1.24, teams });
    expect(settlement.empfaengerCount).toBe(0);
    // Die Roh-Abgaben wären positiv — eingesammelt wird trotzdem nichts.
    expect(settlement.rows.some((row) => row.rohAbgabe > 0)).toBe(true);
    expect(settlement.topf).toBe(0);
    expect(settlement.zahlerCount).toBe(0);
    for (const row of settlement.rows) {
      expect(row.abgabe).toBe(0);
      expect(row.nettoDelta).toBe(0);
    }
  });

  it("Ausschüttung geht zu gleichen KOPFTEILEN an alle Teams STRENG unter der 1. Linie", () => {
    const teams = [buildTeam("Zahler", 200, 300), buildTeam("B", 40, 200), buildTeam("C", 40, 200), buildTeam("D", lines.line1, 200)];
    const settlement = computeApronSettlement({ lines, salaryFactor: 1.24, teams });
    const b = settlement.rows.find((row) => row.teamId === "B")!;
    const c = settlement.rows.find((row) => row.teamId === "C")!;
    const d = settlement.rows.find((row) => row.teamId === "D")!;
    expect(b.ausgleich).toBeCloseTo(c.ausgleich, 9);
    expect(b.ausgleich).toBeGreaterThan(0);
    // D liegt GENAU auf der Linie — kein Empfänger.
    expect(d.ausgleich).toBe(0);
  });

  it("vollständige Ausschüttung: die Empfänger teilen den GANZEN Topf, unabhängig vom Rang", () => {
    // Nutzer-Entscheidung (PR #468): kein Empfänger-Deckel. Auch ein Empfänger mit
    // Wertungsanteil 0 (letzter Rang) bekommt den vollen Kopfanteil — die Verteidigung gegen
    // den 428,7-auf-3-Schadensfall ist der korrekte Einfrier-Zeitpunkt, nicht ein Deckel.
    const teams = [
      buildTeam("Z1", 200, 500),
      buildTeam("Z2", 190, 450),
      buildTeam("E-vorn", 40, 60),
      buildTeam("E-mitte", 45, 20),
      buildTeam("E-letzter", 50, 0),
    ];
    const settlement = computeApronSettlement({ lines, salaryFactor: 1.24, teams });
    const kopfanteil = settlement.topf / settlement.empfaengerCount;
    expect(settlement.topf).toBeGreaterThan(0);
    for (const id of ["E-vorn", "E-mitte", "E-letzter"]) {
      const row = settlement.rows.find((entry) => entry.teamId === id)!;
      expect(row.istEmpfaenger).toBe(true);
      expect(row.ausgleich).toBeCloseTo(kopfanteil, 9);
    }
    const totalAusgleich = settlement.rows.reduce((sum, row) => sum + row.ausgleich, 0);
    expect(totalAusgleich).toBeCloseTo(settlement.topf, 9);
  });
});

describe("Apron — Wertungsanteil (Grundlage des Deckels)", () => {
  it("ist am hoechsten fuer Rang 1 und 0 fuer Rang 32", () => {
    const rank1 = apronWertungsanteil(1, 1);
    const rank32 = apronWertungsanteil(32, 1);
    expect(rank1).toBeGreaterThan(0);
    expect(rank32).toBeCloseTo(0, 9);
  });

  it("skaliert linear mit dem Salary Factor", () => {
    const at1 = apronWertungsanteil(5, 1);
    const at2 = apronWertungsanteil(5, 2);
    expect(at2).toBeCloseTo(at1 * 2, 6);
  });

  it("klammert Raenge ausserhalb 1..32", () => {
    expect(apronWertungsanteil(0, 1)).toBeCloseTo(apronWertungsanteil(1, 1), 9);
    expect(apronWertungsanteil(99, 1)).toBeCloseTo(apronWertungsanteil(32, 1), 9);
  });
});
