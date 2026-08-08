/**
 * GEMELDET: „D-P hat nicht verkauft und negatives cash die müssten eigentlich noch jemanden
 * verkaufen oder einen Kredit aufnehmen"
 * praezisiert mit: „underperformer dürfen doch auch mit verlust verkauft werden solange der
 * organisch in relation steht!"
 *
 * BEFUND, am echten Spielstand gemessen: Death Peaches stand bei -4.20 Mio, elf Spieler im Kader
 * (hartes Minimum 8), Kaderwert 236.85 Mio — und plante NULL Verkaeufe. Der Verkaufs-Scan lieferte
 * alle elf als Kandidaten, aber bei JEDEM stand „aktueller Netto-Verkauf würde unter Einkauf
 * liegen" und „frisch gekauft (season-1)". Das Team hatte seinen Kader komplett im Liga-Draft
 * gekauft, also trug jeder Spieler diese Marke; sie druecken den Composite-Score unter die
 * Schwelle, und `qualified` blieb leer.
 *
 * Kredite sind in Saison 1 per Designregel gesperrt (`ai-loan-decision-service.ts:237`). Das Team
 * konnte also weder verkaufen noch leihen — eine Sackgasse, die der Blocker
 * `negative_cash_unresolved_after_safe_sells` zwar benannte, aus der er aber nicht herausfuehrte.
 *
 * Gemessen nach dem Fix, an demselben Spielstand: D-P verkauft genau EINEN Spieler (Alarm, Erloes
 * 13.21 bei Einkauf 14.46 — Verlust 1.25), Cash geht von -4.20 auf +9.01, Kader 11 -> 10. Ueber die
 * Liga: blockierte Teams 10 -> 9, geplante Verkaeufe 54 -> 55. Genau ein Verkauf mehr.
 */
import { describe, expect, it } from "vitest";

import { ergaenzeNotverkaeufe } from "@/lib/ai/ai-market-plan-preview-service";

type Kandidat = Parameters<typeof ergaenzeNotverkaeufe>[0]["regulaer"][number];

/** Nur die Felder, die der Notverkauf liest — der Rest der Kandidatenform ist hier ohne Belang. */
function kandidat(input: {
  name: string;
  erloes: number;
  einkauf: number;
  score: number;
}): Kandidat {
  return {
    activePlayerId: `roster-${input.name}`,
    playerId: `player-${input.name}`,
    playerName: input.name,
    expectedSellValue: input.erloes,
    purchasePrice: input.einkauf,
    strategicSellScore: input.score,
    sellPriority: input.score,
    sellPriorityScore: input.score,
  } as unknown as Kandidat;
}

const bewertet = (kandidaten: Kandidat[]) => kandidaten.map((candidate) => ({ candidate, score: 0 }));

describe("Notverkauf bei negativem Cash", () => {
  it("laesst ein Team im Plus voellig unangetastet", () => {
    // Die wichtigste Eigenschaft des Eingriffs: er darf den Normalfall nicht anfassen.
    const kandidaten = [kandidat({ name: "Alarm", erloes: 13.21, einkauf: 14.46, score: 20 })];
    const ergebnis = ergaenzeNotverkaeufe({
      regulaer: [],
      bewertet: bewertet(kandidaten),
      teamCash: 12,
      teamSalaryTotal: 69.33,
    });
    expect(ergebnis).toEqual([]);
  });

  it("verkauft bei Minus-Cash, obwohl regulaer nichts gewaehlt wurde", () => {
    // Genau der gemeldete Fall: alle Keep-Gruende gesetzt, regulaere Auswahl leer.
    const kandidaten = [kandidat({ name: "Alarm", erloes: 13.21, einkauf: 14.46, score: 20 })];
    const ergebnis = ergaenzeNotverkaeufe({
      regulaer: [],
      bewertet: bewertet(kandidaten),
      teamCash: -4.2,
      teamSalaryTotal: 69.33,
    });
    expect(ergebnis.map((c) => c.playerName)).toEqual(["Alarm"]);
  });

  it("nimmt den groessten Underperformer, nicht den verlustaermsten", () => {
    // Chris' Praezisierung: der Sell-Score entscheidet, solange der Verlust im Verhaeltnis steht.
    // „Ladenhueter" hat den hoeheren Verlust, aber er ist verhaeltnismaessig UND dringlicher.
    const kandidaten = [
      kandidat({ name: "Leistungstraeger", erloes: 20, einkauf: 20.5, score: 5 }),
      kandidat({ name: "Ladenhueter", erloes: 20, einkauf: 32, score: 95 }),
    ];
    const ergebnis = ergaenzeNotverkaeufe({
      regulaer: [],
      bewertet: bewertet(kandidaten),
      teamCash: -4.2,
      teamSalaryTotal: 69.33,
    });
    expect(ergebnis.map((c) => c.playerName)).toEqual(["Ladenhueter"]);
  });

  it("stellt einen unverhaeltnismaessigen Verlust hinten an", () => {
    // Verlust groesser als Erloes = mehr Teamwert weg als Geld herein. Der dringlichere Spieler
    // verliert hier trotz hoeherem Score, weil sein Verkauf nicht „organisch in Relation" steht.
    const kandidaten = [
      kandidat({ name: "Totalverlust", erloes: 10, einkauf: 40, score: 99 }),
      kandidat({ name: "Vertretbar", erloes: 10, einkauf: 14, score: 40 }),
    ];
    const ergebnis = ergaenzeNotverkaeufe({
      regulaer: [],
      bewertet: bewertet(kandidaten),
      teamCash: -4.2,
      teamSalaryTotal: 20,
    });
    expect(ergebnis.map((c) => c.playerName)).toEqual(["Vertretbar"]);
  });

  it("hoert auf, sobald Cash und Reserve gedeckt sind", () => {
    // Kein Ausverkauf: ein Verkauf reicht hier, der zweite darf nicht passieren.
    const kandidaten = [
      kandidat({ name: "Erster", erloes: 30, einkauf: 31, score: 90 }),
      kandidat({ name: "Zweiter", erloes: 30, einkauf: 31, score: 80 }),
    ];
    const ergebnis = ergaenzeNotverkaeufe({
      regulaer: [],
      bewertet: bewertet(kandidaten),
      teamCash: -4.2,
      teamSalaryTotal: 69.33,
    });
    expect(ergebnis).toHaveLength(1);
  });

  it("kennt KEINE Roster-Untergrenze beim Verkaufen", () => {
    // „teams müssen erst NACH DEM KAUFEN genügend spieler haben, nicht schon am ende der season
    // nach dem verkaufen genug behalten, man kann theoretisch sein gesamtes team verkaufen."
    // Die Kadergroesse stellt die neue Saison wieder her — sie hier zu schuetzen wuerde genau das
    // Minus konservieren, das der Notverkauf aufloesen soll.
    const kandidaten = [
      kandidat({ name: "A", erloes: 10, einkauf: 10, score: 90 }),
      kandidat({ name: "B", erloes: 10, einkauf: 10, score: 80 }),
      kandidat({ name: "C", erloes: 10, einkauf: 10, score: 70 }),
    ];
    const ergebnis = ergaenzeNotverkaeufe({
      regulaer: [],
      bewertet: bewertet(kandidaten),
      teamCash: -25,
      teamSalaryTotal: 20,
      });
    // -25 + 10 + 10 + 10 = 5, Reserve ist max(1, 20*0.05) = 1 -> drei Verkaeufe, Kader egal.
    expect(ergebnis).toHaveLength(3);
  });

  it("rechnet bereits regulaer geplante Verkaeufe an", () => {
    // Deckt der regulaere Plan das Minus schon ab, kommt kein Notverkauf oben drauf.
    const schonGeplant = kandidat({ name: "Regulaer", erloes: 30, einkauf: 20, score: 70 });
    const ergebnis = ergaenzeNotverkaeufe({
      regulaer: [schonGeplant],
      bewertet: bewertet([schonGeplant, kandidat({ name: "Extra", erloes: 20, einkauf: 20, score: 95 })]),
      teamCash: -4.2,
      teamSalaryTotal: 69.33,
    });
    expect(ergebnis.map((c) => c.playerName)).toEqual(["Regulaer"]);
  });
});
