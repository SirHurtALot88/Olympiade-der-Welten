/**
 * Verteilung der netSetpoints über synthetische aktive Spieler.
 * Usage: npx tsx scripts/training-progression-distribution-sim.ts
 */
import type {
  GameState,
  Player,
  PlayerDisciplinePerformanceRecord,
  PlayerGeneratorAttributes,
  PlayerPotentialRecord,
  TeamFacilityCollection,
} from "@/lib/data/olyDataTypes";
import { buildOrganicSeasonProgression } from "@/lib/training/organic-season-progression";

const DISCIPLINE_ID = "gewichtheben";

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[index]!;
}

function attrs(rating: number): PlayerGeneratorAttributes {
  const base = rating - 4;
  return {
    power: base + 2,
    health: base + 1,
    stamina: base,
    speed: base + 1,
    dexterity: base,
    intelligence: base - 2,
    awareness: base - 3,
    determination: base - 1,
    charisma: base - 2,
    will: base - 3,
    spirit: base - 4,
    torment: base - 2,
  };
}

function makePeerPool(): Player[] {
  return Array.from({ length: 40 }, (_, index) => {
    const pow = 38 + ((index * 7 + 3) % 24);
    const spe = 38 + ((index * 11 + 5) % 24);
    const men = 38 + ((index * 13 + 2) % 24);
    const soc = 38 + ((index * 17 + 9) % 24);
    return {
      id: `peer-${index}`,
      name: `Peer ${index}`,
      rating: Math.round((pow + spe + men + soc) / 4),
      marketValue: 10 + index,
      salaryDemand: 4,
      className: "Hero",
      race: "Human",
      alignment: "N",
      gender: "x",
      subclasses: [],
      traitsPositive: [],
      traitsNegative: [],
      coreStats: { pow, spe, men, soc },
      attributeSheetStats: attrs(Math.round((pow + spe + men + soc) / 4)),
      preferredDisciplineIds: [],
      disciplineRatings: { d_pow: pow, d_spe: spe, d_men: men, d_soc: soc },
      disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
      flavorEn: "",
      flavorDe: "",
      fatigue: 0,
      form: 50,
      potential: 65,
      trainingMode: "mittel",
      trainingClass: null,
    };
  });
}

type PerfTier = "poor" | "average" | "strong";

function makePerformances(playerId: string, tier: PerfTier, count: number): PlayerDisciplinePerformanceRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const strong = tier === "strong";
    const poor = tier === "poor";
    return {
      id: `perf-${playerId}-${index}`,
      matchdayResultId: `result-${playerId}-${index}`,
      teamId: "team-sim",
      playerId,
      activePlayerId: null,
      disciplineId: DISCIPLINE_ID,
      disciplineSide: "d1",
      slotIndex: 0,
      baseValue: strong ? 88 : poor ? 35 : 62,
      finalPlayerScore: strong ? 93 : poor ? 34 : 66,
      scoreContribution: strong ? 28 : poor ? 7 : 17,
      rankInTeam: strong ? 1 : poor ? 12 : 5,
      rankInDiscipline: strong ? 1 : poor ? 25 : 10,
      isTop10: strong || tier === "average",
      isMvpCandidate: strong,
      storyWeight: null,
      createdAt: new Date().toISOString(),
    };
  });
}

function buildGameState(player: Player, peers: Player[], performances: PlayerDisciplinePerformanceRecord[], po: number): GameState {
  const players = [player, ...peers.filter((peer) => peer.id !== player.id)];
  const matchdayResults = performances.map((entry, index) => ({
    id: entry.matchdayResultId,
    seasonId: "season-dist",
    matchdayId: `md-${index}`,
    status: "preview_applied" as const,
  }));
  const record: PlayerPotentialRecord = {
    playerId: player.id,
    potentialBand: po >= 85 ? "elite" : po >= 70 ? "medium" : "low",
    hiddenPotentialScore: po,
    confidence: 0,
    source: "generated",
    hiddenPotentialOverallStars: po >= 85 ? 4 : po >= 70 ? 3 : 2.5,
    hiddenPotentialCeilingByAxis: { pow: 3.5, spe: 3.5, men: 3.5, soc: 3.5 },
  };
  return {
    gamePhase: "player_development",
    season: { id: "season-dist", name: "Dist", currentMatchday: 10, totalMatchdays: 10, isCompleted: true },
    seasonState: { seasonId: "season-dist", schedule: [], standings: {}, matchdayResults, playerDisciplinePerformances: performances, disciplineHighlights: [] },
    matchdayState: { matchdayId: "md-10", status: "resolved", pendingTeamIds: [], resolvedFixtureIds: [] },
    teams: [{ teamId: "team-sim", name: "Sim", shortCode: "SIM", budget: 100, cash: 100, salaryTotal: 0, rosterValue: 0 }],
    teamIdentities: [],
    players,
    disciplines: [{ id: "d_pow", name: "P", category: "power", displayOrder: 1, originalOrder: 1, playerCount: 40 }],
    rosters: [{ id: "r-1", teamId: "team-sim", playerId: player.id, salary: 5, marketValue: player.marketValue, contractLength: 2 }],
    contracts: [],
    transferListings: [],
    transferHistory: [],
    logs: [],
    playerPotential: [record],
    mappingReport: { mappingSource: "sim", teamSource: "sim", generatedAt: "", processedMappingRows: 0, importedPlayerCount: players.length, matchedRosterCount: 1, warnings: [] },
  };
}

function facilities(level: number): TeamFacilityCollection {
  return {
    facilities: {
      training_center: { level, enabled: level > 0, conditionPct: 100 },
      recovery_center: { level: 0, enabled: false, conditionPct: 100 },
      scouting_office: { level: 0, enabled: false, conditionPct: 100 },
      analytics_room: { level: 0, enabled: false, conditionPct: 100 },
      fan_shop: { level: 0, enabled: false, conditionPct: 100 },
      arena_upgrade: { level: 0, enabled: false, conditionPct: 100 },
      academy: { level: 0, enabled: false, conditionPct: 100 },
    },
  };
}

function main() {
  const peers = makePeerPool();
  const nets: number[] = [];
  const modes = ["leicht", "mittel", "hart"] as const;
  const tierWeights: Array<{ tier: PerfTier; weight: number }> = [
    { tier: "poor", weight: 0.2 },
    { tier: "average", weight: 0.6 },
    { tier: "strong", weight: 0.2 },
  ];

  for (let index = 0; index < 120; index += 1) {
    const rating = 42 + (index % 34);
    const marketValue = Math.round(8 + rating * 0.35);
    const po = Math.min(95, rating + 8 + (index % 5) * 4);
    const mode = modes[index % 3]!;
    const tierRoll = (index * 17) % 100;
    const tier = tierWeights.find((entry, i, arr) => {
      const start = arr.slice(0, i).reduce((sum, item) => sum + item.weight, 0) * 100;
      return tierRoll >= start && tierRoll < start + entry.weight * 100;
    })!.tier;
    const tcLevel = 2 + (index % 3);
    const player: Player = {
      id: `dist-${index}`,
      name: `Dist ${index}`,
      rating,
      marketValue,
      salaryDemand: 4,
      className: "Hero",
      race: "Human",
      alignment: "N",
      gender: "x",
      subclasses: [],
      traitsPositive: index % 5 === 0 ? ["Diligent"] : index % 7 === 0 ? ["Lazy"] : [],
      traitsNegative: index % 11 === 0 ? ["Lazy"] : [],
      coreStats: { pow: rating, spe: rating - 1, men: rating - 2, soc: rating - 3 },
      attributeSheetStats: attrs(rating),
      preferredDisciplineIds: [],
      disciplineRatings: { d_pow: rating, d_spe: rating - 1, d_men: rating - 2, d_soc: rating - 3 },
      disciplineTierCounts: { above20: 0, above40: 0, above60: 0, above80: 0 },
      flavorEn: "",
      flavorDe: "",
      fatigue: 0,
      form: 50,
      potential: po,
      trainingMode: mode,
      trainingClass: "Hero",
    };
    const perf = makePerformances(player.id, tier, 10);
    const result = buildOrganicSeasonProgression({
      gameState: buildGameState(player, peers, perf, po),
      player,
      facilities: facilities(tcLevel),
    });
    nets.push(result.netSetpoints);
  }

  console.log("\nNet-Setpoints Verteilung (120 aktive Spieler, TC L2-L4)\n");
  console.log(`Min:    ${Math.min(...nets).toFixed(2)}`);
  console.log(`P5:     ${percentile(nets, 0.05).toFixed(2)}`);
  console.log(`P25:    ${percentile(nets, 0.25).toFixed(2)}`);
  console.log(`Median: ${percentile(nets, 0.5).toFixed(2)}`);
  console.log(`P75:    ${percentile(nets, 0.75).toFixed(2)}`);
  console.log(`P95:    ${percentile(nets, 0.95).toFixed(2)}`);
  console.log(`Max:    ${Math.max(...nets).toFixed(2)}`);
  console.log(`Mean:   ${(nets.reduce((sum, value) => sum + value, 0) / nets.length).toFixed(2)}`);
}

main();
