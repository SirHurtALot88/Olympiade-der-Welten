/**
 * DIE ZERLEGUNG DES MARKTWERTS — Chris' Punkt 6.
 *
 * Was hier geprueft wird, ist nicht „kommt eine Zahl heraus", sondern die eine Eigenschaft, an der
 * ein Herleitungs-Hover steht oder faellt: DIE SICHTBAREN ZAHLEN MUESSEN AUFGEHEN. Wer fuenf
 * Posten, eine Sammelzeile und eine Summe untereinander sieht und nachrechnet, darf nicht auf
 * einen Cent Differenz stossen — sonst laedt die Erklaerung genau die Rueckfrage ein, die sie
 * beantworten soll.
 *
 * Das ist kein theoretisches Risiko: die Rangtabelle fuehrt DREI Nachkommastellen (5.245), gezeigt
 * werden zwei. Eine naiv aufaddierte Restsumme verfehlt die Gesamtsumme deshalb regelmaessig.
 */
import { describe, expect, it } from "vitest";

import { MARKTWERT_HOVER_MAX_ZEILEN, buildMarktwertHerleitung } from "@/lib/foundation/marktwert-herleitung";
import type { MarketValueFixtureResult } from "@/lib/player-formulas/player-formula-types";

/** Ein Engine-Ergebnis wie es `calculateMarketValueFromRankTable` liefert. */
function fixture(input: {
  beitraege: Array<{ disciplineId: string; rank: number; amount: number }>;
  mwChangeFix?: number;
}): MarketValueFixtureResult {
  const roh = Number(input.beitraege.reduce((summe, eintrag) => summe + eintrag.amount, 0).toFixed(2));
  const angepasst = Number((roh + (input.mwChangeFix ?? 0)).toFixed(2));
  const geschuetzt = Number(Math.max(0, angepasst).toFixed(2));
  return {
    playerId: "spieler-1",
    disciplineRanks: Object.fromEntries(input.beitraege.map((e) => [e.disciplineId, e.rank])),
    disciplineMarketValues: Object.fromEntries(input.beitraege.map((e) => [e.disciplineId, e.amount])),
    rawDisciplineMarketValueSum: roh,
    adjustedRaw: angepasst,
    protectedRaw: geschuetzt,
    marketValueBaseOffset: 0,
    calcWithoutBaseOffset: geschuetzt,
    marketValueNew: geschuetzt,
  };
}

/**
 * Zehn Disziplinen mit dritter Nachkommastelle — die Lage am echten Spielstand (die Rangtabelle
 * fuehrt Werte wie 5.245), UND so gewaehlt, dass die Rundung wirklich auseinanderlaeuft.
 *
 * DIESE WAHL IST NICHT KOSMETIK. Meine erste Fassung nahm eine gleichmaessige Reihe
 * (`6.5 - index * 0.287`) — dort heben sich die Rundungsfehler der fuenf gezeigten Zeilen zufaellig
 * exakt auf, und die Gegenprobe blieb GRUEN, auch mit der naiv aufaddierten Restsumme. Der Test
 * haette also nichts bewacht. Die fuenf grossen Werte runden hier alle in dieselbe Richtung auf
 * (x,999 -> x+1,00), damit die Differenz entsteht, um die es geht: sichtbar 34,97 statt 34,96.
 */
function zehnDisziplinen(): MarketValueFixtureResult {
  const betraege = [6.999, 5.999, 4.999, 3.999, 2.999, 1.996, 1.994, 1.993, 1.992, 1.991];
  return fixture({
    beitraege: betraege.map((amount, index) => ({
      disciplineId: `disziplin-${String(index).padStart(2, "0")}`,
      rank: (index + 1) * 37,
      amount,
    })),
  });
}

describe("Marktwert-Herleitung", () => {
  it("zeigt hoechstens fuenf Disziplinen einzeln und faltet den Rest zu einer Zeile", () => {
    const herleitung = buildMarktwertHerleitung(zehnDisziplinen());
    expect(herleitung).not.toBeNull();
    expect(herleitung!.zeilen).toHaveLength(MARKTWERT_HOVER_MAX_ZEILEN);
    expect(herleitung!.restAnzahl).toBe(10 - MARKTWERT_HOVER_MAX_ZEILEN);
  });

  it("sortiert absteigend nach Beitrag — der staerkste Rang steht oben", () => {
    const herleitung = buildMarktwertHerleitung(
      fixture({
        beitraege: [
          { disciplineId: "klein", rank: 900, amount: 1.2 },
          { disciplineId: "gross", rank: 12, amount: 6.1 },
          { disciplineId: "mittel", rank: 300, amount: 3.4 },
        ],
      }),
    );
    expect(herleitung!.zeilen.map((zeile) => zeile.disciplineId)).toEqual(["gross", "mittel", "klein"]);
  });

  it("laesst die sichtbaren Zahlen exakt aufgehen — DIE Eigenschaft dieses Hovers", () => {
    const herleitung = buildMarktwertHerleitung(zehnDisziplinen())!;
    const sichtbar = herleitung.zeilen.reduce((summe, zeile) => summe + zeile.amount, 0) + herleitung.restSumme;
    // Auf zwei Stellen, weil auf zwei Stellen angezeigt wird. Genau hier faellt eine naiv
    // aufaddierte Restsumme durch: sie rechnet mit den ungerundeten Rohwerten weiter, waehrend
    // oben gerundete Zahlen stehen.
    expect(Number(sichtbar.toFixed(2))).toBe(herleitung.summeRaenge);
  });

  it("uebertraegt die Einzelbeitraege bereits gerundet, nicht erst in der Anzeige", () => {
    const herleitung = buildMarktwertHerleitung(zehnDisziplinen())!;
    for (const zeile of herleitung.zeilen) {
      expect(zeile.amount).toBe(Number(zeile.amount.toFixed(2)));
    }
  });

  it("laesst die Sammelzeile weg, wenn alle Disziplinen einzeln stehen", () => {
    const herleitung = buildMarktwertHerleitung(
      fixture({ beitraege: [{ disciplineId: "eine", rank: 5, amount: 6.4 }] }),
    )!;
    expect(herleitung.restAnzahl).toBe(0);
    expect(herleitung.restSumme).toBe(0);
  });

  it("zeigt die Handkorrektur nur, wenn es eine gibt", () => {
    const ohne = buildMarktwertHerleitung(
      fixture({ beitraege: [{ disciplineId: "eine", rank: 5, amount: 6.4 }] }),
    )!;
    // Eine 0 waere hier keine Information, sondern eine Zeile, die nach Aussage aussieht.
    expect(ohne.mwChangeFix).toBeNull();

    const mit = buildMarktwertHerleitung(
      fixture({ beitraege: [{ disciplineId: "eine", rank: 5, amount: 6.4 }], mwChangeFix: -1.5 }),
    )!;
    expect(mit.mwChangeFix).toBe(-1.5);
    expect(mit.marktwert).toBe(4.9);
  });

  it("gibt gar nichts zurueck, wenn keine Disziplin einen Beitrag traegt", () => {
    // Ein Spieler ohne gewertete Disziplin hat keinen aus Raengen gebauten Marktwert. Ein leerer
    // Hover ist dann ehrlicher als eine Zeile „0,00".
    expect(buildMarktwertHerleitung(fixture({ beitraege: [] }))).toBeNull();
  });

  it("ueberspringt Disziplinen ohne Rang, statt sie mit einem erfundenen Rang zu zeigen", () => {
    const roh = fixture({
      beitraege: [
        { disciplineId: "mit-rang", rank: 20, amount: 5.5 },
        { disciplineId: "ohne-rang", rank: 40, amount: 4.0 },
      ],
    });
    delete roh.disciplineRanks["ohne-rang"];
    const herleitung = buildMarktwertHerleitung(roh)!;
    expect(herleitung.zeilen.map((zeile) => zeile.disciplineId)).toEqual(["mit-rang"]);
  });

  it("endet auf dem Marktwert der Engine — nicht auf einer selbst gebildeten Summe", () => {
    // Die Engine hebt negative Summen auf 0 (`protectedRaw`). Wuerde der Hover selbst addieren,
    // stuende unten eine negative Zahl, die im Spiel nirgends vorkommt.
    const herleitung = buildMarktwertHerleitung(
      fixture({ beitraege: [{ disciplineId: "eine", rank: 3000, amount: 0.1 }], mwChangeFix: -5 }),
    )!;
    expect(herleitung.marktwert).toBe(0);
    expect(herleitung.summeRaenge).toBe(0.1);
  });
});
