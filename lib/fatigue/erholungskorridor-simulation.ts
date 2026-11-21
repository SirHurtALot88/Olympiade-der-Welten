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
import type {
  GameState,
  LineupDraft,
  Player,
  PlayerAttributeSheetStats,
  RosterEntry,
  SeasonDisciplineScheduleEntry,
  Team,
} from "@/lib/data/olyDataTypes";
import { foundationSeedDisciplines } from "@/lib/data/dataAdapter";
import { ordneSpielerAufPlaetze } from "@/lib/ai/ai-belastung-platzwahl";
import { BELASTUNG_KI_LASTGEWICHT } from "@/lib/fatigue/belastung-regel";
import { playerGeneratorAttributeKeys } from "@/lib/player-generator/official-discipline-weights";
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

export function realSchedule(seed: string, repeat: 1 | 2): SeasonDisciplineScheduleEntry[] {
  return buildSeasonSeededDisciplineSchedule({
    saveId: seed,
    seasonId: "season-1",
    disciplines: foundationSeedDisciplines,
    repeat,
  }).entries.map((entry, index) => ({ ...entry, matchdayId: `md-${index + 1}` }));
}

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

/** Deterministischer Zufall je Spieler (mulberry32 über einen FNV-Hash der ID). */
function zufallFuer(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Attributwerte wie im Bestand: stückweise lineare Verteilung durch die am Live-Spielstand gemessenen
 * Anteile (docs/design/belastung-resistenz-21-11.md: rund 41 % unter 45, 60 % unter 60, 82 % unter 75).
 */
const ATTRIBUT_VERTEILUNG: Array<[number, number]> = [
  [0, 1],
  [0.41, 45],
  [0.6, 60],
  [0.82, 75],
  [1, 99],
];

function zieheAttribut(u: number) {
  for (let i = 0; i < ATTRIBUT_VERTEILUNG.length - 1; i += 1) {
    const [p0, w0] = ATTRIBUT_VERTEILUNG[i]!;
    const [p1, w1] = ATTRIBUT_VERTEILUNG[i + 1]!;
    if (u <= p1) return Math.round(w0 + ((u - p0) / (p1 - p0)) * (w1 - w0));
  }
  return 99;
}

export function synthetischeAttribute(id: string): PlayerAttributeSheetStats {
  const zufall = zufallFuer(`attr:${id}`);
  return Object.fromEntries(
    playerGeneratorAttributeKeys.map((key) => [key, zieheAttribut(zufall())]),
  ) as unknown as PlayerAttributeSheetStats;
}

function buildPlayer(id: string, mitTraining: boolean, mitAttributen = false): Player {
  return {
    ...(mitAttributen ? { attributeSheetStats: synthetischeAttribute(id) } : {}),
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
  /**
   * Belastungsregel v2 (21.11.): setzt den Saison-Stempel (Battle, 20 Spieltage nötig), gibt den
   * Spielern Attribute und spielt die echten Disziplinen des Spielplans (`spielplan`, Pflicht).
   */
  belastungsRegel?: "v2";
  /** Echter Spielplan (Disziplin-IDs je Spieltag) — Pflicht unter v2, sonst ungenutzt. */
  spielplan?: SeasonDisciplineScheduleEntry[];
  /** Spieler mit Attributen, auch ohne v2 (Vergleich „heute" mit denselben Spielern). */
  mitAttributen?: boolean;
  /**
   * Wie die Gewählten einer Seite auf die Plätze kommen:
   *   "reihenfolge" — wie gewählt (Standard, bisheriger Basisfall),
   *   "platzwert"   — nach Rollen-Aufschlag, ohne Last (KI ohne Resistenz),
   *   "ki"          — Rollen-Aufschlag − BELASTUNG_KI_LASTGEWICHT × Last (die gebaute KI),
   *   "last"        — rein nach Last (Obergrenze: alle setzen nach Resistenz).
   */
  platzwahl?: "reihenfolge" | "platzwert" | "ki" | "last";
};

export function buildKorridorLeague(matchdayCount: number, optionen: KorridorOptionen): GameState {
  const mitAttributen = Boolean(optionen.mitAttributen || optionen.belastungsRegel === "v2");
  const teams: Team[] = [];
  const players: Player[] = [];
  const rosters: RosterEntry[] = [];
  ROSTER_SIZES.forEach((size, teamIndex) => {
    const teamId = `T-${teamIndex}`;
    teams.push({ teamId, shortCode: teamId, name: teamId, budget: 50, cash: 50, humanControlled: false } as unknown as Team);
    for (let playerIndex = 0; playerIndex < size; playerIndex += 1) {
      const playerId = `p-${teamIndex}-${playerIndex}`;
      players.push(buildPlayer(playerId, Boolean(optionen.mitTraining), mitAttributen));
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
      disciplineSchedule: optionen.spielplan ?? [],
      ...(optionen.belastungsRegel === "v2" ? { belastungsRegel: { seasonId: "season-1", version: "v2" as const } } : {}),
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
  /** Der Spielstand nach dem letzten Spieltag (für Bit-Gleichheits-Prüfungen). */
  endState: GameState;
};

export function runKorridorSeason(saveId: string, slots: Slots, optionen: KorridorOptionen = {}): SeasonResult {
  let gameState = buildKorridorLeague(slots.length, optionen);
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
    const planEintrag = optionen.spielplan?.[mdIndex] ?? null;
    const disc1 = planEintrag?.discipline1?.disciplineId ?? "disc-1";
    const disc2 = planEintrag?.discipline2?.disciplineId ?? "disc-2";
    const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
    const ordne = (ids: string[], disciplineId: string, slotCount: number) => {
      const art = optionen.platzwahl ?? "reihenfolge";
      if (art === "reihenfolge" || ids.length < 2) return ids;
      return ordneSpielerAufPlaetze({
        disciplineId,
        slotCount,
        altGrundlast: MATCHDAY_FATIGUE_LOAD,
        lastGewicht: art === "platzwert" ? 0 : art === "last" ? 1000 : BELASTUNG_KI_LASTGEWICHT,
        spieler: ids.map((id) => ({ playerId: id, attributeStats: playerById.get(id)?.attributeSheetStats ?? null, lastFaktor: 1 })),
      });
    };
    const drafts: LineupDraft[] = gameState.teams.map((team) => {
      const gewaehlt = selectLowestFatigue(gameState, team.teamId, matchdayId, d1 + d2);
      if (gewaehlt.length < d1 + d2) shortfallTeams.add(team.teamId);
      const picked = [...ordne(gewaehlt.slice(0, d1), disc1, d1), ...ordne(gewaehlt.slice(d1, d1 + d2), disc2, d2)];
      return {
        lineupId: `lineup-${team.teamId}-${matchdayId}`,
        saveId,
        seasonId: "season-1",
        matchdayId,
        teamId: team.teamId,
        status: "submitted",
        entries: [
          ...picked.slice(0, d1).map((playerId, slotIndex) => ({
            disciplineId: disc1,
            disciplineSide: "d1" as const,
            slotIndex,
            playerId,
            activePlayerId: playerId,
          })),
          ...picked.slice(d1, d1 + d2).map((playerId, slotIndex) => ({
            disciplineId: disc2,
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
        // Reine Belastungs-Simulation: nur die Trainingsschicht, kein Attribut-Zuwachs.
        mitZuwachs: false,
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
    endState: gameState,
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
