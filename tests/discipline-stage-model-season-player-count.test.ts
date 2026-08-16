/**
 * DIE BÜHNE (Modell-Fallback) MUSS DIE SPIELPLAN-KADERGRÖSSE ZEIGEN, NICHT DIE KATALOG-ZAHL.
 *
 * GEMESSEN: `gameState.disciplines[].playerCount` ist nur der Startzustand des Katalogs — der
 * Spielplan wuerfelt die Kadergroesse pro Saison neu (`buildSeasonSeededDisciplineSchedule`,
 * lib/season/season-discipline-schedule.ts) und weicht an einem frisch simulierten Spielstand
 * bei 15 von 20 Disziplinen davon ab. `buildDisciplineStageModel` liefert den Modell-Fallback,
 * den `DisciplineStageArena` im "real"-Modus zeigt, wenn fuer den Spieltag keine
 * Engine-Vorschau vorliegt (siehe app/foundation/discipline-stage/DisciplineStageArena.tsx,
 * `realDataMissing`) — also eine ECHTE Anzeige, kein Test-only-Pfad.
 */
import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildDisciplineStageModel } from "@/lib/foundation/discipline-stage/discipline-stage-data";

function baueSpielstand(): GameState {
  const spieler = [
    { id: "p1", name: "Erste", disciplineRatings: { staffel: 90 } },
    { id: "p2", name: "Zweite", disciplineRatings: { staffel: 80 } },
    { id: "p3", name: "Dritte", disciplineRatings: { staffel: 70 } },
    { id: "p4", name: "Vierte", disciplineRatings: { staffel: 60 } },
  ];

  return {
    season: { id: "season-1", name: "Season 1", matchdayIds: ["md-1"], currentMatchday: 1 },
    gamePhase: "season_active",
    matchdayState: { matchdayId: "md-1", status: "planning" },
    teams: [{ teamId: "T-1", name: "Team Eins", shortCode: "T-1", cash: 30 }],
    players: spieler,
    rosters: spieler.map((p) => ({ teamId: "T-1", playerId: p.id, salary: 5 })),
    // Katalog sagt 6 Spieler pro Team ...
    disciplines: [{ id: "staffel", name: "Staffel", category: "speed", weight: 1, playerCount: 6 }],
    seasonState: {
      schedule: [],
      // ... der Spielplan hat fuer DIESE Saison aber nur 2 ausgelost.
      disciplineSchedule: [
        {
          seasonId: "season-1",
          matchdayId: "md-1",
          matchdayIndex: 1,
          matchdayLabel: "Spieltag 1",
          discipline1: { disciplineId: "staffel", displayName: "Staffel", order: 1, playerCount: 2, category: "speed" },
          discipline2: null,
          sourceStatus: "season_seed",
          sourceNote: null,
        },
      ],
    },
  } as unknown as GameState;
}

describe("Buehnen-Modell (Fallback ohne Engine-Vorschau): Kadergroesse folgt dem Spielplan", () => {
  it("uebernimmt die ausgeloste Spielplan-Kadergroesse, nicht den Katalogwert", () => {
    const modell = buildDisciplineStageModel(baueSpielstand(), "staffel", "T-1");
    expect(modell.slotCount).toBe(2);
  });

  it("waehlt entsprechend nur die Top-2 des Kaders, nicht die Top-6", () => {
    const modell = buildDisciplineStageModel(baueSpielstand(), "staffel", "T-1");
    const namen = modell.teams.find((t) => t.teamId === "T-1")!.slots.map((s) => s.playerName);
    expect(namen).toEqual(["Erste", "Zweite"]);
  });
});
