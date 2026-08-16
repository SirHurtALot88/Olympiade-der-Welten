import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { resolveInjuryMatchdayDisciplines } from "@/lib/foundation/player-injury-history";

/**
 * Die Verletzungshistorie soll zeigen, in welcher Disziplin der Spieler am Spieltag seiner
 * Verletzung aufgestellt war — samt Kadergröße der Disziplin.
 *
 * `InjuryEventRecord` traegt KEINE disciplineId: der Wurf haengt am Spieltag und an der
 * Fatigue. Der Einsatz wird deshalb aus der Einsatzliste desselben Spieltags aufgeloest.
 */
function gameState(partial?: {
  drafts?: Array<{
    teamId: string;
    matchdayId: string;
    entries: Array<{ playerId: string; disciplineId: string }>;
  }>;
  disciplineSchedule?: Array<{
    seasonId: string;
    matchdayId: string;
    disciplineId: string;
    side: "discipline1" | "discipline2";
    playerCount: number;
  }>;
}): GameState {
  const scheduleByEntryKey = new Map<
    string,
    { seasonId: string; matchdayId: string; discipline1?: unknown; discipline2?: unknown }
  >();
  for (const slot of partial?.disciplineSchedule ?? []) {
    const key = `${slot.seasonId}::${slot.matchdayId}`;
    const entry = scheduleByEntryKey.get(key) ?? { seasonId: slot.seasonId, matchdayId: slot.matchdayId };
    (entry as Record<string, unknown>)[slot.side] = {
      disciplineId: slot.disciplineId,
      displayName: slot.disciplineId,
      order: 1,
      playerCount: slot.playerCount,
      category: "power",
    };
    scheduleByEntryKey.set(key, entry);
  }

  return {
    disciplines: [
      { id: "gewichtheben", name: "Gewichtheben", category: "power", weight: 1, playerCount: 6 },
      { id: "tdm", name: "TDM", category: "power", weight: 1, playerCount: 3 },
      { id: "schach", name: "Schach", category: "mental", weight: 1 },
    ],
    seasonState: {
      lineupDrafts: (partial?.drafts ?? []).map((draft, index) => ({
        lineupId: `lineup-${index}`,
        saveId: "save-1",
        seasonId: "season-1",
        matchdayId: draft.matchdayId,
        teamId: draft.teamId,
        status: "resolved",
        entries: draft.entries.map((entry, slotIndex) => ({
          disciplineId: entry.disciplineId,
          disciplineSide: "d1",
          slotIndex,
          playerId: entry.playerId,
          activePlayerId: null,
        })),
        createdAt: "",
        updatedAt: "",
      })),
      disciplineSchedule: [...scheduleByEntryKey.values()],
    },
  } as unknown as GameState;
}

describe("Verletzungshistorie: Einsatz am Spieltag der Verletzung", () => {
  it("nennt die Disziplin samt Kadergröße", () => {
    const result = resolveInjuryMatchdayDisciplines({
      gameState: gameState({
        drafts: [{ teamId: "C-C", matchdayId: "md-3", entries: [{ playerId: "p1", disciplineId: "gewichtheben" }] }],
      }),
      teamId: "C-C",
      playerId: "p1",
      matchdayId: "md-3",
    });

    expect(result).toEqual([{ disciplineId: "gewichtheben", name: "Gewichtheben", playerCount: 6 }]);
  });

  it("liefert beide Disziplinen, wenn der Spieler an dem Spieltag zweimal antrat", () => {
    // Ein Spieltag hat zwei Disziplinen — der Wurf gehoert zu keiner davon allein.
    const result = resolveInjuryMatchdayDisciplines({
      gameState: gameState({
        drafts: [
          {
            teamId: "C-C",
            matchdayId: "md-3",
            entries: [
              { playerId: "p1", disciplineId: "gewichtheben" },
              { playerId: "p1", disciplineId: "tdm" },
            ],
          },
        ],
      }),
      teamId: "C-C",
      playerId: "p1",
      matchdayId: "md-3",
    });

    expect(result.map((entry) => entry.name)).toEqual(["Gewichtheben", "TDM"]);
  });

  it("zaehlt dieselbe Disziplin nicht doppelt", () => {
    const result = resolveInjuryMatchdayDisciplines({
      gameState: gameState({
        drafts: [
          {
            teamId: "C-C",
            matchdayId: "md-3",
            entries: [
              { playerId: "p1", disciplineId: "tdm" },
              { playerId: "p1", disciplineId: "tdm" },
            ],
          },
        ],
      }),
      teamId: "C-C",
      playerId: "p1",
      matchdayId: "md-3",
    });

    expect(result).toHaveLength(1);
  });

  it("laesst die Kadergröße weg, wenn der Katalog sie nicht kennt", () => {
    const result = resolveInjuryMatchdayDisciplines({
      gameState: gameState({
        drafts: [{ teamId: "C-C", matchdayId: "md-3", entries: [{ playerId: "p1", disciplineId: "schach" }] }],
      }),
      teamId: "C-C",
      playerId: "p1",
      matchdayId: "md-3",
    });

    // Kein erfundener Wert — null statt 0.
    expect(result[0]?.playerCount).toBeNull();
  });

  it("nennt die SPIELPLAN-Kadergröße, wenn sie vom Katalog abweicht", () => {
    // Gewichtheben steht im Katalog mit 6, der Spielplan hat diesen Spieltag aber nur 4
    // ausgelost (der Spielplan wuerfelt die Kadergroesse pro Saison neu, siehe
    // lib/season/season-discipline-schedule.ts). Angezeigt werden muss die ausgeloste Zahl,
    // sonst behauptet die Verletzungshistorie eine Kadergroesse, die diesen Spieltag nie galt.
    const result = resolveInjuryMatchdayDisciplines({
      gameState: gameState({
        drafts: [{ teamId: "C-C", matchdayId: "md-3", entries: [{ playerId: "p1", disciplineId: "gewichtheben" }] }],
        disciplineSchedule: [
          { seasonId: "season-1", matchdayId: "md-3", disciplineId: "gewichtheben", side: "discipline1", playerCount: 4 },
        ],
      }),
      teamId: "C-C",
      playerId: "p1",
      matchdayId: "md-3",
      seasonId: "season-1",
    });

    expect(result).toEqual([{ disciplineId: "gewichtheben", name: "Gewichtheben", playerCount: 4 }]);
  });

  it("faellt auf den Katalog zurueck, wenn der Spielplan-Eintrag fehlt (vergangene Saison)", () => {
    // `disciplineSchedule` wird beim Saisonwechsel durch den Plan der neuen Saison ersetzt —
    // fuer eine Verletzung aus einer vergangenen Saison gibt es dort keinen Eintrag mehr.
    const result = resolveInjuryMatchdayDisciplines({
      gameState: gameState({
        drafts: [{ teamId: "C-C", matchdayId: "md-3", entries: [{ playerId: "p1", disciplineId: "gewichtheben" }] }],
      }),
      teamId: "C-C",
      playerId: "p1",
      matchdayId: "md-3",
      seasonId: "season-0",
    });

    expect(result).toEqual([{ disciplineId: "gewichtheben", name: "Gewichtheben", playerCount: 6 }]);
  });

  it("raet nichts, wenn es zu dem Spieltag keine Einsatzliste gibt", () => {
    const result = resolveInjuryMatchdayDisciplines({
      gameState: gameState({ drafts: [] }),
      teamId: "C-C",
      playerId: "p1",
      matchdayId: "md-3",
    });

    expect(result).toEqual([]);
  });

  it("greift nicht auf fremde Teams oder andere Spieltage zu", () => {
    const state = gameState({
      drafts: [
        { teamId: "P-S", matchdayId: "md-3", entries: [{ playerId: "p1", disciplineId: "tdm" }] },
        { teamId: "C-C", matchdayId: "md-4", entries: [{ playerId: "p1", disciplineId: "gewichtheben" }] },
      ],
    });

    expect(
      resolveInjuryMatchdayDisciplines({ gameState: state, teamId: "C-C", playerId: "p1", matchdayId: "md-3" }),
    ).toEqual([]);
  });
});
