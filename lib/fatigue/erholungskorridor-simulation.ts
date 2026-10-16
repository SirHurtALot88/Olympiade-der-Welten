/**
 * DIE BASISFALL-LIGA DES ERHOLUNGSKORRIDORS — geteilt von `scripts/messe-erholungskorridor.ts`
 * (Messung, beliebig viele Saaten) und `tests/injury-korridor-20-spieltage.test.ts` (Wächter).
 *
 * 32 Kader wie im Live-Spielstand (8–14, Ø 10,6), keine Gebäude, keine Traits, Intensität
 * „normal“, Rotation „niedrigste Fatigue zuerst“ — dieselbe Liga wie
 * `tests/injury-basisfall-korridor.test.ts`. Jeder Spieltag läuft über die echte Buchung
 * `applyFatigueAndInjuryAfterMatchday`; die Slots kommen aus dem echten Spielplan-Generator.
 * Docs: `docs/design/fatigue-aktive-erholung-korridor-16-10.md`.
 */
import type { GameState, LineupDraft, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { foundationSeedDisciplines } from "@/lib/data/dataAdapter";
import {
  applyFatigueAndInjuryAfterMatchday,
  getInjuryRiskPercent,
  getPlayerAvailabilityView,
  MATCHDAY_FATIGUE_LOAD,
} from "@/lib/fatigue/fatigue-injury-service";
import { buildSeasonSeededDisciplineSchedule } from "@/lib/season/season-discipline-schedule";
import { accumulateMatchdayTrainingProgress } from "@/lib/training/matchday-training-accumulator";

// Kadergrößen wie in tests/injury-basisfall-korridor.test.ts (Live-Spielstand, 32 Teams, Ø 10,6).
export const ROSTER_SIZES = [
  8, 8, 9, 9, 9, 9, 9, 10, 10, 10, 10, 10, 10, 10, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 12, 12, 12, 12, 13, 13,
  14,
];

// Die getippte 10er-Liste des Korridor-Tests (am Live-Spielstand gemessen) — Anschlusszeile.
export const KORRIDOR_TEST_SLOTS: Array<{ d1: number; d2: number }> = [
  { d1: 3, d2: 6 },
  { d1: 2, d2: 2 },
  { d1: 3, d2: 5 },
  { d1: 2, d2: 4 },
  { d1: 3, d2: 6 },
  { d1: 6, d2: 2 },
  { d1: 5, d2: 5 },
  { d1: 4, d2: 6 },
  { d1: 4, d2: 3 },
  { d1: 4, d2: 5 },
];

export type Slots = Array<{ d1: number; d2: number }>;

export function slotsFromRealSchedule(seed: string, repeat: 1 | 2): Slots {
  const plan = buildSeasonSeededDisciplineSchedule({
    saveId: seed,
    seasonId: "season-1",
    disciplines: foundationSeedDisciplines,
    repeat,
  });
  return plan.entries.map((entry) => ({
    d1: entry.discipline1?.playerCount ?? 0,
    d2: entry.discipline2?.playerCount ?? 0,
  }));
}

function buildPlayer(id: string, mitTraining: boolean): Player {
  return {
    id,
    name: id,
    rating: 60,
    marketValue: 20,
    salaryDemand: 5,
    displayMarketValue: 20,
    displaySalary: 5,
    className: "Hero",
    race: "Human",
    alignment: "neutral",
    gender: "m",
    subclasses: [],
    traitsPositive: [],
    traitsNegative: [],
    coreStats: { pow: 60, spe: 60, men: 60, soc: 60 },
    preferredDisciplineIds: [],
    disciplineRatings: {},
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 50,
    potential: 50,
    ...(mitTraining ? { trainingMode: "mittel" } : {}),
  } as unknown as Player;
}

export type KorridorOptionen = {
  /** Trainingsschicht „mittel“ über `accumulateMatchdayTrainingProgress` mitrechnen. */
  mitTraining?: boolean;
  /**
   * Spielmodus des simulierten Saves. „battle“ setzt `scenarioMeta.gameMode` und die 20 echten
   * Disziplinen — dann entscheidet bei ungesetztem ENV-Schalter das Gate (`isDoubledBattleSeason`)
   * selbst, genau wie im Spiel.
   */
  gameMode?: "battle" | "manager";
};

function buildLeague(matchdayCount: number, optionen: KorridorOptionen): GameState {
  const teams: Team[] = [];
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  ROSTER_SIZES.forEach((size, teamIndex) => {
    const teamId = `T-${teamIndex}`;
    teams.push({ teamId, shortCode: teamId, name: teamId, budget: 50, cash: 50, humanControlled: false } as unknown as Team);
    for (let playerIndex = 0; playerIndex < size; playerIndex += 1) {
      const playerId = `p-${teamIndex}-${playerIndex}`;
      players.push(buildPlayer(playerId, Boolean(optionen.mitTraining)));
      rosters.push({ id: `r-${teamIndex}-${playerIndex}`, teamId, playerId } as unknown as RosterEntry);
    }
  });
  return {
    gamePhase: "matchday",
    season: {
      id: "season-1",
      name: "Season 1",
      year: 1,
      currentMatchday: 1,
      matchdayIds: Array.from({ length: matchdayCount }, (_, i) => `md-${i + 1}`),
    },
    seasonState: {
      seasonId: "season-1",
      schedule: [],
      disciplineSchedule: [],
      lineupDrafts: [],
      injuryEvents: [],
      playerAvailabilityState: [],
    },
    matchdayState: { matchdayId: "md-1", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    ...(optionen.gameMode ? { scenarioMeta: { gameMode: optionen.gameMode } } : {}),
    teams,
    teamIdentities: [],
    players,
    disciplines: optionen.gameMode
      ? foundationSeedDisciplines
      : [
          { id: "disc-1", name: "D1", category: "power", weight: 1 },
          { id: "disc-2", name: "D2", category: "power", weight: 1 },
        ],
    rosters,
    contracts: [],
    transferListings: [],
    transferHistory: [],
    playerMoraleState: [],
    logs: [],
  } as unknown as GameState;
}

function selectLowestFatigue(gameState: GameState, teamId: string, matchdayId: string, count: number) {
  return gameState.rosters
    .filter((r) => r.teamId === teamId)
    .map((r) => ({ playerId: r.playerId, view: getPlayerAvailabilityView(gameState, r.playerId, teamId, matchdayId) }))
    .filter((entry) => !entry.view.isUnavailable)
    .sort((a, b) => a.view.fatigue - b.view.fatigue)
    .slice(0, count)
    .map((entry) => entry.playerId);
}

export type SeasonResult = {
  injuries: number;
  injuriesByMatchday: number[];
  rolls: number;
  rollsAt80Plus: number;
  avgFatigueEnd: number;
  avgFatigueMid: number;
  teamsWithLineupShortfall: number;
};

export function runKorridorSeason(saveId: string, slots: Slots, optionen: KorridorOptionen = {}): SeasonResult {
  let gameState = buildLeague(slots.length, optionen);
  const injuriesByMatchday: number[] = [];
  let rolls = 0;
  let rollsAt80Plus = 0;
  let avgFatigueMid = 0;
  const shortfallTeams = new Set<string>();

  const averageFatigue = (state: GameState) => {
    const values = state.rosters.map((r) => getPlayerAvailabilityView(state, r.playerId, r.teamId, "md-1").fatigue);
    return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  };

  for (let mdIndex = 0; mdIndex < slots.length; mdIndex += 1) {
    const matchdayId = `md-${mdIndex + 1}`;
    const { d1, d2 } = slots[mdIndex]!;
    const drafts: LineupDraft[] = gameState.teams.map((team) => {
      const picked = selectLowestFatigue(gameState, team.teamId, matchdayId, d1 + d2);
      if (picked.length < d1 + d2) shortfallTeams.add(team.teamId);
      return {
        lineupId: `lineup-${team.teamId}-${matchdayId}`,
        saveId,
        seasonId: "season-1",
        matchdayId,
        teamId: team.teamId,
        status: "submitted",
        entries: [
          ...picked.slice(0, d1).map((playerId, slotIndex) => ({
            disciplineId: "disc-1",
            disciplineSide: "d1" as const,
            slotIndex,
            playerId,
            activePlayerId: playerId,
          })),
          ...picked.slice(d1, d1 + d2).map((playerId, slotIndex) => ({
            disciplineId: "disc-2",
            disciplineSide: "d2" as const,
            slotIndex,
            playerId,
            activePlayerId: playerId,
          })),
        ],
        modifiers: { d1: { intensity: "normal" }, d2: { intensity: "normal" } },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      } as LineupDraft;
    });
    gameState = { ...gameState, seasonState: { ...gameState.seasonState, lineupDrafts: drafts } };
    const result = applyFatigueAndInjuryAfterMatchday({
      gameState,
      saveId,
      seasonId: "season-1",
      matchdayId,
      matchdayResultId: `result-${matchdayId}`,
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    gameState = result.gameState;
    if (optionen.mitTraining) {
      gameState = accumulateMatchdayTrainingProgress({
        gameState,
        seasonId: "season-1",
        matchdayId,
        deferredPlayerIds: result.deferredPlayerIds,
      });
    }
    rolls += result.injuryEvents.length;
    rollsAt80Plus += result.injuryEvents.filter((event) => event.fatigueBefore >= 80).length;
    injuriesByMatchday.push(result.injuryEvents.filter((event) => event.result === "injured").length);
    if (mdIndex + 1 === Math.floor(slots.length / 2)) avgFatigueMid = averageFatigue(gameState);
  }

  return {
    injuries: injuriesByMatchday.reduce((sum, value) => sum + value, 0),
    injuriesByMatchday,
    rolls,
    rollsAt80Plus,
    avgFatigueEnd: averageFatigue(gameState),
    avgFatigueMid,
    teamsWithLineupShortfall: shortfallTeams.size,
  };
}

/**
 * DER DAUERSTARTER — analytisch, ohne Würfel: ein Spieler, der JEDEN Spieltag bei „normal"
 * aufläuft. Wie viele Spieltage verbringt er im Maximalrisiko-Band (Wurf-Fatigue ≥ 80), und wie
 * viele Verletzungen ERWARTET man (Summe der Wurf-Wahrscheinlichkeiten, ohne Ausfall-Rückkopplung)?
 * Das ist die Rechnung aus Plan B.2 („3 von 10" / „13 von 20"), hier gegen die echte Risikokurve.
 */
export function dauerstarter(matchdays: number, activeCredit: number) {
  let fatigue = 0;
  let maxRiskDays = 0;
  let expectedInjuries = 0;
  let firstCapDay: number | null = null;
  for (let day = 1; day <= matchdays; day += 1) {
    fatigue = Math.max(0, Math.min(100, fatigue + MATCHDAY_FATIGUE_LOAD - activeCredit));
    if (fatigue >= 80) maxRiskDays += 1;
    if (fatigue >= 100 && firstCapDay === null) firstCapDay = day;
    expectedInjuries += getInjuryRiskPercent(fatigue) / 100;
  }
  return { maxRiskDays, expectedInjuries, firstCapDay };
}
