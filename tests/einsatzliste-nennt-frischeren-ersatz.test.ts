/**
 * DER FATIGUE-HINWEIS NENNT EINEN NAMEN — oder er schweigt.
 *
 * GEMELDET VON CHRIS: „um mehr anreiz zu schaffen spieler für rotation zu holen -> können wir in der
 * einsatzliste einen hinweis einbauen wenn spieler hohe fatigue hat dass alternativ noch ein
 * rotationsspieler gezeigt wird der ‚frischer' ist?"
 *
 * Anlass war seine eigene Lage: „ich habe nur 8 spieler mit P-C davon haben sich 2 verletzt und alle
 * anderen haben keine pause das könnte schmerzhaft werden."
 *
 * WAS VORHER DA WAR: der Hinweis „Fatigue-Risiko … eher rotieren oder Team-Einsatz senken." Er sagte
 * DASS, nie MIT WEM — und stand identisch auch dann da, wenn es gar keinen frischen Ersatz gab.
 *
 * DIESER TEST HAELT BEIDE HAELFTEN FEST: der Vorschlag erscheint, wenn es ihn gibt, und er
 * unterbleibt, wenn die Alternative untauglich ist. Das Ausbleiben ist die Aussage „du hast
 * niemanden" — genau der Anreiz, Rotationsspieler zu holen, um den es Chris ging.
 */
import { describe, expect, it } from "vitest";

import { findeFrischerenErsatz } from "@/lib/lineups/lineup-audit";
import type { LegacyLineupLabPlayerOption } from "@/lib/lineups/legacy-lineup-lab";

const DISZIPLIN = "disc-1";

function option(
  id: string,
  name: string,
  fatigue: number,
  extra?: Partial<LegacyLineupLabPlayerOption>,
): LegacyLineupLabPlayerOption {
  return {
    activePlayerId: id,
    playerId: id,
    name,
    disciplineScores: { [DISZIPLIN]: 70 },
    fatigueCount: fatigue,
    injuryStatus: "healthy",
    injuryUntilMatchday: null,
    injuryRiskPercent: null,
    injuryRiskBand: null,
    injuryRiskLabel: null,
    injuryRiskProjection: null,
    ...extra,
  } as LegacyLineupLabPlayerOption;
}

function suche(optionen: LegacyLineupLabPlayerOption[], belegt: string[] = []) {
  return findeFrischerenErsatz({
    disciplineId: DISZIPLIN,
    selectedId: "muede",
    selectedFatigue: 62,
    playerOptions: [option("muede", "Müder Max", 62), ...optionen],
    belegteIds: new Set(["muede", ...belegt]),
  });
}

describe("Einsatzliste: der Fatigue-Hinweis nennt einen frischeren Ersatz", () => {
  it("schlaegt den frischesten tauglichen Spieler vor", () => {
    const ergebnis = suche([option("a", "Frische Frida", 10), option("b", "Mittel-Mia", 30)]);
    expect(ergebnis).toEqual({ name: "Frische Frida", fatigue: 10 });
  });

  it("bei gleicher Fatigue gewinnt der fuer DIESE Disziplin bessere", () => {
    const ergebnis = suche([
      option("a", "Schwach", 10, { disciplineScores: { [DISZIPLIN]: 40 } }),
      option("b", "Stark", 10, { disciplineScores: { [DISZIPLIN]: 88 } }),
    ]);
    expect(ergebnis?.name).toBe("Stark");
  });

  it("schweigt, wenn der Ersatz selbst schon erhoeht muede ist", () => {
    // Ein Tausch von 62 auf 51 ist kein Ausweg — beide sind ueber der Schwelle.
    expect(suche([option("a", "Auch müde", 51)])).toBeNull();
  });

  it("schweigt bei Marginalien — der Abstand muss spuerbar sein", () => {
    expect(suche([option("a", "Kaum frischer", 50)])).toBeNull();
  });

  it("schlaegt niemanden vor, der schon in einem anderen Slot steht", () => {
    expect(suche([option("a", "Schon gesetzt", 5)], ["a"])).toBeNull();
  });

  it("schlaegt weder Verletzte noch sich Erholende vor", () => {
    expect(suche([option("a", "Verletzt", 5, { injuryStatus: "injured" })])).toBeNull();
    expect(suche([option("b", "In Reha", 5, { injuryStatus: "recovering" })])).toBeNull();
  });

  it("schlaegt niemanden vor, der die Disziplin gar nicht kann", () => {
    expect(suche([option("a", "Fachfremd", 5, { disciplineScores: {} })])).toBeNull();
  });

  it("schweigt, wenn der Kader keinen frischen Ersatz hergibt — DAS ist der Anreiz", () => {
    // Chris' eigene Lage: acht Spieler, zwei verletzt, der Rest ausgelaugt.
    const duennerKader = [
      option("a", "Müde 1", 58),
      option("b", "Müde 2", 60),
      option("c", "Verletzt", 4, { injuryStatus: "injured" }),
      option("d", "Verletzt 2", 6, { injuryStatus: "injured" }),
    ];
    expect(suche(duennerKader)).toBeNull();
  });
});
