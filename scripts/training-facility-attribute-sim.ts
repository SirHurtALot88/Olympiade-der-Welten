/**
 * Simuliert organische Attributpunkte pro Saison für Top-, Mittel- und schwache Spieler
 * bei Trainingszentrum Level 0–5 (reines Training, keine Matchday-Performance).
 *
 * Usage: npx tsx scripts/training-facility-attribute-sim.ts
 */
import fs from "node:fs";
import path from "node:path";

import type {
  GameState,
  Player,
  PlayerGeneratorAttributes,
  PlayerPotentialRecord,
  TeamFacilityCollection,
} from "@/lib/data/olyDataTypes";
import { buildOrganicSeasonProgression } from "@/lib/training/organic-season-progression";

const OUTPUT_DIR = path.resolve(__dirname, "../outputs");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "training-facility-attribute-sim.json");

const DISCIPLINES = [
  { id: "d_pow", name: "Pow", category: "power" as const, displayOrder: 1, originalOrder: 1, playerCount: 35 },
  { id: "d_spe", name: "Spe", category: "speed" as const, displayOrder: 2, originalOrder: 2, playerCount: 35 },
  { id: "d_men", name: "Men", category: "mental" as const, displayOrder: 3, originalOrder: 3, playerCount: 35 },
  { id: "d_soc", name: "Soc", category: "social" as const, displayOrder: 4, originalOrder: 4, playerCount: 35 },
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
      disciplineRatings: {
        d_pow: pow,
        d_spe: spe,
        d_men: men,
        d_soc: soc,
      },
    });
  });
}

const PROFILES: SimProfile[] = [
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
    id: "weak",
    label: "Schwach",
    player: makePlayer({
      id: "sim-weak",
      label: "Kohan-like",
      rating: 32,
      marketValue: 8,
      className: "Berserker",
      trainingMode: "leicht",
      coreStats: { pow: 46, spe: 17, men: 19, soc: 29 },
      attributeSheetStats: attrs({
        power: 58,
        health: 52,
        stamina: 50,
        speed: 28,
        dexterity: 24,
        awareness: 22,
        intelligence: 26,
        will: 24,
        charisma: 30,
        spirit: 28,
        determination: 32,
        torment: 40,
      }),
      disciplineRatings: { d_pow: 46, d_spe: 17, d_men: 19, d_soc: 29 },
    }),
    potentialRecord: {
      playerId: "sim-weak",
      potentialBand: "low",
      hiddenPotentialScore: 52,
      confidence: 0,
      source: "generated",
      hiddenPotentialOverallStars: 2,
      hiddenPotentialCeilingByAxis: { pow: 4.5, spe: 2, men: 2, soc: 3.5 },
      hiddenAttributeCeiling: {
        power: 58,
        health: 62,
        stamina: 60,
        speed: 55,
        dexterity: 52,
        awareness: 50,
        intelligence: 48,
        will: 46,
        charisma: 58,
        spirit: 56,
        determination: 60,
        torment: 58,
      },
    },
  },
];

function makeFacilities(trainingCenterLevel: number): TeamFacilityCollection {
  return {
    facilities: {
      training_center: {
        level: trainingCenterLevel,
        enabled: trainingCenterLevel > 0,
        conditionPct: 100,
      },
      recovery_center: { level: 0, enabled: false, conditionPct: 100 },
      scouting_office: { level: 0, enabled: false, conditionPct: 100 },
      analytics_room: { level: 0, enabled: false, conditionPct: 100 },
      fan_shop: { level: 0, enabled: false, conditionPct: 100 },
      arena_upgrade: { level: 0, enabled: false, conditionPct: 100 },
      academy: { level: 0, enabled: false, conditionPct: 100 },
    },
  };
}

function buildGameState(profile: SimProfile, peers: Player[]): GameState {
  const players = [profile.player, ...peers.filter((peer) => peer.id !== profile.player.id)];
  return {
    gamePhase: "player_development",
    season: { id: "season-sim", name: "Sim Season", currentMatchday: 10, totalMatchdays: 10, isCompleted: true },
    seasonState: {
      seasonId: "season-sim",
      schedule: [],
      standings: {},
      matchdayResults: [],
      playerDisciplinePerformances: [],
      disciplineHighlights: [],
    },
    matchdayState: { matchdayId: "md-10", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "team-sim", name: "Sim Team", shortCode: "SIM", budget: 100, cash: 100, salaryTotal: 0, rosterValue: 0 }],
    teamIdentities: [],
    players,
    disciplines: DISCIPLINES,
    rosters: [
      {
        id: "r-sim",
        teamId: "team-sim",
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

function formatTopTrainingGain(breakdown: ReturnType<typeof buildOrganicSeasonProgression>["attributeBreakdown"]) {
  const top = [...breakdown]
    .filter((entry) => entry.training > 0)
    .sort((left, right) => right.training - left.training)[0];
  if (!top) return "—";
  return `${top.attribute} +${top.training.toFixed(2)}`;
}

function formatSigned(value: number, digits = 2) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}`;
}

type SimRow = {
  profile: string;
  trainingMode: string;
  trainingCenterLevel: number;
  netSetpoints: number;
  trainingSetpoints: number;
  performanceSetpoints: number;
  facilityModifierPct: number;
  potentialTrainingMultiplier: number;
  topTrainingGain: string;
  topThreeGains: Array<{ attribute: string; delta: number }>;
  topThreeTrainingGains: Array<{ attribute: string; training: number }>;
  trainingDeltaSum: number;
  regressionDeltaSum: number;
};

function runSimulation() {
  const peers = makePeerPool();
  const rows: SimRow[] = [];

  for (const profile of PROFILES) {
    for (let level = 0; level <= 5; level += 1) {
      const gameState = buildGameState(profile, peers);
      const facilities = makeFacilities(level);
      const result = buildOrganicSeasonProgression({
        gameState,
        player: profile.player,
        facilities,
      });
      const topThreeGains = [...result.attributeBreakdown]
        .filter((entry) => entry.delta > 0)
        .sort((left, right) => right.delta - left.delta)
        .slice(0, 3)
        .map((entry) => ({ attribute: entry.attribute, delta: entry.delta }));

      const topThreeTrainingGains = [...result.attributeBreakdown]
        .filter((entry) => entry.training > 0)
        .sort((left, right) => right.training - left.training)
        .slice(0, 3)
        .map((entry) => ({ attribute: entry.attribute, training: entry.training }));

      rows.push({
        profile: profile.label,
        trainingMode: profile.player.trainingMode ?? "mittel",
        trainingCenterLevel: level,
        netSetpoints: result.netSetpoints,
        trainingSetpoints: result.trainingSetpoints,
        performanceSetpoints: result.performanceSetpoints,
        facilityModifierPct: result.facilityModifierPct,
        potentialTrainingMultiplier: result.potentialTrainingMultiplier,
        topTrainingGain: formatTopTrainingGain(result.attributeBreakdown),
        topThreeGains,
        topThreeTrainingGains,
        trainingDeltaSum: roundValue(
          result.attributeBreakdown.reduce((sum, entry) => sum + entry.training, 0),
          2,
        ),
        regressionDeltaSum: roundValue(
          result.attributeBreakdown.reduce((sum, entry) => sum + entry.regression, 0),
          2,
        ),
      });
    }
  }

  return rows;
}

function printTable(rows: SimRow[]) {
  const header = [
    "Profil".padEnd(8),
    "Mode".padEnd(6),
    "TC-L".padStart(4),
    "netPts".padStart(8),
    "trainPts".padStart(9),
    "perfPts".padStart(8),
    "facMod%".padStart(8),
    "PO x".padStart(6),
    "Top Train",
  ].join(" | ");

  console.log("\nTrainings-Facility Attributpunkte-Simulation (1 Saison, kein Matchday)\n");
  console.log(header);
  console.log("-".repeat(header.length));

  for (const row of rows) {
    console.log(
      [
        row.profile.padEnd(8),
        row.trainingMode.padEnd(6),
        String(row.trainingCenterLevel).padStart(4),
        formatSigned(row.netSetpoints).padStart(8),
        row.trainingSetpoints.toFixed(2).padStart(9),
        row.performanceSetpoints.toFixed(2).padStart(8),
        row.facilityModifierPct.toFixed(1).padStart(8),
        row.potentialTrainingMultiplier.toFixed(2).padStart(6),
        row.topTrainingGain,
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
        description: "Organic attribute setpoints per season; training_center L0-L5; no matchday performance",
        rows,
      },
      null,
      2,
    ),
  );
  console.log(`\nJSON: ${OUTPUT_FILE}\n`);
}

main();
