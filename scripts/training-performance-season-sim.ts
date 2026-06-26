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
    id: "cheap",
    label: "Billo",
    player: makePlayer({
      id: "sim-cheap",
      label: "Billo",
      rating: 42,
      marketValue: 15,
      className: "Hero",
      trainingClass: "Hero",
      trainingMode: "mittel",
      coreStats: { pow: 42, spe: 41, men: 40, soc: 39 },
      attributeSheetStats: attrs({
        power: 42,
        health: 41,
        stamina: 40,
        speed: 41,
        dexterity: 40,
        intelligence: 39,
        awareness: 38,
        determination: 40,
        charisma: 39,
        will: 38,
        spirit: 37,
        torment: 38,
      }),
      disciplineRatings: { d_pow: 42, d_spe: 41, d_men: 40, d_soc: 39 },
    }),
    potentialRecord: {
      playerId: "sim-cheap",
      potentialBand: "low",
      hiddenPotentialScore: 58,
      confidence: 0,
      source: "generated",
      hiddenPotentialOverallStars: 2,
      hiddenPotentialCeilingByAxis: { pow: 3, spe: 3, men: 3, soc: 3 },
    },
  },
  {
    id: "core",
    label: "Core",
    player: makePlayer({
      id: "sim-core",
      label: "Core Spieler",
      rating: 52,
      marketValue: 27,
      className: "Hero",
      trainingClass: "Hero",
      trainingMode: "mittel",
      coreStats: { pow: 52, spe: 51, men: 50, soc: 49 },
      attributeSheetStats: attrs({
        power: 52,
        health: 51,
        stamina: 50,
        speed: 51,
        dexterity: 50,
        intelligence: 49,
        awareness: 48,
        determination: 50,
        charisma: 49,
        will: 48,
        spirit: 47,
        torment: 48,
      }),
      disciplineRatings: { d_pow: 52, d_spe: 51, d_men: 50, d_soc: 49 },
    }),
    potentialRecord: {
      playerId: "sim-core",
      potentialBand: "medium",
      hiddenPotentialScore: 72,
      confidence: 0,
      source: "generated",
      hiddenPotentialOverallStars: 2.5,
      hiddenPotentialCeilingByAxis: { pow: 3.5, spe: 3.5, men: 3.5, soc: 3.5 },
    },
  },
  {
    id: "core-capped",
    label: "CoreCap",
    player: makePlayer({
      id: "sim-core-capped",
      label: "Core capped",
      rating: 52,
      marketValue: 27,
      className: "Hero",
      trainingClass: "Hero",
      trainingMode: "mittel",
      coreStats: { pow: 52, spe: 51, men: 50, soc: 49 },
      attributeSheetStats: attrs({
        power: 52,
        health: 51,
        stamina: 50,
        speed: 51,
        dexterity: 50,
        intelligence: 49,
        awareness: 48,
        determination: 50,
        charisma: 49,
        will: 48,
        spirit: 47,
        torment: 48,
      }),
      disciplineRatings: { d_pow: 52, d_spe: 51, d_men: 50, d_soc: 49 },
    }),
    potentialRecord: {
      playerId: "sim-core-capped",
      potentialBand: "medium",
      hiddenPotentialScore: 68,
      confidence: 0.8,
      source: "generated",
      hiddenPotentialOverallStars: 2.5,
      hiddenPotentialCeilingByAxis: { pow: 3, spe: 3, men: 3, soc: 3 },
      hiddenAttributeCeiling: {
        power: 54,
        health: 53,
        stamina: 52,
        speed: 53,
        dexterity: 52,
        intelligence: 51,
        awareness: 50,
        determination: 52,
        charisma: 51,
        will: 50,
        spirit: 49,
        torment: 50,
      },
    },
  },
  {
    label: "Star",
    player: makePlayer({
      id: "sim-star",
      label: "Star Striker",
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
      playerId: "sim-star",
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
  appliedPerformanceSetpoints: number;
  trainingDeltaSum: number;
  performanceDeltaSum: number;
  regressionFlatTotal: number;
  regressionMarketValueTotal: number;
  marktwertBase: number;
  regressionCombinedTotal: number;
  marketValuePressureRatePct: number;
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
        appliedPerformanceSetpoints: result.appliedPerformanceSetpoints,
        trainingDeltaSum: roundValue(result.attributeBreakdown.reduce((sum, entry) => sum + entry.training, 0), 2),
        performanceDeltaSum: result.appliedPerformanceSetpoints,
        regressionFlatTotal: result.regressionBreakdown.baseFlatTotal,
        regressionMarketValueTotal: result.regressionBreakdown.marketValueTotal,
        marktwertBase: result.regressionBreakdown.marktwertBase,
        regressionCombinedTotal: result.regressionBreakdown.combinedTotal,
        marketValuePressureRatePct: result.regressionBreakdown.marketValuePressureRatePct,
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
    "MW".padStart(5),
    "trainΔ".padStart(7),
    "perfΔ".padStart(7),
    "regFlat".padStart(7),
    "regMW".padStart(7),
    "netPts".padStart(8),
    "Top Gain",
    "Top Loss",
  ].join(" | ");

  console.log(`\nPerformance-Saison-Simulation (TC L${TRAINING_CENTER_LEVEL}, ${MATCHDAY_COUNT} Spieltage)\n`);
  console.log("Net = trainΔ + perfΔ + regFlat + regMW  |  regFlat = −0,25/Attr (−3,00)  |  regMW = −MW × 0,6 % × 12 Attr (kein Relief)\n");
  console.log(header);
  console.log("-".repeat(header.length));

  for (const row of rows) {
    console.log(
      [
        row.profile.padEnd(6),
        row.scenario.padEnd(16),
        String(row.appearances).padStart(4),
        row.marktwertBase.toFixed(0).padStart(5),
        formatSigned(row.trainingDeltaSum).padStart(7),
        formatSigned(row.performanceDeltaSum).padStart(7),
        formatSigned(row.regressionFlatTotal).padStart(7),
        formatSigned(row.regressionMarketValueTotal).padStart(7),
        formatSigned(row.netSetpoints).padStart(8),
        row.topGain,
        row.topLoss,
      ].join(" | "),
    );
  }

  const sample = rows.find((row) => row.appearances > 0);
  if (sample) {
    console.log(`\nFormel: regMW/Attr = −Marktwert × 0,006  |  regMW gesamt = regMW/Attr × 12  |  MW-Rate: ${sample.marketValuePressureRatePct.toFixed(1)} %/Attr`);
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
