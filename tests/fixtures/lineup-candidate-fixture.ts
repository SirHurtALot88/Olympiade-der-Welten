/**
 * Feste Fixture fuer die Charakterisierungstests des Rechenkerns in
 * lib/lineups/lineup-candidate-model.ts und lib/lineups/lineup-audit.ts.
 *
 * Szenario: Spieltag mit zwei Disziplinen (TDM als D1, Mini DM als D2), je 2 Plaetze. 6 Spieler
 * im Kader, davon 3 gesetzt, 1 Slot offen (Mini DM, Slot 2) — genau der Fall, den
 * `teamdeckCandidateEntries`/`slotCandidateSummaryByKey` fuer den aktiven Slot vorschlagen
 * muessen, und den `slotIssuesByKey`/`lineupMiniAudit` als offen melden muessen.
 *
 *   - Aria Nox (active-1): staerkster TDM-Spieler, gesetzt auf TDM-Slot 0, Captain D1.
 *     Hat eine ERFUELLTE Captain-Forderung (testet den "Forderung erfüllt"-Zweig).
 *   - Bo Reyn (active-2): zweitstaerkster TDM-Spieler, gesetzt auf TDM-Slot 1.
 *   - Cato Vale (active-3): staerkster Mini-DM-Spieler, gesetzt auf Mini-DM-Slot 0.
 *   - Dee Marsh (active-4): starker Mini-DM-Wert, aber VERLETZT (availabilityBlocker) —
 *     muss als "Verletzt" blockiert erscheinen, nicht als generisch "blockiert".
 *   - Enzo Kade (active-5): mittelstark auf beiden Seiten, aber ERHOEHTE FATIGUE (72) —
 *     muss in die "fatigue"-Gruppe fallen, nicht in "instant"/"alternative". Hat zudem eine
 *     UNERFUELLTE Forderung (testet den "Forderung offen"-Zweig, wo sie sichtbar wird).
 *   - Fia Rook (active-6): schwacher TDM-, brauchbarer Mini-DM-Wert — der naheliegende
 *     "sofort passt"-Kandidat fuer den offenen Mini-DM-Slot.
 *
 * Der offene Slot (Mini DM, Slot 2) ist der `activeSlot`. Kandidaten dafuer, in der Reihenfolge,
 * die die Sortier-Regel liefern MUSS: Fia (bester sauberer Fit) vor Enzo (Fatigue-Risiko) vor
 * Dee (blockiert/verletzt). Cato ist in D2 bereits gesetzt und daher "blocked" (andernorts
 * eingesetzt). Aria/Bo sind in D1 gesetzt, fuer D2 aber grundsaetzlich verfuegbar (kein
 * Mini-DM-Basiswert-Ausschluss) — sie erscheinen ebenfalls, typischerweise als schwaechere
 * Alternativen/Notfaelle je nach projiziertem Score.
 */
import type { PlayerAttributeSheetStats } from "@/lib/data/olyDataTypes";
import type { LegacyLineupLoadedContext } from "@/lib/lineups/legacy-lineup-types";
import type { LineupMoraleDecision } from "@/lib/lineups/lineup-audit";
import type { LineupPlayerTableRow } from "@/lib/lineups/lineup-candidate-model";

const SAVE_ID = "save-1";
const SEASON_ID = "season-1";
const MATCHDAY_ID = "matchday-1";
const TEAM_ID = "A-A";

function attributeStats(overrides: Partial<PlayerAttributeSheetStats>): PlayerAttributeSheetStats {
  return {
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
    height: 180,
    ...overrides,
  };
}

type FixturePlayer = {
  playerId: string;
  activePlayerId: string;
  name: string;
  className: string;
  tdmScore: number;
  miniDmScore: number;
  fatigueCount: number;
  injuryStatus: "healthy" | "injured" | "recovering";
  availabilityBlocker: "player_injured_unavailable" | null;
  attributeStats: PlayerAttributeSheetStats;
};

const PLAYERS: FixturePlayer[] = [
  {
    playerId: "player-1",
    activePlayerId: "active-1",
    name: "Aria Nox",
    className: "tank",
    tdmScore: 82,
    miniDmScore: 40,
    fatigueCount: 12,
    injuryStatus: "healthy",
    availabilityBlocker: null,
    attributeStats: attributeStats({ power: 78, health: 74, stamina: 60, determination: 55 }),
  },
  {
    playerId: "player-2",
    activePlayerId: "active-2",
    name: "Bo Reyn",
    className: "hero",
    tdmScore: 76,
    miniDmScore: 38,
    fatigueCount: 6,
    injuryStatus: "healthy",
    availabilityBlocker: null,
    attributeStats: attributeStats({ stamina: 68, spirit: 62, health: 58 }),
  },
  {
    playerId: "player-3",
    activePlayerId: "active-3",
    name: "Cato Vale",
    className: "rogue",
    tdmScore: 41,
    miniDmScore: 81,
    fatigueCount: 9,
    injuryStatus: "healthy",
    availabilityBlocker: null,
    attributeStats: attributeStats({ torment: 72, dexterity: 66, will: 60 }),
  },
  {
    playerId: "player-4",
    activePlayerId: "active-4",
    name: "Dee Marsh",
    className: "tank",
    tdmScore: 39,
    miniDmScore: 74,
    fatigueCount: 0,
    injuryStatus: "injured",
    availabilityBlocker: "player_injured_unavailable",
    attributeStats: attributeStats({ health: 70, stamina: 65 }),
  },
  {
    playerId: "player-5",
    activePlayerId: "active-5",
    name: "Enzo Kade",
    className: "hero",
    tdmScore: 60,
    miniDmScore: 58,
    fatigueCount: 72,
    injuryStatus: "healthy",
    availabilityBlocker: null,
    attributeStats: attributeStats({ will: 64, torment: 58, dexterity: 55 }),
  },
  {
    playerId: "player-6",
    activePlayerId: "active-6",
    name: "Fia Rook",
    className: "rogue",
    tdmScore: 25,
    miniDmScore: 55,
    fatigueCount: 4,
    injuryStatus: "healthy",
    availabilityBlocker: null,
    attributeStats: attributeStats({ dexterity: 62, will: 58, health: 50 }),
  },
];

export function buildFixture() {
  const disciplinePlayerCounts = { tdm: 2, "mini-dm": 2 };

  const context = {
    saveId: SAVE_ID,
    seasonId: SEASON_ID,
    matchdayId: MATCHDAY_ID,
    teamId: TEAM_ID,
    entries: [],
    disciplinePlayerCounts,
    activePlayers: PLAYERS.map((player) => ({
      id: player.activePlayerId,
      saveId: SAVE_ID,
      seasonId: SEASON_ID,
      teamId: TEAM_ID,
      playerId: player.playerId,
      contractLength: 3,
      salary: 100,
      upkeep: 10,
      marketValue: 1000,
    })),
    disciplineScores: PLAYERS.flatMap((player) => [
      { playerId: player.playerId, disciplineId: "tdm", score: player.tdmScore },
      { playerId: player.playerId, disciplineId: "mini-dm", score: player.miniDmScore },
    ]),
    save: { id: SAVE_ID, name: "Save 1", status: "active" },
    season: { id: SEASON_ID, saveId: SAVE_ID, name: "Season 1", year: 1, currentMatchday: 1, status: "active" },
    matchday: { id: MATCHDAY_ID, seasonId: SEASON_ID, index: 1, label: "Spieltag 1", status: "planning" },
    team: { id: TEAM_ID, shortCode: "A-A", name: "Armageddon Aftermath" },
    teamSeasonState: { id: "tss-1", saveId: SAVE_ID, seasonId: SEASON_ID, teamId: TEAM_ID, cash: 100, budget: 200, rosterLimit: 8, playerOpt: 6 },
    teamIdentity: { pow: 12, spe: 11, men: 10, soc: 9 },
    rosterPlayers: PLAYERS.map((player) => ({
      id: player.playerId,
      name: player.name,
      portraitUrl: null,
      className: player.className,
      attributeStats: player.attributeStats,
      attributeRatings: null,
      coreStats: { pow: 10, spe: 10, men: 10, soc: 10 },
      injuryStatus: player.injuryStatus,
      availabilityBlocker: player.availabilityBlocker,
      traitsPositive: [],
      traitsNegative: [],
    })),
    disciplines: [
      { id: "tdm", name: "TDM", category: "tactics" },
      { id: "mini-dm", name: "Mini DM", category: "tactics" },
    ],
    disciplineWeights: [],
    seasonDisciplineConfigs: [
      { disciplineId: "tdm", originalOrder: 1, displayOrder: 1, playerCount: 2, mutator1: null, mutator2: null },
      { disciplineId: "mini-dm", originalOrder: 2, displayOrder: 2, playerCount: 2, mutator1: null, mutator2: null },
    ],
    existingDraft: null,
    contextMeta: { saveId: SAVE_ID, seasonId: SEASON_ID, matchdayId: MATCHDAY_ID, teamId: TEAM_ID, d1DisciplineId: "tdm", d2DisciplineId: "mini-dm" },
    matchdayContract: {
      matchdayId: MATCHDAY_ID,
      matchdayLabel: "Spieltag 1",
      matchdayIndex: 1,
      discipline1: {
        disciplineId: "tdm",
        displayName: "TDM",
        requiredPlayers: 2,
        requiredCaptains: 1,
        category: "tactics",
        rankSource: null,
        rankSourceStatus: "missing_source",
        sourceStatus: "ready",
        disciplineSide: "d1" as const,
      },
      discipline2: {
        disciplineId: "mini-dm",
        displayName: "Mini DM",
        requiredPlayers: 2,
        requiredCaptains: 1,
        category: "tactics",
        rankSource: null,
        rankSourceStatus: "missing_source",
        sourceStatus: "ready",
        disciplineSide: "d2" as const,
      },
      seasonCaptainSlots: 3,
      totalDisciplineSidesInSeason: 10,
    },
    formCardSource: { selectionStatus: "missing_source" as const, effectStatus: "missing_source" as const, sourceLabel: "Test", warnings: [] },
    mutatorSource: { selectionStatus: "missing_source" as const, effectStatus: "missing_source" as const, sourceLabel: "Test", warnings: [] },
    teamPowerSource: { selectionStatus: "missing_source" as const, effectStatus: "missing_source" as const, sourceLabel: "Test", warnings: [] },
    teamPowerWindows: {},
    fatigueByPlayerId: Object.fromEntries(PLAYERS.map((player) => [player.playerId, { count: player.fatigueCount, multiplier: 1 }])),
  } as unknown as LegacyLineupLoadedContext;

  // 3 von 4 Slots gesetzt — Mini-DM-Slot 1 (Index 1) bleibt offen.
  const selections: Record<string, string> = {
    "tdm::d1::0": "active-1",
    "tdm::d1::1": "active-2",
    "mini-dm::d2::0": "active-3",
    "mini-dm::d2::1": "",
  };
  const captains: Record<"d1" | "d2", string> = { d1: "active-1", d2: "" };
  const activeSlotKey = "mini-dm::d2::1";

  const playerRows: LineupPlayerTableRow[] = PLAYERS.map((player) => ({
    id: player.playerId,
    activePlayerId: player.activePlayerId,
    portraitUrl: null,
    name: player.name,
    teamName: "Armageddon Aftermath",
    contractLength: 3,
    className: player.className,
    potential: null,
    discipline1Score: player.tdmScore,
    discipline2Score: player.miniDmScore,
    appearances: player.fatigueCount,
    marketValue: 1000,
    playerOvr: null,
    playerPps: null,
    coreStats: { pow: 10, spe: 10, men: 10, soc: 10 },
    traitsPositive: [],
    traitsNegative: [],
    injuryStatus: player.injuryStatus,
    injuryRiskLabel: null,
    availabilityBlocker: player.availabilityBlocker,
    demands:
      player.playerId === "player-1"
        ? [
            {
              demandId: "demand-aria",
              label: "Captain-Rolle",
              detail: "Möchte Captain sein",
              targetDisciplineId: "tdm",
              status: "open",
              priority: "medium",
              moraleReward: 4,
              moralePenalty: -2,
            },
          ]
        : player.playerId === "player-5"
          ? [
              {
                demandId: "demand-enzo",
                label: "Captain-Rolle",
                detail: "Möchte Captain sein",
                targetDisciplineId: "tdm",
                status: "open",
                priority: "high",
                moraleReward: 5,
                moralePenalty: -3,
              },
            ]
          : [],
    attributeStats: player.attributeStats,
    attributeRatings: null,
  }));

  // Handgebaut statt ueber `getDemandMoraleValue`/`moraleDecisions` gerechnet — deren Formel
  // ist nicht Teil dieses Verschiebe-Schritts, deshalb hier fest verdrahtet: Aria ist Captain
  // (D1) und erfuellt ihre eigene Forderung; Enzo ist es nicht (Captain-Sitz ist an Aria vergeben).
  const moraleDecisionsByActivePlayerId = new Map<string, LineupMoraleDecision[]>([
    [
      "active-1",
      [
        {
          playerId: "player-1",
          activePlayerId: "active-1",
          playerName: "Aria Nox",
          demandId: "demand-aria",
          label: "Captain-Rolle",
          detail: "Möchte Captain sein",
          priority: "medium",
          targetDisciplineId: "tdm",
          fulfilled: true,
          isRelevant: true,
          moraleDelta: 4,
        },
      ],
    ],
    [
      "active-5",
      [
        {
          playerId: "player-5",
          activePlayerId: "active-5",
          playerName: "Enzo Kade",
          demandId: "demand-enzo",
          label: "Captain-Rolle",
          detail: "Möchte Captain sein",
          priority: "high",
          targetDisciplineId: "tdm",
          fulfilled: false,
          isRelevant: true,
          moraleDelta: -3.45,
        },
      ],
    ],
  ]);

  const lineupMeta = { d1Selected: 2, d2Selected: 1 };

  return { context, selections, captains, activeSlotKey, playerRows, moraleDecisionsByActivePlayerId, lineupMeta };
}
