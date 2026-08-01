import { describe, expect, it } from "vitest";

import { SPONSOR_SOCKEL_SHARE, buildPrizeMoneyTable } from "@/lib/season/prize-money";
import { getPrizePlacementBonus } from "@/lib/season/prize-placement-table";
import { SPONSOR_LIVE_SAVE_S1_TEAMS } from "./_fixtures/sponsor-live-save-s1.fixture";

const SALARIES = SPONSOR_LIVE_SAVE_S1_TEAMS.map((team) => team.salary);
const SALARY_SUM = SALARIES.reduce((sum, value) => sum + value, 0);

/** Der echte Wurfbereich des Gehaltsfaktors — lib/season/season-economy-factors.ts. */
const ROLL_MIN = 0.82;
const ROLL_MAX = 1.24;

const curveAt = (factor: number) => buildPrizeMoneyTable(SALARIES, factor).map((row) => row.totalPrizeMoney);

/** Alle Faktoren des Wurfbereichs in 0,01er-Schritten — der Definitionsbereich, nicht eine Stichprobe. */
function rollRange(): number[] {
  const factors: number[] = [];
  for (let step = 0; step <= Math.round((ROLL_MAX - ROLL_MIN) * 100); step += 1) {
    factors.push(Math.round((ROLL_MIN + step / 100) * 100) / 100);
  }
  return factors;
}

/**
 * DIE AUSZAHLUNGSKURVE — flacher Sockel plus Prozentanteil, beides mit dem Gehaltsfaktor skaliert.
 *
 * Vorher hing an jedem Rang ein eigener, mit dem Rang WACHSENDER Sockel, waehrend der verteilbare
 * Rest `max(0, Gehaltssumme*Faktor - Sockelsumme)` mit dem Faktor schrumpfte. Unterhalb Faktor
 * 0,8722 ueberholte die Sockelsteigung die Prozentkurve und die Tabelle kippte: bei 0,82 — dem
 * ECHTEN Boden des Saison-Wurfs — verdiente der Tabellenletzte mehr als der Meister. Die
 * Sponsorleiter friert diese Kurve woertlich ein, erbte die Inversion also eins zu eins, und rund
 * 12 % aller Saisons lagen im gekippten Bereich.
 *
 * Genau deshalb prueft dieser Test die Monotonie nicht an einem Beispielfaktor, sondern am ganzen
 * Wurfbereich: die Behauptung "die Leiter kippt nie" darf nicht zufaellig gelten.
 */
describe("Auszahlungskurve: faktor-invariante Form", () => {
  it("verteilt exakt den Topf Gehaltssumme x Faktor", () => {
    for (const factor of [ROLL_MIN, 1.0, ROLL_MAX]) {
      const sum = curveAt(factor).reduce((acc, value) => acc + value, 0);
      // Jede Zeile wird auf zwei Nachkommastellen gerundet, 32 Zeilen tragen also bis zu 0,16 C
      // Rundungsrest. Alles darueber waere ein echtes Leck im Topf, kein Rundungseffekt.
      expect(Math.abs(sum - SALARY_SUM * factor), `Topf bei Faktor ${factor}`).toBeLessThan(0.16);
    }
  });

  it("trifft den Eigentuemer-Benchmark: Meister rund 90 C bei Faktor 1,0", () => {
    // Bei einem Meister-Gehalt von 95,7 C ist das ein netto etwa stabiles Jahr — die Vorgabe.
    // Vor dem Umbau waren es 79,6 C und damit netto −16,1.
    expect(curveAt(1.0)[0]!).toBeCloseTo(90.9, 1);
  });

  it("bleibt streng fallend — fuer JEDEN Faktor des Wurfbereichs", () => {
    for (const factor of rollRange()) {
      const curve = curveAt(factor);
      for (let rank = 1; rank < curve.length; rank += 1) {
        expect(
          curve[rank]!,
          `Faktor ${factor}: Rang ${rank + 1} (${curve[rank]}) darf nicht mehr zahlen als Rang ${rank} (${curve[rank - 1]})`,
        ).toBeLessThan(curve[rank - 1]!);
      }
    }
  });

  it("haelt auch die fertige Sponsorleiter monoton — fuer jeden Startrang am Wurfboden", () => {
    // Die Leiter ist Kurve(Endrang) + Platzierungsbonus(Startrang − Endrang). Der Bonus ist
    // ASYMMETRISCH (+1,28 aufwaerts, −0,96 abwaerts), kann die Kurve also theoretisch ueberholen.
    // Geprueft wird am Boden 0,82, wo die Kurve am flachsten ist und ein Kippen zuerst auftraete.
    const curve = curveAt(ROLL_MIN);
    for (let startRank = 1; startRank <= 32; startRank += 1) {
      const ladder = curve.map((value, index) => value + getPrizePlacementBonus(startRank - (index + 1)));
      for (let rank = 1; rank < ladder.length; rank += 1) {
        expect(
          ladder[rank]!,
          `Startrang ${startRank}: Leiter kippt zwischen Rang ${rank} und ${rank + 1}`,
        ).toBeLessThan(ladder[rank - 1]!);
      }
    }
  });

  it("haelt die Schere unter dem Balancingziel 2x — und faktorunabhaengig konstant", () => {
    const spreads = rollRange().map((factor) => {
      const curve = curveAt(factor);
      return curve[0]! / curve[31]!;
    });
    for (const spread of spreads) {
      expect(spread).toBeLessThanOrEqual(2.0);
    }
    // Faktorunabhaengig: genau das unterscheidet "Faktor als Niveau" von "Faktor als Form".
    // Frueher lief die Schere von 1,44x bei Faktor 1,0 bis ins Negative bei 0,82.
    expect(Math.max(...spreads) - Math.min(...spreads)).toBeLessThan(0.01);
  });

  it("laesst den Sockelanteil die eine Stellschraube sein", () => {
    // Kleinerer Anteil = steilere Kurve. Der Test haelt die Richtung fest, damit eine spaetere
    // Kalibrierung nicht versehentlich das Vorzeichen dreht.
    expect(SPONSOR_SOCKEL_SHARE).toBeGreaterThan(0);
    expect(SPONSOR_SOCKEL_SHARE).toBeLessThan(1);
    const rows = buildPrizeMoneyTable(SALARIES, 1.0);
    const flat = rows.map((row) => row.basis);
    expect(new Set(flat).size, "der Sockel muss rangneutral sein").toBe(1);
    expect(flat[0]! * 32).toBeCloseTo(SALARY_SUM * SPONSOR_SOCKEL_SHARE, 0);
  });
});
