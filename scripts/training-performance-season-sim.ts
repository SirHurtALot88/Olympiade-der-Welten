/**
 * Simuliert organische Attributpunkte pro Saison nach Performance-Szenario
 * (keine / schlechte / mittlere / starke Saisonleistung).
 *
 * Usage: npx tsx scripts/training-performance-season-sim.ts
 */
import fs from "node:fs";
import path from "node:path";

import type {
  GameState,
  Player,
  PlayerDisciplinePerformanceRecord,
  PlayerGeneratorAttributes,
  PlayerPotentialRecord,
  TeamFacilityCollection,
} from "@/lib/data/olyDataTypes";
import { buildOrganicSeasonProgression } from "@/lib/training/organic-season-progression";

const OUTPUT_DIR = path.resolve(__dirname, "../outputs");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "training-performance-season-sim.json");

const SEASON_ID = "season-perf-sim";
const TEAM_ID = "team-sim";
const DISCIPLINE_ID = "gewichtheben";
const MATCHDAY_COUNT = 10;
const TRAINING_CENTER_LEVEL = 3;

type PerformanceScenarioId = "none" | "poor" | "average" | "strong";

type PerformanceScenario = {
  id: PerformanceScenarioId;
  label: string;
  appearances: number;
  buildRecord: (matchdayIndex: number) => Omit<PlayerDisciplinePerformanceRecord, "id" | "matchdayResultId" | "teamId" | "playerId" | "createdAt">;
};

const PERFORMANCE_SCENARIOS: PerformanceScenario[] = [
  {
    id: "none",
    label: "Keine Einsätze",
    appearances: 0,
    buildRecord: () => ({
      activePlayerId: null,
      disciplineId: DISCIPLINE_ID,
      disciplineSide: "d1",
      slotIndex: 0,
      baseValue: 0,
      finalPlayerScore: 0,
      scoreContribution: 0,
      rankInTeam: 0,
      rankInDiscipline: 99,
      isTop10: false,
      isMvpCandidate: false,
      storyWeight: null,
    }),
  },
  {
    id: "poor",
    label: "Schwache Saison",
    appearances: MATCHDAY_COUNT,
    buildRecord: (matchdayIndex) => ({
      activePlayerId: null,
      disciplineId: DISCIPLINE_ID,
      disciplineSide: "d1",
      slotIndex: 0,
      baseValue: 35,
      finalPlayerScore: 32 + (matchdayIndex % 3) * 3,
      scoreContribution: 6 + (matchdayIndex % 2) * 2,
      rankInTeam: 12,
      rankInDiscipline: 24 + (matchdayIndex % 4),
      isTop10: false,
      isMvpCandidate: false,
      storyWeight: null,
    }),
  },
  {
    id: "average",
    label: "Mittlere Saison",
    appearances: MATCHDAY_COUNT,
    buildRecord: (matchdayIndex) => ({
      activePlayerId: null,
      disciplineId: DISCIPLINE_ID,
      disciplineSide: "d1",
      slotIndex: 0,
      baseValue: 62,
      finalPlayerScore: 64 + (matchdayIndex % 3) * 2,
      scoreContribution: 16 + (matchdayIndex % 2) * 2,
      rankInTeam: 4,
      rankInDiscipline: 9 + (matchdayIndex % 3),
      isTop10: true,
      isMvpCandidate: false,
      storyWeight: null,
    }),
  },
  {
    id: "strong",
    label: "Starke Saison",
    appearances: MATCHDAY_COUNT,
    buildRecord: (matchdayIndex) => ({
      activePlayerId: null,
      disciplineId: DISCIPLINE_ID,
      disciplineSide: "d1",
      slotIndex: 0,
      baseValue: 88,
      finalPlayerScore: 92 + (matchdayIndex % 2),
      scoreContribution: 26 + (matchdayIndex % 2) * 2,
      rankInTeam: 1,
      rankInDiscipline: 1,
      isTop10: true,
      isMvpCandidate: true,
      storyWeight: null,
    }),
  },
];

type SimProfile = {
  id: string;
  label: string;
  player: Player;
  potentialRecord: PlayerPotentialRecord;
};

function attrs(overrides: Partial<PlayerGeneratorAttributes>): PlayerGeneratorAttributes {
  return {
    power: 60,
    health: 58,
    stamina: 56,
    intelligence: 50,
    awareness: 48,
    determination: 52,
    speed: 55,
    dexterity: 52,
    charisma: 48,
    will: 50,
    spirit: 46,
    torment: 50,
    ...overrides,
  };
}

function makePlayer(partial: Partial<Player> & { id: string; label?: string }): Player {
  return {
    id: partial.id,
    name: partial.name ?? partial.label ?? partial.id,
    rating: partial.rating ?? 60,
    marketValue: partial.marketValue ?? 20,
    salaryDemand: partial.salaryDemand ?? 4,
    className: partial.className ?? "Hero",
    race: "Human",
    alignment: "N",
    gender: "x",
    subclasses: [],
    traitsPositive: partial.traitsPositive ?? ["Diligent"],
    traitsNegative: partial.traitsNegative ?? [],
    coreStats: partial.coreStats ?? { pow: 60, spe: 55, men: 50, soc: 48 },
    attributeSheetStats: partial.attributeSheetStats ?? attrs({}),
    preferredDisciplineIds: [],
    disciplineRatings: partial.disciplineRatings ?? { d_pow: 60, d_spe: 55, d_men: 50, d_soc: 48 },
    disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 50,
    potential: partial.potential ?? 70,
    trainingMode: partial.trainingMode ?? "mittel",
    trainingClass: partial.trainingClass ?? null,
  };
}

function makePeerPool(): Player[] {
  return Array.from({ length: 30 }, (_, index) => {
    const pow = 40 + ((index * 7 + 3) % 21);
    const spe = 40 + ((index * 11 + 5) % 21);
    const men = 40 + ((index * 13 + 2) % 21);
    const soc = 40 + ((index * 17 + 9) % 21);
    const rating = Math.round((pow + spe + men + soc) / 4);
    return makePlayer({
      id: `peer-${index}`,
      label: `Peer ${index}`,
      rating,
      coreStats: { pow, spe, men, soc },
      disciplineRatings: { d_pow: pow, d_spe: spe, d_men: men, d_soc: soc },
    });
  });
}

const PROFILES: SimProfile[] = [
  {
    id: "mid",
    label: "Mitte",
    player: makePlayer({
      id: "sim-mid",
      label: "Liga Mitte",
      rating: 46,
      marketValue: 12,
      className: "Hero",
      trainingClass: "Hero",
      trainingMode: "mittel",
      coreStats: { pow: 46, spe: 45, men: 44, soc: 43 },
      attributeSheetStats: attrs({
        power: 46,
        health: 45,
        stamina: 44,
        speed: 45,
        dexterity: 44,
        intelligence: 43,
        awareness: 42,
        determination: 44,
        charisma: 43,
        will: 42,
        spirit: 41,
        torment: 42,
      }),
      disciplineRatings: { d_pow: 46, d_spe: 45, d_men: 44, d_soc: 43 },
    }),
    potentialRecord: {
      playerId: "sim-mid",
      potentialBand: "medium",
      hiddenPotentialScore: 72,
      confidence: 0,
      source: "generated",
      hiddenPotentialOverallStars: 2.5,
      hiddenPotentialCeilingByAxis: { pow: 3.5, spe: 3.5, men: 3.5, soc: 3.5 },
    },
  },
  {
    id: "top",
    label: "Top",
    player: makePlayer({
      id: "sim-top",
      label: "Elite Striker",
      rating: 78,
      marketValue: 55,
      className: "Berserker",
      trainingClass: "Berserker",
      trainingMode: "hart",
      coreStats: { pow: 84, spe: 72, men: 66, soc: 54 },
      attributeSheetStats: attrs({
        power: 78,
        health: 76,
        stamina: 74,
        speed: 70,
        dexterity: 68,
        intelligence: 54,
        awareness: 56,
        determination: 58,
        charisma: 48,
        will: 54,
        spirit: 50,
        torment: 62,
      }),
      disciplineRatings: { d_pow: 78, d_spe: 70, d_men: 58, d_soc: 48 },
    }),
    potentialRecord: {
      playerId: "sim-top",
      potentialBand: "elite",
      hiddenPotentialScore: 95,
      confidence: 0,
      source: "generated",
      hiddenPotentialOverallStars: 3.5,
      hiddenPotentialCeilingByAxis: { pow: 5, spe: 4, men: 3.5, soc: 3.5 },
    },
  },
];

function makeFacilities(trainingCenterLevel: number): TeamFacilityCollection {
  return {
    facilities: {
      training_center: { level: trainingCenterLevel, enabled: trainingCenterLevel > 0, conditionPct: 100 },
      recovery_center: { level: 0, enabled: false, conditionPct: 100 },
      scouting_office: { level: 0, enabled: false, conditionPct: 100 },
      analytics_room: { level: 0, enabled: false, conditionPct: 100 },
      fan_shop: { level: 0, enabled: false, conditionPct: 100 },
      arena_upgrade: { level: 0, enabled: false, conditionPct: 100 },
      academy: { level: 0, enabled: false, conditionPct: 100 },
    },
  };
}

function buildGameState(profile: SimProfile, peers: Player[], scenario: PerformanceScenario): GameState {
  const players = [profile.player, ...peers.filter((peer) => peer.id !== profile.player.id)];
  const matchdayResults = Array.from({ length: scenario.appearances }, (_, index) => ({
    id: `result-md-${index + 1}`,
    seasonId: SEASON_ID,
    matchdayId: `md-${index + 1}`,
    status: "preview_applied" as const,
  }));
  const playerDisciplinePerformances: PlayerDisciplinePerformanceRecord[] = Array.from(
    { length: scenario.appearances },
    (_, index) => {
      const partial = scenario.buildRecord(index);
      return {
        id: `perf-${profile.player.id}-${index + 1}`,
        matchdayResultId: matchdayResults[index]!.id,
        teamId: TEAM_ID,
        playerId: profile.player.id,
        createdAt: new Date().toISOString(),
        ...partial,
      };
    },
  );

  return {
    gamePhase: "player_development",
    season: { id: SEASON_ID, name: "Perf Sim Season", currentMatchday: MATCHDAY_COUNT, totalMatchdays: MATCHDAY_COUNT, isCompleted: true },
    seasonState: {
      seasonId: SEASON_ID,
      schedule: [],
      standings: {},
      matchdayResults,
      playerDisciplinePerformances,
      disciplineHighlights: [],
    },
    matchdayState: { matchdayId: `md-${MATCHDAY_COUNT}`, status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: TEAM_ID, name: "Sim Team", shortCode: "SIM", budget: 100, cash: 100, salaryTotal: 0, rosterValue: 0 }],
    teamIdentities: [],
    players,
    disciplines: [
      { id: "d_pow", name: "Pow", category: "power", displayOrder: 1, originalOrder: 1, playerCount: 35 },
      { id: "d_spe", name: "Spe", category: "speed", displayOrder: 2, originalOrder: 2, playerCount: 35 },
      { id: "d_men", name: "Men", category: "mental", displayOrder: 3, originalOrder: 3, playerCount: 35 },
      { id: "d_soc", name: "Soc", category: "social", displayOrder: 4, originalOrder: 4, playerCount: 35 },
    ],
    rosters: [
      {
        id: "r-sim",
        teamId: TEAM_ID,
        playerId: profile.player.id,
        salary: 5,
        marketValue: profile.player.marketValue,
        contractLength: 2,
      },
    ],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    playerPotential: [profile.potentialRecord],
    mappingReport: {
      mappingSource: "sim",
      teamSource: "sim",
      generatedAt: new Date().toISOString(),
      processedMappingRows: 0,
      importedPlayerCount: players.length,
      matchedRosterCount: 1,
      warnings: [],
    },
  };
}

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function formatSigned(value: number, digits = 2) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}`;
}

function formatTopDelta(breakdown: ReturnType<typeof buildOrganicSeasonProgression>["attributeBreakdown"], direction: "gain" | "loss") {
  const sorted = [...breakdown].sort((left, right) => (direction === "gain" ? right.delta - left.delta : left.delta - right.delta));
  const entry = sorted.find((candidate) => (direction === "gain" ? candidate.delta > 0 : candidate.delta < 0));
  if (!entry) return "—";
  return `${entry.attribute} ${formatSigned(entry.delta)}`;
}

type SimRow = {
  profile: string;
  scenario: string;
  scenarioId: PerformanceScenarioId;
  appearances: number;
  trainingSetpoints: number;
  performanceSetpoints: number;
  performanceRegressionTotal: number;
  trainingDeltaSum: number;
  regressionDeltaSum: number;
  netSetpoints: number;
  topGain: string;
  topLoss: string;
};

function runSimulation() {
  const peers = makePeerPool();
  const facilities = makeFacilities(TRAINING_CENTER_LEVEL);
  const rows: SimRow[] = [];

  for (const profile of PROFILES) {
    for (const scenario of PERFORMANCE_SCENARIOS) {
      const gameState = buildGameState(profile, peers, scenario);
      const result = buildOrganicSeasonProgression({ gameState, player: profile.player, facilities });
      rows.push({
        profile: profile.label,
        scenario: scenario.label,
        scenarioId: scenario.id,
        appearances: scenario.appearances,
        trainingSetpoints: result.trainingSetpoints,
        performanceSetpoints: result.performanceSetpoints,
        performanceRegressionTotal: result.performanceRegressionTotal,
        trainingDeltaSum: roundValue(result.attributeBreakdown.reduce((sum, entry) => sum + entry.training, 0), 2),
        regressionDeltaSum: roundValue(result.attributeBreakdown.reduce((sum, entry) => sum + entry.regression, 0), 2),
        netSetpoints: result.netSetpoints,
        topGain: formatTopDelta(result.attributeBreakdown, "gain"),
        topLoss: formatTopDelta(result.attributeBreakdown, "loss"),
      });
    }
  }

  return rows;
}

function printTable(rows: SimRow[]) {
  const header = [
    "Profil".padEnd(6),
    "Szenario".padEnd(16),
    "Eins".padStart(4),
    "trainPts".padStart(8),
    "perfPts".padStart(8),
    "perfReg".padStart(8),
    "regSum".padStart(8),
    "netPts".padStart(8),
    "Top Gain",
    "Top Loss",
  ].join(" | ");

  console.log(`\nPerformance-Saison-Simulation (TC L${TRAINING_CENTER_LEVEL}, ${MATCHDAY_COUNT} Spieltage)\n`);
  console.log(header);
  console.log("-".repeat(header.length));

  for (const row of rows) {
    console.log(
      [
        row.profile.padEnd(6),
        row.scenario.padEnd(16),
        String(row.appearances).padStart(4),
        row.trainingSetpoints.toFixed(2).padStart(8),
        row.performanceSetpoints.toFixed(2).padStart(8),
        formatSigned(row.performanceRegressionTotal).padStart(8),
        formatSigned(row.regressionDeltaSum).padStart(8),
        formatSigned(row.netSetpoints).padStart(8),
        row.topGain,
        row.topLoss,
      ].join(" | "),
    );
  }
}

function main() {
  const rows = runSimulation();
  printTable(rows);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        description: "Organic attribute setpoints by season performance scenario; TC L3",
        trainingCenterLevel: TRAINING_CENTER_LEVEL,
        matchdayCount: MATCHDAY_COUNT,
        rows,
      },
      null,
      2,
    ),
  );
  console.log(`\nJSON: ${OUTPUT_FILE}\n`);
}

main();
