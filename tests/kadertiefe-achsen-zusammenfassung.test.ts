/**
 * GEMELDET VON CHRIS: „auch eingeklappt sollten dann die gesamtwerte dort stehen also POW SPE MEN
 * SOC avgs und die top spieler in der reihenfolge wie es vorher auch mal war"
 *
 * Zugeklappt stand in der Gruppenzeile nur der Name der Achse und die Zahl ihrer Disziplinen —
 * die Zeile war breit und leer. Jetzt trägt sie den Achsen-Schnitt und die stärksten Spieler in
 * denselben Spalten wie die Disziplin-Zeilen darunter.
 *
 * Der Punkt, an dem das leicht falsch wird, und weshalb diese Datei existiert:
 *
 * Die naheliegende Quelle wären die Zellen der Depth-Zeilen — dort stehen aber je Disziplin nur
 * die besten sechs. Ein Spieler, der in zwei der fünf Disziplinen einer Achse auftaucht und in
 * den anderen drei schwach ist, käme aus diesen Zellen mit dem Schnitt seiner zwei GUTEN Werte
 * heraus und stünde zu weit oben. `buildTeamAxisSummaries` rechnet deshalb über die vollen
 * `disciplineRatings`. Der erste Test unten fällt genau dann, wenn jemand auf die Zellen
 * umstellt.
 */
import { describe, expect, it } from "vitest";

import { buildTeamAxisSummaries } from "@/app/foundation/team-profile/TeamProfileNewLook";
import type { GameState } from "@/lib/data/olyDataTypes";

const POW_IDS = ["mini-dm", "tdm", "gewichtheben", "hockey", "breaking"];
const SPE_IDS = ["fechten", "spurt", "staffel", "climbing", "time-trial"];

function createGameState(players: Array<{ id: string; name: string; ratings: Record<string, number> }>): GameState {
  return {
    disciplines: [
      ...POW_IDS.map((id) => ({ id, name: id, category: "power" as const })),
      ...SPE_IDS.map((id) => ({ id, name: id, category: "speed" as const })),
    ],
    rosters: players.map((player) => ({ teamId: "T-1", playerId: player.id })),
    players: players.map((player) => ({
      id: player.id,
      name: player.name,
      disciplineRatings: player.ratings,
    })),
  } as unknown as GameState;
}

function ratings(ids: string[], values: number[]): Record<string, number> {
  return Object.fromEntries(ids.map((id, index) => [id, values[index] ?? 0]));
}

describe("Depth-Chart · Achsen-Zusammenfassung im Gruppenkopf", () => {
  it("mittelt über ALLE Disziplinen der Achse, nicht nur über die starken", () => {
    // "Spitz" ist in zwei POW-Disziplinen exzellent und in dreien schwach: über alle fünf
    // gemittelt 42, über nur die zwei guten wären es 90. "Solide" liegt durchgehend bei 60.
    // Wer aus den sichtbaren Zellen rechnet, setzt Spitz vor Solide — das ist der Fehler.
    const state = createGameState([
      { id: "P-spitz", name: "Spitz", ratings: ratings(POW_IDS, [90, 90, 10, 10, 10]) },
      { id: "P-solide", name: "Solide", ratings: ratings(POW_IDS, [60, 60, 60, 60, 60]) },
    ]);
    const pow = buildTeamAxisSummaries(state, "T-1")?.pow;

    expect(pow?.topPlayers.map((entry) => entry.playerName)).toEqual(["Solide", "Spitz"]);
    expect(Math.round(pow?.topPlayers[1]?.rating ?? 0)).toBe(42);
  });

  it("nennt den Schnitt über alle Kaderspieler der Achse", () => {
    const state = createGameState([
      { id: "P-1", name: "Eins", ratings: ratings(POW_IDS, [80, 80, 80, 80, 80]) },
      { id: "P-2", name: "Zwei", ratings: ratings(POW_IDS, [40, 40, 40, 40, 40]) },
    ]);

    expect(buildTeamAxisSummaries(state, "T-1")?.pow.avgRating).toBe(60);
  });

  it("hält die Achsen auseinander", () => {
    const state = createGameState([
      { id: "P-1", name: "Kraftpaket", ratings: { ...ratings(POW_IDS, [90, 90, 90, 90, 90]), ...ratings(SPE_IDS, [20, 20, 20, 20, 20]) } },
    ]);
    const summaries = buildTeamAxisSummaries(state, "T-1");

    expect(summaries?.pow.avgRating).toBe(90);
    expect(summaries?.spe.avgRating).toBe(20);
  });

  it("liefert höchstens sechs Spieler — so viele Spalten hat die Tabelle", () => {
    const state = createGameState(
      Array.from({ length: 9 }, (_, index) => ({
        id: `P-${index}`,
        name: `Spieler ${index}`,
        ratings: ratings(POW_IDS, Array(5).fill(90 - index)),
      })),
    );

    expect(buildTeamAxisSummaries(state, "T-1")?.pow.topPlayers).toHaveLength(6);
  });

  it("lässt eine Achse ohne Werte leer statt zu raten", () => {
    // Spieler ohne SPE-Ratings: der Kopf zeigt dort "—", keine erfundene Null.
    const state = createGameState([{ id: "P-1", name: "Nur POW", ratings: ratings(POW_IDS, [70, 70, 70, 70, 70]) }]);
    const spe = buildTeamAxisSummaries(state, "T-1")?.spe;

    expect(spe?.avgRating).toBeNull();
    expect(spe?.topPlayers).toEqual([]);
  });

  it("gibt null zurück, wenn das Team keinen Kader hat", () => {
    const state = createGameState([{ id: "P-1", name: "Eins", ratings: ratings(POW_IDS, [70, 70, 70, 70, 70]) }]);

    expect(buildTeamAxisSummaries(state, "T-fremd")).toBeNull();
  });
});
