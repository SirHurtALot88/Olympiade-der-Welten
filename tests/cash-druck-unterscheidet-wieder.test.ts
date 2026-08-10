/**
 * DER CASH-DRUCK MUSS TEAMS UNTERSCHEIDEN — sonst ist er kein Signal, sondern ein Grundrauschen.
 *
 * GEFUNDEN bei der Gegenprüfung der Apron-Verkaufslogik, am Spielstand nachgemessen (Saison 2,
 * Spieltag 4, 32 Teams).
 *
 * FEHLER 1 — SÄTTIGUNG. Die alte Formel addierte vier Ja/Nein-Merkmale mit festen Gewichten. Drei
 * davon trafen in der heutigen Ökonomie fast immer zu (`salaryExceedsCash` 31/32, `tightCashRunway`
 * 31/32, `lowSellActivity` 32/32), weil die Gehaltssumme eines Teams typisch ein Vielfaches seines
 * Cash-Bestands ist. Ergebnis: 31 der 32 Teams standen bei 0,92 oder 1,00. Die „Emergency"-Schwelle
 * bei 0,45 unterschied damit nichts mehr — und weil sie in `selectCompositeSellCandidates` den
 * `hardMin`-Schutz aussetzt, war dieser Schutz ligaweit faktisch abgeschaltet: ein Team durfte
 * seinen Kader unter das Minimum verkaufen, weil die Notfall-Ausnahme immer griff.
 *
 * FEHLER 2 — DAS VORZEICHEN STAND KOPF. Drei der fünf Summanden waren mit `cash > 0` bewacht. Ein
 * Team im MINUS verlor dadurch 0,52 + 0,28 + 0,18 und bekam nur die 0,35 für negatives Cash.
 * Gemessen: Project Suicide, das EINZIGE Team der Liga im Minus (−1,2), hatte mit 0,47 den
 * NIEDRIGSTEN Druckwert überhaupt — unter allen 31 Teams mit Guthaben.
 */
import { describe, expect, it } from "vitest";

import { assessTeamSellRunwayPressure, resolveCashPressureScore } from "@/lib/ai/team-sell-runway-pressure";
import type { GameState } from "@/lib/data/olyDataTypes";

/** Neutraler Zustand: keine Identitäten ⇒ Finance 5 ⇒ Ziel-Cash/Gehalt 0,5. */
const NEUTRAL = {
  season: { id: "season-2" },
  transferHistory: [],
  teams: [],
  teamIdentities: [],
} as unknown as GameState;

const druck = (cash: number, salaryTotal: number) =>
  resolveCashPressureScore({ gameState: NEUTRAL, teamId: "X", cash, salaryTotal });

describe("Negatives Cash ist der Höchstwert, nicht der niedrigste", () => {
  it("ein Team im Minus steht über JEDEM Team mit Guthaben", () => {
    // Genau das war verkehrt: Project Suicide (−1,2) lag mit 0,47 unter allen 31 anderen.
    const imMinus = druck(-1.2, 86.1);
    expect(imMinus).toBe(1);
    for (const guthaben of [0.1, 5, 12, 30, 60]) {
      expect(imMinus).toBeGreaterThanOrEqual(druck(guthaben, 86.1));
    }
  });

  it("auch knapp unter null zählt voll — die Grenze ist das Vorzeichen, kein Betrag", () => {
    expect(druck(-0.01, 50)).toBe(1);
  });
});

describe("Der Wert unterscheidet über die ganze Liga", () => {
  it("leere Kasse oben, Ziel erreicht unten", () => {
    expect(druck(0, 60)).toBe(1);
    // Ziel 0,5 × 60 = 30 Cash — ab da kein Druck mehr.
    expect(druck(30, 60)).toBe(0);
    expect(druck(45, 60)).toBe(0);
  });

  it("dazwischen fällt er monoton", () => {
    const werte = [2, 6, 10, 14, 18, 22, 26, 30].map((cash) => druck(cash, 60));
    for (let i = 1; i < werte.length; i += 1) {
      expect(werte[i]!).toBeLessThanOrEqual(werte[i - 1]!);
    }
    // Und er nutzt die Spannweite wirklich aus, statt oben zu kleben.
    expect(werte[0]!).toBeGreaterThan(0.8);
    expect(werte[werte.length - 1]!).toBe(0);
  });

  /**
   * DIE KERNZUSICHERUNG. Mit der alten Formel lagen alle diese Teams bei 0,92 oder 1,00 — die
   * Spannweite war 0,08. Ein Signal, das alle gleich laut anschreit, steuert nichts.
   */
  it("eine realistische Liga verteilt sich, statt oben zusammenzukleben", () => {
    // Cash/Gehalt-Paare aus dem gemessenen Spielstand.
    const liga: Array<[number, number]> = [
      [0.08, 59.6],
      [5.32, 97.7],
      [9.46, 84.8],
      [16.03, 78.8],
      [27.54, 63.6],
      [30.9, 62.7],
      [35.57, 48.0],
    ];
    const werte = liga.map(([cash, salary]) => druck(cash, salary));
    const spanne = Math.max(...werte) - Math.min(...werte);
    expect(spanne).toBeGreaterThan(0.8);
    // Die satten Teams sind wirklich unten, nicht nur ein bisschen tiefer.
    expect(werte[werte.length - 1]!).toBeLessThan(0.2);
  });

  it("ohne Gehaltslast gibt es keinen Druck", () => {
    expect(druck(0, 0)).toBe(0);
  });
});

describe("Die knappe Kasse zählt zusätzlich zur Quote", () => {
  it("ein kleines Team mit guter Quote, aber leerer Kasse bleibt unter Druck", () => {
    // Quote 0,8 — quotenmässig glänzend, aber 4 Cash stemmen keinen einzigen Transfer.
    expect(druck(4, 5)).toBeGreaterThan(0);
  });

  it("der Aufschlag ist klein und gedeckelt — er ersetzt die Quote nicht", () => {
    expect(druck(4, 5)).toBeLessThanOrEqual(0.15);
  });
});

describe("Die Merkmale bleiben im Rückgabewert erhalten", () => {
  // Sie werden anderswo gelesen: `salaryExceedsCash` in der Verkaufsvorschau für eine Begründung,
  // `lowCashBuffer` in der Markt-Anwendung. Nur ihre Rolle als Summanden ist entfallen.
  const gameState = {
    season: { id: "season-2" },
    transferHistory: [],
    teams: [{ teamId: "L-K", cash: 8, name: "L-K", shortCode: "L-K", budget: 100 }],
    teamIdentities: [],
  } as unknown as GameState;

  it("alle fünf Felder sind weiterhin da", () => {
    const result = assessTeamSellRunwayPressure({
      gameState,
      team: gameState.teams[0]!,
      salaryTotal: 58,
    });
    expect(result.seasonSells).toBe(0);
    expect(result.salaryExceedsCash).toBe(true);
    expect(result.tightCashRunway).toBe(true);
    expect(result.lowSellActivity).toBe(true);
    expect(result.lowCashBuffer).toBe(true);
    expect(result.cashPressureScore).toBeGreaterThan(0.5);
  });

  /**
   * `lowSellActivity` ist wahr, solange ein Team in dieser Saison nichts verkauft hat — am
   * Saisonanfang also bei allen 32 Teams. Es misst „hat noch nicht gehandelt", nicht „ist in Not".
   * Als Summand hat es nur den Sockel aller Teams gemeinsam angehoben.
   */
  it("ob schon verkauft wurde, verändert den Druckwert nicht", () => {
    const ohneVerkauf = assessTeamSellRunwayPressure({
      gameState,
      team: gameState.teams[0]!,
      salaryTotal: 58,
    });
    const mitVerkauf = assessTeamSellRunwayPressure({
      gameState: {
        ...gameState,
        transferHistory: [{ seasonId: "season-2", transferType: "sell", fromTeamId: "L-K", fee: 20 }],
      } as unknown as GameState,
      team: gameState.teams[0]!,
      salaryTotal: 58,
    });
    expect(mitVerkauf.seasonSells).toBe(1);
    expect(mitVerkauf.cashPressureScore).toBe(ohneVerkauf.cashPressureScore);
  });
});
