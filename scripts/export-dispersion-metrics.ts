/**
 * Export league-wide DISPERSION (stdev/CV across teams) and IDENTITY/GM CORRELATION metrics.
 * Pure reporting, no behavior change: this only reads an existing save and prints tables — it does
 * not touch any lib/ai or engine logic.
 *
 * Purpose: today's eval prints per-team tables + league averages but no spread and no correlation
 * to team identity / GM bias. This script answers the P0 "measurability" question from
 * docs/design/draft-composition-organic-masterplan.md: is the league composition "organic" —
 * i.e. do teams visibly disperse (savers vs. spenders, small vs. broad squads), and does that
 * dispersion track each team's identity/GM?
 *
 * Usage: OLY_APP_SQLITE_PATH=<db> npx tsx scripts/export-dispersion-metrics.ts --save-id <id>
 */
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { buildLeagueMarketBrackets, classifyMarketBracket } from "@/lib/ai/market-pick-engine/market-brackets";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import type { GameState, Team, TeamIdentity, TeamStrategyBias } from "@/lib/data/olyDataTypes";

function arg(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

/** Mirrors avg() in lib/foundation/multiseason-balance-dashboard.ts. */
function avg(values: number[]): number {
  return values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length, 4) : 0;
}

/** Population standard deviation (we treat "all teams in the league" as the full population). */
function stdev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = avg(values);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return round(Math.sqrt(variance), 4);
}

function coefficientOfVariation(mean: number, sd: number): number {
  return mean !== 0 ? round(sd / mean, 4) : 0;
}

/** Simple average-tie ranking (ascending: rank 1 = smallest value). */
function rank(values: number[]): number[] {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].value === order[i].value) j++;
    const tieRank = (i + j) / 2 + 1; // average rank across the tie block, 1-based
    for (let k = i; k <= j; k++) ranks[order[k].index] = tieRank;
    i = j + 1;
  }
  return ranks;
}

/** Pearson correlation on raw arrays; called on ranks it approximates Spearman's rho. */
function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length < 2 || xs.length !== ys.length) return null;
  const mx = avg(xs);
  const my = avg(ys);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const denom = Math.sqrt(dx2 * dy2);
  return denom !== 0 ? round(num / denom, 4) : null;
}

function spearman(xs: number[], ys: number[]): number | null {
  if (xs.length < 2 || xs.length !== ys.length) return null;
  return pearson(rank(xs), rank(ys));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

type TeamMetrics = {
  teamId: string;
  code: string;
  rosterSize: number;
  totalMw: number;
  salaryTotal: number;
  cash: number;
  starCount: number;
  superstarCount: number;
  identity: TeamIdentity | null;
  gmBias: Partial<TeamStrategyBias> | null;
  gmArchetype: string | null;
};

function buildTeamMetrics(gs: GameState): TeamMetrics[] {
  const rosterByTeam = new Map<string, string[]>();
  for (const entry of gs.rosters) {
    const list = rosterByTeam.get(entry.teamId);
    if (list) list.push(entry.playerId);
    else rosterByTeam.set(entry.teamId, [entry.playerId]);
  }
  const rosterEntryByPlayerId = new Map(gs.rosters.map((entry) => [entry.playerId, entry] as const));
  const playerById = new Map(gs.players.map((player) => [player.id, player] as const));
  const brackets = buildLeagueMarketBrackets(gs.players.map((p) => p.marketValue ?? p.displayMarketValue ?? null));

  return gs.teams.map((team: Team) => {
    const playerIds = rosterByTeam.get(team.teamId) ?? [];
    let totalMw = 0;
    let salaryTotal = 0;
    let starCount = 0;
    let superstarCount = 0;
    for (const playerId of playerIds) {
      const player = playerById.get(playerId);
      if (!player) continue;
      const rosterEntry = rosterEntryByPlayerId.get(playerId) ?? null;
      const contract = resolvePlayerEconomyContract({ player: player as never, rosterEntry: rosterEntry as never });
      const mw = contract.marketValue ?? player.marketValue ?? 0;
      totalMw += mw;
      salaryTotal += contract.salary ?? 0;
      const tier = classifyMarketBracket(mw, brackets);
      if (tier === "Star" || tier === "Superstar") starCount++;
      if (tier === "Superstar") superstarCount++;
    }

    const identity = gs.teamIdentities.find((i) => i.teamId === (team.identityId || team.teamId)) ?? null;
    const gm = getTeamGeneralManager(gs, team.teamId);

    return {
      teamId: team.teamId,
      code: team.shortCode ?? team.teamId,
      rosterSize: playerIds.length,
      totalMw: round(totalMw),
      salaryTotal: round(salaryTotal),
      cash: round(team.cash ?? 0),
      starCount,
      superstarCount,
      identity,
      gmBias: gm?.profile.bias ?? null,
      gmArchetype: gm?.profile.archetype ?? null,
    };
  });
}

type DispersionRow = { label: string; mean: number; sd: number; cv: number };

function buildDispersionRows(teams: TeamMetrics[]): DispersionRow[] {
  const metrics: Array<[string, number[]]> = [
    ["Kadergröße", teams.map((t) => t.rosterSize)],
    ["MW gesamt", teams.map((t) => t.totalMw)],
    ["Gehalt gesamt", teams.map((t) => t.salaryTotal)],
    ["Cash", teams.map((t) => t.cash)],
    ["Star-Anzahl", teams.map((t) => t.starCount)],
  ];
  return metrics.map(([label, values]) => {
    const mean = avg(values);
    const sd = stdev(values);
    return { label, mean, sd, cv: coefficientOfVariation(mean, sd) };
  });
}

type GroupSplitRow = { axis: string; group: "low" | "high"; n: number; avgTarget: number };

function splitByMedian<T>(
  teams: T[],
  axisValue: (t: T) => number | null,
  targetValue: (t: T) => number,
): { low: GroupSplitRow; high: GroupSplitRow } | null {
  const eligible = teams
    .map((t) => ({ axis: axisValue(t), target: targetValue(t) }))
    .filter((row): row is { axis: number; target: number } => row.axis != null && Number.isFinite(row.axis));
  if (eligible.length < 2) return null;
  const med = median(eligible.map((r) => r.axis));
  const low = eligible.filter((r) => r.axis < med);
  const high = eligible.filter((r) => r.axis >= med);
  if (low.length === 0 || high.length === 0) return null;
  return {
    low: { axis: "", group: "low", n: low.length, avgTarget: avg(low.map((r) => r.target)) },
    high: { axis: "", group: "high", n: high.length, avgTarget: avg(high.map((r) => r.target)) },
  };
}

function main() {
  const saveId = arg("--save-id");
  if (!saveId) throw new Error("--save-id required");

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);
  const gs = save.gameState;

  const teams = buildTeamMetrics(gs);

  console.log(`# Dispersion & Identitäts-Korrelation · ${saveId} · ${gs.season?.id ?? ""}`);
  console.log("");

  console.log("## Team-Übersicht");
  console.log(
    "Team|Kader|MW|Gehalt|Cash|Star|SStar|Ambition|Finances|BoardConf|GM|starPrio|cashPrio|rosterDepthPref|eliteSmallPref",
  );
  for (const t of teams) {
    const identity = t.identity;
    const bias = t.gmBias;
    console.log(
      [
        t.code,
        t.rosterSize,
        round(t.totalMw, 1),
        round(t.salaryTotal, 1),
        round(t.cash, 1),
        t.starCount,
        t.superstarCount,
        identity?.ambition ?? "—",
        identity?.finances ?? "—",
        identity?.boardConfidence ?? "—",
        t.gmArchetype ?? "—",
        bias?.starPriority ?? "—",
        bias?.cashPriority ?? "—",
        bias?.rosterDepthPreference ?? "—",
        bias?.eliteSmallRosterPreference ?? "—",
      ].join("|"),
    );
  }

  console.log("");
  console.log("## Liga-Dispersion (Ø, stdev, CV=stdev/Ø)");
  console.log("Metrik|Ø|stdev|CV");
  const dispersionRows = buildDispersionRows(teams);
  for (const row of dispersionRows) {
    console.log(`${row.label}|${round(row.mean, 2)}|${round(row.sd, 2)}|${row.cv}`);
  }

  console.log("");
  console.log("## Identität → Verhalten (Median-Split, n=Teams je Gruppe)");
  console.log("Achse|Gruppe|n|Ø-Ziel");
  const identityChecks: Array<{
    axis: string;
    targetLabel: string;
    split: { low: GroupSplitRow; high: GroupSplitRow } | null;
  }> = [
    {
      axis: "Ambition→MW",
      targetLabel: "Ø MW",
      split: splitByMedian(teams, (t) => t.identity?.ambition ?? null, (t) => t.totalMw),
    },
    {
      axis: "Finances→Cash",
      targetLabel: "Ø Cash",
      split: splitByMedian(teams, (t) => t.identity?.finances ?? null, (t) => t.cash),
    },
    {
      axis: "BoardConfidence→Kadergröße",
      targetLabel: "Ø Kader",
      split: splitByMedian(teams, (t) => t.identity?.boardConfidence ?? null, (t) => t.rosterSize),
    },
  ];
  for (const check of identityChecks) {
    if (!check.split) {
      console.log(`${check.axis}|—|—|n/a (zu wenig Streuung)`);
      continue;
    }
    console.log(`${check.axis}|low|${check.split.low.n}|${round(check.split.low.avgTarget, 1)}`);
    console.log(`${check.axis}|high|${check.split.high.n}|${round(check.split.high.avgTarget, 1)}`);
  }

  console.log("");
  console.log("## GM-Bias → Verhalten (Median-Split, nur Teams mit zugewiesenem GM)");
  console.log("Achse|Gruppe|n|Ø-Ziel");
  const gmChecks: Array<{
    axis: string;
    split: { low: GroupSplitRow; high: GroupSplitRow } | null;
  }> = [
    {
      axis: "starPriority→MW",
      split: splitByMedian(teams, (t) => t.gmBias?.starPriority ?? null, (t) => t.totalMw),
    },
    {
      axis: "cashPriority→Cash",
      split: splitByMedian(teams, (t) => t.gmBias?.cashPriority ?? null, (t) => t.cash),
    },
    {
      axis: "rosterDepthPreference→Kadergröße",
      split: splitByMedian(teams, (t) => t.gmBias?.rosterDepthPreference ?? null, (t) => t.rosterSize),
    },
    {
      axis: "eliteSmallRosterPreference→Kadergröße",
      split: splitByMedian(teams, (t) => t.gmBias?.eliteSmallRosterPreference ?? null, (t) => t.rosterSize),
    },
  ];
  for (const check of gmChecks) {
    if (!check.split) {
      console.log(`${check.axis}|—|—|n/a (zu wenig Streuung oder zu wenige GMs)`);
      continue;
    }
    console.log(`${check.axis}|low|${check.split.low.n}|${round(check.split.low.avgTarget, 1)}`);
    console.log(`${check.axis}|high|${check.split.high.n}|${round(check.split.high.avgTarget, 1)}`);
  }

  console.log("");
  console.log("## Rang-Korrelation (Spearman-ähnlich, Pearson auf Rängen)");
  const ambitionValues = teams.filter((t) => t.identity != null).map((t) => t.identity!.ambition);
  const mwForAmbition = teams.filter((t) => t.identity != null).map((t) => t.totalMw);
  const ambitionSpendCorr = spearman(ambitionValues, mwForAmbition);

  const cashPriorityValues = teams.filter((t) => t.gmBias?.cashPriority != null).map((t) => t.gmBias!.cashPriority!);
  const cashForCashPriority = teams.filter((t) => t.gmBias?.cashPriority != null).map((t) => t.cash);
  const cashPriorityCashCorr = spearman(cashPriorityValues, cashForCashPriority);

  console.log(`ambition -> MW gesamt: r=${ambitionSpendCorr ?? "n/a"} (n=${ambitionValues.length})`);
  console.log(`cashPriority -> Cash: r=${cashPriorityCashCorr ?? "n/a"} (n=${cashPriorityValues.length})`);

  const rosterCv = dispersionRows.find((r) => r.label === "Kadergröße")?.cv ?? 0;
  const spendCv = dispersionRows.find((r) => r.label === "MW gesamt")?.cv ?? 0;
  const starStdev = dispersionRows.find((r) => r.label === "Star-Anzahl")?.sd ?? 0;
  const ambitionGap = identityChecks[0].split ? round(identityChecks[0].split.high.avgTarget - identityChecks[0].split.low.avgTarget, 1) : null;
  const cashPriorityGap = gmChecks[1].split ? round(gmChecks[1].split.high.avgTarget - gmChecks[1].split.low.avgTarget, 1) : null;

  console.log("");
  console.log(
    `Dispersion: rosterCV=${rosterCv} spendCV=${spendCv} starCountStdev=${starStdev} | ` +
      `Korrelation ambition->spend gap=${ambitionGap ?? "n/a"} cashPriority->cash gap=${cashPriorityGap ?? "n/a"}`,
  );
}

main();
