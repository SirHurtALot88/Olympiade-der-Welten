/**
 * 5-Jahres-Sponsor-Simulation mit echten Ingame-Daten.
 *
 * Nutzt createSingleplayerGameState() für echte Teams und Roster.
 * Cash-Veränderungen kommen ausschließlich aus Sponsor-Auszahlungen
 * (im echten Spiel kommen außerdem Preisgeld, Transfers und Facility-Kosten dazu).
 *
 * Pro Jahr:
 *   1. Salary Factor (echtes advanceSeasonEconomyFactorWindow)
 *   2. Rank-Simulation via team.budget + Gauß-Noise → Standings injizieren
 *   3. Sponsor-Angebote generieren (ensureSeasonSponsorOffers)
 *   4. KI wählt Sponsoren (chooseSponsorOfferForAiTeams)
 *   5. Sponsor-Abrechnung (applySponsorSettlement, execute: true)
 *   6. Ergebnis protokollieren (Cash-Delta ausschließlich aus Sponsor)
 *
 * Usage:
 *   npm run sponsor:5year-sim
 *   npm run sponsor:5year-sim-verbose
 *   npx tsx scripts/sponsor-5year-sim.ts --years=3
 *   npx tsx scripts/sponsor-5year-sim.ts --showcase
 */
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(path.resolve(__dirname, ".."));

import type { GameState, SponsorCurveShape, SponsorRarity, StandingRecord } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import {
  chooseSponsorOfferForAiTeams,
  ensureSeasonSponsorOffers,
} from "@/lib/sponsor/sponsor-offer-service";
import { applySponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { advanceSponsorContractsForNewSeason } from "@/lib/sponsor/sponsor-contract-lifecycle";
import {
  advanceSeasonEconomyFactorWindow,
  getSeasonEconomyFactorWindow,
} from "@/lib/season/season-economy-factors";
import {
  getPrizeMoneyReference,
  getRankMilestoneBonus,
  getUnlockedMilestones,
  getTeamDisplaySalaryTotal,
  getLeagueMinimumSalaryTotal,
} from "@/lib/sponsor/sponsor-economy-calibration";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import {
  SPONSOR_CURVE_SHAPES,
  SPONSOR_RARITIES,
  mapArchetypeToCurveShape,
} from "@/lib/sponsor/sponsor-curve-shapes";
import { buildLeagueTeamQualityRanks } from "@/lib/sponsor/sponsor-team-quality-rank";
import { upsertSeasonSnapshotRecord } from "@/lib/season/season-snapshot-service";
import type { SeasonSnapshotRecord, SeasonSnapshotTeamRecord } from "@/lib/data/olyDataTypes";

// ─── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const SIM_YEARS = Number(args.find((a) => a.startsWith("--years="))?.split("=")[1] ?? 5);
const VERBOSE = args.includes("--verbose");
const SHOWCASE = args.includes("--showcase");
const SIM_SEED = Number(args.find((a) => a.startsWith("--seed="))?.split("=")[1] ?? Date.now() % 100000);
const SAVE_ID = "sponsor-sim-5yr";

const SHOWCASE_RANKS = [1, 5, 9, 13, 17, 21, 25, 32] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Box-Muller Gaussian noise */
function gaussian(rng: () => number): number {
  const u1 = Math.max(1e-10, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}

function sign(v: number) {
  return v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1);
}

function pad(s: string | number, n: number) {
  return String(s).padStart(n);
}

/** Rarität + Kurvenform aus einem Vertrag/Angebot auflösen (mit Back-Compat auf Altverträge). */
function resolveSponsorMeta(
  contract: { rarity?: SponsorRarity; curveShape?: SponsorCurveShape; archetype?: string } | null | undefined,
): { rarity: SponsorRarity | null; curveShape: SponsorCurveShape | null } {
  if (contract == null) return { rarity: null, curveShape: null };
  const rarity = contract.rarity ?? "magisch";
  const curveShape = contract.curveShape ?? mapArchetypeToCurveShape(contract.archetype as never);
  return { rarity, curveShape };
}
function rarityLabel(rarity: SponsorRarity | null): string {
  return rarity ? SPONSOR_RARITIES[rarity].labelDe : "—";
}
function curveLabel(curveShape: SponsorCurveShape | null): string {
  return curveShape ? SPONSOR_CURVE_SHAPES[curveShape].labelDe : "—";
}

// ─── Rank simulation ──────────────────────────────────────────────────────────

/**
 * Simulate season ranks with persistent momentum — teams can rise or fall over years.
 * Base strength from budget, plus carried momentum and yearly form noise.
 */
function simulateRankMap(
  gs: GameState,
  rng: () => number,
  momentumByTeamId: Map<string, number>,
): Record<string, number> {
  const scored = gs.teams.map((team) => {
    const previousMomentum = momentumByTeamId.get(team.teamId) ?? 0;
    const momentumShift = gaussian(rng) * 5;
    const nextMomentum = previousMomentum * 0.55 + momentumShift;
    momentumByTeamId.set(team.teamId, nextMomentum);
    const score = (team.budget ?? 0) + nextMomentum * 10 + gaussian(rng) * 14;
    return { teamId: team.teamId, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const result: Record<string, number> = {};
  scored.forEach((entry, index) => {
    result[entry.teamId] = index + 1;
  });
  return result;
}

function buildMinimalSeasonSnapshot(input: {
  gameState: GameState;
  seasonId: string;
  rankMap: Record<string, number>;
}): SeasonSnapshotRecord {
  const finalStandings: SeasonSnapshotTeamRecord[] = input.gameState.teams.map((team) => {
    const rank = input.rankMap[team.teamId] ?? 32;
    return {
      teamId: team.teamId,
      teamCode: team.shortCode,
      teamName: team.name,
      rank,
      points: Math.max(1, 33 - rank) * 3,
      disciplinePoints: Math.max(1, 33 - rank) * 3,
      disciplinePointsByArea: { pow: null, spe: null, men: null, soc: null },
      cashEnd: team.cash,
      rosterEnd: input.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length,
      salaryEnd: getTeamDisplaySalaryTotal(input.gameState, team.teamId),
      marketValueEnd: null,
      transferCount: 0,
      transferBuyCount: 0,
      transferSellCount: 0,
      transferNet: null,
      startplatz: rank,
    };
  });

  return {
    seasonId: input.seasonId,
    seasonName: input.seasonId,
    archivedAt: new Date().toISOString(),
    source: "local",
    status: "completed",
    sourceStatus: "mapped",
    finalStandings,
    playerPerformances: [],
    warnings: [],
  };
}

/** Inject simulated ranks as StandingRecord entries the sponsor settlement reads */
function injectStandings(gs: GameState, rankMap: Record<string, number>): GameState {
  const standings: Record<string, StandingRecord> = {};
  for (const team of gs.teams) {
    const rank = rankMap[team.teamId] ?? 32;
    standings[team.teamId] = {
      points: Math.max(1, 33 - rank) * 3,
      rank,
      startplatz: rank,
    };
  }
  return { ...gs, seasonState: { ...gs.seasonState, standings } };
}

// ─── Result types ─────────────────────────────────────────────────────────────

type TeamYearRow = {
  teamId: string;
  name: string;
  shortCode: string;
  budget: number;
  rank: number;
  rarity: SponsorRarity | null;
  curveShape: SponsorCurveShape | null;
  qualityRank: number | null;
  sponsorPayout: number;
  prizeMoneyRef: number;
  delta: number;
  cashBefore: number;
  cashAfter: number;
};

type YearSummary = {
  year: number;
  seasonId: string;
  factor: number;
  teams: TeamYearRow[];
};

// ─── Showcase (8 teams, fixed ranks) ─────────────────────────────────────────

function runShowcase() {
  let gs = createSingleplayerGameState();
  const factor = getSeasonEconomyFactorWindow({
    saveId: SAVE_ID,
    seasonId: gs.season.id,
    seasonState: gs.seasonState,
  })[0]?.factor ?? 1.09;
  gs = { ...gs, seasonState: { ...gs.seasonState, seasonEconomyFactors: getSeasonEconomyFactorWindow({
    saveId: SAVE_ID,
    seasonId: gs.season.id,
    seasonState: gs.seasonState,
  }) } };

  const sortedByBudget = [...gs.teams].sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0));
  const showcaseTeams = SHOWCASE_RANKS.map((rank, index) => ({
    team: sortedByBudget[index] ?? sortedByBudget[sortedByBudget.length - 1]!,
    rank,
  }));

  const rankByTeamId = new Map<string, number>();
  showcaseTeams.forEach(({ team, rank }) => rankByTeamId.set(team.teamId, rank));
  let fillerRank = 2;
  for (const team of gs.teams) {
    if (!rankByTeamId.has(team.teamId)) {
      while (SHOWCASE_RANKS.includes(fillerRank as (typeof SHOWCASE_RANKS)[number])) fillerRank++;
      rankByTeamId.set(team.teamId, fillerRank);
      fillerRank++;
    }
  }

  const standings: Record<string, StandingRecord> = {};
  for (const team of gs.teams) {
    const rank = rankByTeamId.get(team.teamId) ?? 32;
    standings[team.teamId] = { points: Math.max(1, 33 - rank) * 3, rank, startplatz: rank };
  }
  gs = { ...gs, seasonState: { ...gs.seasonState, standings } };

  gs = ensureSeasonSponsorOffers(gs);
  gs = chooseSponsorOfferForAiTeams(gs);
  const settlement = applySponsorSettlement({
    gameState: gs,
    saveId: SAVE_ID,
    phase: "season_end",
    execute: true,
  });
  gs = settlement.gameState;

  console.log("╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  Sponsor Gewinnstufen · Showcase (8 Teams)                               ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");
  console.log(`Salary Factor: ×${factor}\n`);
  console.log(
    `${"Team".padEnd(28)} ${"Rarität".padEnd(11)} ${"Kurve".padEnd(16)} ${"Pl".padStart(3)} ${"Basis".padStart(7)} ${"Stufen".padStart(7)} ${"Total".padStart(7)} ${"PG-Ref".padStart(7)} ${"Stufen frei".padStart(20)}`,
  );
  console.log("─".repeat(120));

  for (const { team, rank } of showcaseTeams.sort((a, b) => a.rank - b.rank)) {
    const contract = getTeamSponsorContract(gs, team.teamId);
    const logs = (gs.seasonState.sponsorPayoutLogs ?? []).filter(
      (log) => log.teamId === team.teamId && log.seasonId === gs.season.id,
    );
    const basePaid = round1(
      logs
        .filter((log) => log.componentId === "base-cash")
        .reduce((sum, log) => sum + log.cashDelta, 0),
    );
    const rankPaid = round1(
      logs
        .filter((log) => log.componentId === "rank-target")
        .reduce((sum, log) => sum + log.cashDelta, 0),
    );
    const extraPaid = round1(
      logs
        .filter((log) => log.componentId !== "base-cash" && log.componentId !== "rank-target")
        .reduce((sum, log) => sum + Math.max(0, log.cashDelta), 0),
    );
    const total = round1(logs.reduce((sum, log) => sum + log.cashDelta, 0));
    const basis = round1(basePaid + extraPaid * 0.5);
    const stufen = round1(rankPaid + extraPaid * 0.5);
    const prizeRef = getPrizeMoneyReference(rank, factor);
    const unlocked = getUnlockedMilestones(rank).map((m) => m.label).join(", ") || "—";
    const { rarity, curveShape } = resolveSponsorMeta(contract);

    console.log(
      `${`${team.shortCode} ${team.name}`.substring(0, 27).padEnd(28)} ${rarityLabel(rarity).padEnd(11)} ${curveLabel(curveShape).padEnd(16)} ${pad(rank, 3)} ${pad(basis.toFixed(1), 7)} ${pad(stufen.toFixed(1), 7)} ${pad(total.toFixed(1), 7)} ${pad(prizeRef.toFixed(1), 7)} ${unlocked.substring(0, 20).padEnd(20)}`,
    );
  }

  console.log("\nFertig.\n");
}

function pickSpotlightTeams(
  teams: GameState["teams"],
  rankHistoryByTeamId: Map<string, number[]>,
): string[] {
  const sortedByBudget = [...teams].sort((left, right) => (left.budget ?? 0) - (right.budget ?? 0));
  const picks = new Set<string>();
  picks.add(sortedByBudget.at(-1)!.teamId);
  picks.add(sortedByBudget.at(-2)!.teamId);
  picks.add(sortedByBudget[Math.floor(sortedByBudget.length / 2)]!.teamId);
  picks.add(sortedByBudget[0]!.teamId);
  picks.add(sortedByBudget[1]!.teamId);

  const volatile = [...teams]
    .map((team) => {
      const ranks = rankHistoryByTeamId.get(team.teamId) ?? [];
      const swing = ranks.length > 1 ? Math.max(...ranks) - Math.min(...ranks) : 0;
      return { teamId: team.teamId, swing };
    })
    .sort((left, right) => right.swing - left.swing)
    .slice(0, 3);
  volatile.forEach((entry) => picks.add(entry.teamId));

  return [...picks].slice(0, 8);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (SHOWCASE) {
    runShowcase();
    return;
  }

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║         Sponsor-System · 5-Jahres-Simulation (Ingame)        ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  console.log("Lade Spiel-Daten …");
  let gs = createSingleplayerGameState();

  console.log(`  ${gs.teams.length} Teams | ${gs.rosters.length} Roster-Einträge | Season: ${gs.season.id}`);
  console.log(`  Sim-Seed: ${SIM_SEED} | Liga-Min-Gehalt: ${getLeagueMinimumSalaryTotal(gs).toFixed(1)} C`);
  console.log(`  Budget-Spanne: ${Math.min(...gs.teams.map((t) => t.budget)).toFixed(0)} – ${Math.max(...gs.teams.map((t) => t.budget)).toFixed(0)} C`);
  console.log(`  Starting Cash: ${Math.min(...gs.teams.map((t) => t.cash)).toFixed(1)} – ${Math.max(...gs.teams.map((t) => t.cash)).toFixed(1)} C`);
  console.log(`  (Note: Cash-Änderungen nur aus Sponsor-Zahlungen. Preisgeld/Transfers/Facility nicht simuliert.)\n`);

  const results: YearSummary[] = [];
  const momentumByTeamId = new Map<string, number>();
  const rankHistoryByTeamId = new Map<string, number[]>();

  for (let year = 1; year <= SIM_YEARS; year++) {
    const seasonId = `season-${year}`;
    gs = { ...gs, season: { ...gs.season, id: seasonId } };

    // 1. Economy Factor
    const economyWindow = getSeasonEconomyFactorWindow({
      saveId: SAVE_ID,
      seasonId,
      seasonState: gs.seasonState,
    });
    const factor = economyWindow[0]?.factor ?? 1;
    gs = { ...gs, seasonState: { ...gs.seasonState, seasonEconomyFactors: economyWindow } };

    // 2. Simulate ranks via team.budget + Gaussian noise, inject standings
    const rng = lcg(SIM_SEED + year * 1013 + 997);
    const rankMap = simulateRankMap(gs, rng, momentumByTeamId);
    gs = injectStandings(gs, rankMap);
    for (const team of gs.teams) {
      const rank = rankMap[team.teamId] ?? 32;
      const history = rankHistoryByTeamId.get(team.teamId) ?? [];
      history.push(rank);
      rankHistoryByTeamId.set(team.teamId, history);
    }

    const qualityBeforeOffers = buildLeagueTeamQualityRanks(buildTeamSeasonOverviewRows({ gameState: gs }));

    // 3. Record cash before sponsor settlement
    const cashBefore = new Map(gs.teams.map((t) => [t.teamId, t.cash]));

    // 4. Generate sponsor offers (3 per team)
    gs = ensureSeasonSponsorOffers(gs);

    // 5. AI picks sponsors
    gs = chooseSponsorOfferForAiTeams(gs);

    // 6. Apply sponsor settlement (adds sponsor income to team.cash)
    const settlementResult = applySponsorSettlement({
      gameState: gs,
      saveId: SAVE_ID,
      phase: "season_end",
      execute: true,
    });
    gs = settlementResult.gameState;

    if (!settlementResult.applied && VERBOSE) {
      console.warn(`  [J${year}] Warnung: Settlement nicht angewendet. Warnings: ${settlementResult.preview.warnings.join(", ")}`);
    }

    // 7. Build per-team result rows
    const teamRows: TeamYearRow[] = gs.teams.map((team) => {
      const rank = rankMap[team.teamId] ?? 32;
      const contract = getTeamSponsorContract(gs, team.teamId);
      const quality = qualityBeforeOffers.get(team.teamId) ?? null;
      const sponsorLogs = (gs.seasonState.sponsorPayoutLogs ?? []).filter(
        (log) => log.teamId === team.teamId && log.seasonId === seasonId,
      );
      const sponsorPayout = round1(sponsorLogs.reduce((s, log) => s + log.cashDelta, 0));
      const prizeMoneyRef = round1(getPrizeMoneyReference(rank, factor));

      return {
        teamId: team.teamId,
        name: team.name,
        shortCode: team.shortCode,
        budget: team.budget ?? 0,
        rank,
        ...resolveSponsorMeta(contract),
        qualityRank: quality?.qualityRank ?? null,
        sponsorPayout,
        prizeMoneyRef,
        delta: round1(sponsorPayout - prizeMoneyRef),
        cashBefore: cashBefore.get(team.teamId) ?? 0,
        cashAfter: team.cash,
      };
    });

    results.push({ year, seasonId, factor, teams: teamRows });

    gs = {
      ...gs,
      seasonState: {
        ...gs.seasonState,
        seasonSnapshots: upsertSeasonSnapshotRecord(
          gs.seasonState.seasonSnapshots,
          buildMinimalSeasonSnapshot({ gameState: gs, seasonId, rankMap }),
        ),
      },
    };

    // Summary
    const sorted = [...teamRows].sort((a, b) => a.rank - b.rank);
    const totalSponsor = round1(sorted.reduce((s, t) => s + t.sponsorPayout, 0));
    const totalPrize = round1(sorted.reduce((s, t) => s + t.prizeMoneyRef, 0));
    const aboveRef = sorted.filter((t) => t.delta >= 0).length;

    console.log(`── Jahr ${year} (${seasonId}) | Faktor ×${factor} ──────────────────────────`);
    console.log(`   Sponsor-Total: ${totalSponsor.toFixed(1)} C  |  Preisgeld-Ref: ${totalPrize.toFixed(1)} C  |  Ratio: ×${(totalSponsor / Math.max(1, totalPrize)).toFixed(2)}`);
    console.log(`   Besser als Preisgeld: ${aboveRef}/32 Teams`);

    if (VERBOSE) {
      console.log(`\n   Rang  ${"Team".padEnd(18)} ${"Rarität".padEnd(11)} ${"Kurve".padEnd(16)} ${"Q".padStart(5)} ${"Budget".padStart(7)} ${"Sponsor".padStart(8)} ${"PGeld".padStart(7)} ${"Delta".padStart(7)} ${"CashNach".padStart(9)}`);
      console.log(`   ${"─".repeat(104)}`);
      for (const t of sorted) {
        const dStr = sign(t.delta);
        const flag = t.delta >= 0 ? " ✓" : "  ";
        console.log(
          `   ${pad(t.rank, 3)}  ${t.shortCode.padEnd(4)} ${t.name.substring(0, 12).padEnd(13)} ${rarityLabel(t.rarity).padEnd(11)} ${curveLabel(t.curveShape).padEnd(16)} ${pad(t.qualityRank?.toFixed(1) ?? "—", 5)} ${pad(t.budget, 7)} ${pad(t.sponsorPayout.toFixed(1), 8)} ${pad(t.prizeMoneyRef.toFixed(1), 7)} ${pad(dStr, 7)} ${pad(t.cashAfter.toFixed(1), 9)}${flag}`,
        );
      }
      console.log();
    }

    // Advance to next season
    if (year < SIM_YEARS) {
      const nextSeasonId = `season-${year + 1}`;
      const { nextWindow } = advanceSeasonEconomyFactorWindow({
        saveId: SAVE_ID,
        fromSeasonId: seasonId,
        toSeasonId: nextSeasonId,
        seasonState: gs.seasonState,
      });
      gs = advanceSponsorContractsForNewSeason(gs, nextSeasonId);
      gs = {
        ...gs,
        season: { ...gs.season, id: nextSeasonId },
        seasonState: {
          ...gs.seasonState,
          seasonEconomyFactors: nextWindow,
          sponsorPayoutLogs: [],
          sponsorOffersByTeamId: {},
        },
      };
    }
  }

  // ─── Final Output ──────────────────────────────────────────────────────────

  console.log("\n\n╔══════════════════════════════════════════════════════════════════════════╗");
  console.log("║  CASH-ENTWICKLUNG ÜBER 5 JAHRE · sortiert nach Budget (aufsteigend)      ║");
  console.log("╚══════════════════════════════════════════════════════════════════════════╝\n");

  const teamOrder = [...gs.teams].sort((a, b) => (a.budget ?? 0) - (b.budget ?? 0)).map((t) => t.teamId);

  const colW = 9;
  const header = [
    "Team".padEnd(26),
    " Bud",
    ...results.map((yr) => `  J${yr.year}Spon`.padStart(colW)),
    ...results.map((yr) => ` J${yr.year}Cash`.padStart(colW)),
    ...results.map((yr) => `J${yr.year}Δref`.padStart(colW)),
  ].join("");
  console.log(header);
  console.log("─".repeat(header.length));

  for (const teamId of teamOrder) {
    const baseTeam = gs.teams.find((t) => t.teamId === teamId)!;
    const cols = [
      baseTeam.name.substring(0, 25).padEnd(26),
      pad(baseTeam.budget, 4),
      ...results.map((yr) => {
        const t = yr.teams.find((x) => x.teamId === teamId)!;
        return pad(t.sponsorPayout.toFixed(1), colW);
      }),
      ...results.map((yr) => {
        const t = yr.teams.find((x) => x.teamId === teamId)!;
        return pad(t.cashAfter.toFixed(1), colW);
      }),
      ...results.map((yr) => {
        const t = yr.teams.find((x) => x.teamId === teamId)!;
        return pad(sign(t.delta), colW);
      }),
    ];
    console.log(cols.join(""));
  }

  // Salary factors
  console.log(`\n${"─".repeat(55)}`);
  console.log("Salary Factors:");
  results.forEach((yr) => process.stdout.write(`  J${yr.year}: ×${yr.factor}`));
  console.log();

  // Per-year summary
  console.log(`\n${"─".repeat(55)}`);
  console.log("Zusammenfassung pro Jahr:\n");
  console.log(
    `  ${"Jahr".padEnd(6)} ${"×F".padEnd(5)} ${"SponTotal".padStart(10)} ${"PGeldRef".padStart(9)} ${"Ratio".padStart(7)} ${"BessAls".padStart(8)} ${"AvgSpon".padStart(8)} ${"AvgCash".padStart(8)}`,
  );
  console.log(`  ${"─".repeat(70)}`);
  for (const yr of results) {
    const totalSponsor = round1(yr.teams.reduce((s, t) => s + t.sponsorPayout, 0));
    const totalPrize = round1(yr.teams.reduce((s, t) => s + t.prizeMoneyRef, 0));
    const aboveRef = yr.teams.filter((t) => t.delta >= 0).length;
    const avgSpon = round1(totalSponsor / yr.teams.length);
    const avgCash = round1(yr.teams.reduce((s, t) => s + t.cashAfter, 0) / yr.teams.length);
    console.log(
      `  ${`J${yr.year}`.padEnd(6)} ${"×" + yr.factor.toFixed(2)} ${pad(totalSponsor.toFixed(1), 10)} ${pad(totalPrize.toFixed(1), 9)} ${pad("×" + (totalSponsor / Math.max(1, totalPrize)).toFixed(2), 7)} ${pad(`${aboveRef}/32`, 8)} ${pad(avgSpon.toFixed(1), 8)} ${pad(avgCash.toFixed(1), 8)}`,
    );
  }

  // Bottom teams spotlight
  console.log(`\n${"─".repeat(55)}`);
  console.log("Bottom Teams (5 niedrigste Budgets) — Sponsor-Verlauf:\n");
  const bottomIds = [...gs.teams].sort((a, b) => (a.budget ?? 0) - (b.budget ?? 0)).slice(0, 5).map((t) => t.teamId);
  console.log(
    `  ${"Team".padEnd(26)} ${"Bud".padStart(4)} ${results.map((yr) => `J${yr.year}Spon`.padStart(8)).join(" ")} ${results.map((yr) => `J${yr.year}Cash`.padStart(9)).join(" ")}`,
  );
  for (const tid of bottomIds) {
    const team = gs.teams.find((t) => t.teamId === tid)!;
    process.stdout.write(`  ${team.name.substring(0, 25).padEnd(26)} ${pad(team.budget, 4)}`);
    for (const yr of results) {
      const t = yr.teams.find((x) => x.teamId === tid)!;
      process.stdout.write(` ${pad(t.sponsorPayout.toFixed(1), 8)}`);
    }
    for (const yr of results) {
      const t = yr.teams.find((x) => x.teamId === tid)!;
      process.stdout.write(` ${pad(t.cashAfter.toFixed(1), 9)}`);
    }
    console.log();
  }

  console.log(`\n${"─".repeat(72)}`);
  console.log("Platzierungs-Verlauf (8 Teams: Top, Mid, Bottom + stärkste Bewegung):\n");
  const spotlightIds = pickSpotlightTeams(gs.teams, rankHistoryByTeamId);
  console.log(
    `  ${"Team".padEnd(22)} ${results.map((yr) => `J${yr.year}Pl`.padStart(7)).join(" ")} ${results.map((yr) => `J${yr.year}Rarität`.padStart(11)).join(" ")}`,
  );
  for (const teamId of spotlightIds) {
    const team = gs.teams.find((entry) => entry.teamId === teamId)!;
    const ranks = rankHistoryByTeamId.get(teamId) ?? [];
    const rarities = results.map((yr) => rarityLabel(yr.teams.find((entry) => entry.teamId === teamId)?.rarity ?? null));
    process.stdout.write(`  ${team.shortCode.padEnd(6)} ${team.name.substring(0, 14).padEnd(15)}`);
    ranks.forEach((rank) => process.stdout.write(` ${pad(rank, 7)}`));
    rarities.forEach((r) => process.stdout.write(` ${pad(r, 11)}`));
    console.log();
  }

  console.log("\nFertig.\n");

  // Gate: exit 1 if any year's league ratio is outside 0.85–1.15
  const ratioFailures = results.filter((yr) => {
    const totalSponsor = yr.teams.reduce((s, t) => s + t.sponsorPayout, 0);
    const totalPrize = yr.teams.reduce((s, t) => s + t.prizeMoneyRef, 0);
    const ratio = totalSponsor / Math.max(1, totalPrize);
    return ratio < 0.85 || ratio > 1.15;
  });
  if (ratioFailures.length > 0) {
    console.error(`\n✗ Ratio-Gate fehlgeschlagen für Jahr(e): ${ratioFailures.map((yr) => yr.year).join(", ")}`);
    for (const yr of ratioFailures) {
      const totalSponsor = yr.teams.reduce((s, t) => s + t.sponsorPayout, 0);
      const totalPrize = yr.teams.reduce((s, t) => s + t.prizeMoneyRef, 0);
      console.error(`  J${yr.year}: Ratio ×${(totalSponsor / Math.max(1, totalPrize)).toFixed(3)} (Ziel 0.85–1.15)`);
    }
    process.exit(1);
  }
  console.log("✓ Ratio-Gate bestanden (alle Jahre 0.85–1.15)\n");
}

main().catch((err) => {
  console.error("Simulation fehlgeschlagen:", err);
  process.exit(1);
});
