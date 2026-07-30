import { describe, expect, it } from "vitest";

import {
  buildPlayerDisciplineTrainingForecast,
  selectMovedDisciplines,
} from "@/lib/foundation/player-discipline-training-forecast";
import type { GameState, Player } from "@/lib/data/olyDataTypes";
import type { PlayerSeasonTrainingForecast } from "@/lib/foundation/player-matchday-training-history";

const BASE_ATTRIBUTES = {
  power: 50,
  health: 50,
  stamina: 50,
  intelligence: 50,
  awareness: 50,
  determination: 50,
  speed: 50,
  dexterity: 50,
  charisma: 50,
  will: 50,
  spirit: 50,
  torment: 50,
};

function makePlayer(id: string, overrides: Partial<typeof BASE_ATTRIBUTES> = {}): Player {
  return {
    id,
    attributeSheetStats: { ...BASE_ATTRIBUTES, ...overrides },
  } as unknown as Player;
}

/** Eine Liga mit Streuung — sonst liegen alle auf demselben Rang und nichts kann sich bewegen. */
function makeLeague(): Player[] {
  return [
    makePlayer("hero"),
    ...Array.from({ length: 20 }, (_, index) =>
      makePlayer(`rival-${index}`, { power: 40 + index, determination: 40 + index }),
    ),
  ];
}

function makeGameState(players: Player[]): GameState {
  return { players } as unknown as GameState;
}

function makeForecast(attributes: Array<{ attribute: string; cumulative: number; projectedValue: number }>) {
  return {
    seasonId: "season-1",
    matchdaysPlayed: 10,
    totalMatchdays: 10,
    netCumulative: attributes.reduce((sum, entry) => sum + entry.cumulative, 0),
    trainingTotal: 0,
    spilloverTotal: 0,
    performanceTotal: 0,
    regressionTotal: 0,
    attributes,
  } as unknown as PlayerSeasonTrainingForecast;
}

/**
 * Der Saison-Forecast steht in Attributen. Was ein Manager davon wissen will, steht eine Ebene
 * weiter: in welchen Disziplinen wird der Spieler dadurch besser?
 *
 * Die Uebersetzung ist nicht offensichtlich, und genau deshalb wird sie nicht geschaetzt: ein
 * Diszi-Wert ist KEIN gewichteter Attributschnitt, sondern der ligaweite RANG der gewichteten
 * Attributsumme, durch die Rang→Stat-Tabelle geschickt. Dasselbe Attribut-Plus kann je nach Dichte
 * des Felds 0 oder mehrere Punkte bedeuten.
 */
describe("Trainings-Forecast je Disziplin", () => {
  it("uebersetzt ein Attribut-Plus in eine Diszi-Veraenderung", () => {
    const league = makeLeague();
    const forecast = buildPlayerDisciplineTrainingForecast({
      gameState: makeGameState(league),
      player: league[0]!,
      // Kraeftig genug, um im Feld sichtbar Raenge zu klettern.
      forecast: makeForecast([
        { attribute: "power", cumulative: 25, projectedValue: 75 },
        { attribute: "determination", cumulative: 25, projectedValue: 75 },
      ]),
    });

    expect(forecast).not.toBeNull();
    const moved = selectMovedDisciplines(forecast);
    expect(moved.length).toBeGreaterThan(0);
    // Bessere Attribute duerfen einen Diszi-Wert nicht senken.
    expect(moved.every((row) => row.delta > 0)).toBe(true);
    for (const row of moved) {
      expect(row.delta).toBe(Math.round(row.projected - row.baseline));
    }
  });

  it("meldet ohne Attributaenderung auch keine Diszi-Aenderung", () => {
    const league = makeLeague();
    const forecast = buildPlayerDisciplineTrainingForecast({
      gameState: makeGameState(league),
      player: league[0]!,
      forecast: makeForecast([{ attribute: "power", cumulative: 0, projectedValue: 50 }]),
    });

    expect(selectMovedDisciplines(forecast)).toEqual([]);
  });

  it("gibt ohne Forecast nichts zurueck", () => {
    const league = makeLeague();
    expect(
      buildPlayerDisciplineTrainingForecast({
        gameState: makeGameState(league),
        player: league[0]!,
        forecast: null,
      }),
    ).toBeNull();
  });

  it("gibt nichts zurueck, wenn ein Attribut fehlt", () => {
    // Ein einzelnes fehlendes Attribut wuerde den Spieler aus der Rangliste werfen — die Differenz
    // waere dann frei erfunden statt gerechnet.
    const incomplete = makePlayer("hero");
    (incomplete.attributeSheetStats as Record<string, unknown>).power = null;

    expect(
      buildPlayerDisciplineTrainingForecast({
        gameState: makeGameState([incomplete, ...makeLeague().slice(1)]),
        player: incomplete,
        forecast: makeForecast([{ attribute: "determination", cumulative: 20, projectedValue: 70 }]),
      }),
    ).toBeNull();
  });

  it("sortiert die staerkste Auswirkung nach vorn", () => {
    const rows = selectMovedDisciplines({
      seasonId: "season-1",
      rowsByDisciplineId: {
        a: { disciplineId: "a", baseline: 50, projected: 51, delta: 1 },
        b: { disciplineId: "b", baseline: 50, projected: 55, delta: 5 },
        c: { disciplineId: "c", baseline: 50, projected: 47, delta: -3 },
        d: { disciplineId: "d", baseline: 50, projected: 50, delta: 0 },
      },
    });

    // Betrag entscheidet — ein Rueckgang von 3 ist wichtiger als ein Zuwachs von 1.
    expect(rows.map((row) => row.disciplineId)).toEqual(["b", "c", "a"]);
  });

  it("haelt sich an das Limit", () => {
    const rowsByDisciplineId = Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => [
        `d-${index}`,
        { disciplineId: `d-${index}`, baseline: 50, projected: 50 + index + 1, delta: index + 1 },
      ]),
    );
    expect(selectMovedDisciplines({ seasonId: "season-1", rowsByDisciplineId }, 4)).toHaveLength(4);
  });
});
