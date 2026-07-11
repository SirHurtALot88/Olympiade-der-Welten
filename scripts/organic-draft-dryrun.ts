/**
 * Read-only dry-run of the organic squad builder (Master-Plan P2 validation, no engine changes).
 *
 * Simulates a fresh draft: every player is a free agent, each team starts empty and drafts SEQUENTIALLY
 * from the shrinking pool using planOrganicDraftForTeam. Prints per-team composition + league dispersion
 * + identity/GM correlation, so we can see whether the organic engine produces identity-correlated
 * variety on REAL players BEFORE wiring it into the draft execute path.
 *
 *   OLY_APP_SQLITE_PATH=<db> npx tsx scripts/organic-draft-dryrun.ts --save-id <id>
 */

import { planOrganicDraftForTeam } from "@/lib/ai/organic-squad/draft-adapter";
import { buildLeagueMarketBrackets, classifyMarketBracket } from "@/lib/ai/market-pick-engine/market-brackets";
import type { Player } from "@/lib/data/olyDataTypes";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function avg(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}
function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = avg(values);
  return Math.sqrt(avg(values.map((v) => (v - m) ** 2)));
}
function round(v: number, d = 1): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

const saveId = arg("--save-id") ?? "active";
const persistence = createPersistenceService();
const save = persistence.getSaveById(saveId);
if (!save) {
  console.error(`Save not found: ${saveId}`);
  process.exit(1);
}
const gameState = save.gameState;
const byId = new Map<string, Player>(gameState.players.map((p) => [p.id, p]));

// Fresh-draft pool: all players with a market value, everyone a free agent.
const pool: Player[] = gameState.players.filter((p) => (p.marketValue ?? 0) > 0);
const brackets = buildLeagueMarketBrackets(pool.map((p) => p.marketValue ?? null));

// Draft order: by identity ambition desc (ambitious clubs pick earlier), stable by shortCode.
const identityById = new Map(gameState.teamIdentities.map((i) => [i.teamId, i]));
const teams = [...gameState.teams].sort((a, b) => {
  const aa = identityById.get(a.identityId)?.ambition ?? 50;
  const bb = identityById.get(b.identityId)?.ambition ?? 50;
  return bb - aa || String(a.shortCode).localeCompare(String(b.shortCode));
});

const available = new Map(pool.map((p) => [p.id, p]));
type Row = {
  code: string;
  roster: number;
  spend: number;
  cash: number;
  opt: number;
  stars: number;
  belowMin: boolean;
  ambition: number;
  starPriority: number;
  cashPriority: number;
  depthPref: number;
  eliteSmall: number;
};
const rows: Row[] = [];

for (const team of teams) {
  const identity = identityById.get(team.identityId) ?? null;
  const candidates = [...available.values()];
  const result = planOrganicDraftForTeam({
    gameState,
    team,
    identity,
    startingSquad: [],
    candidates,
  });
  let stars = 0;
  for (const decision of result.decisions) {
    const player = byId.get(decision.playerId);
    if (player) {
      const tier = classifyMarketBracket(player.marketValue ?? 0, brackets);
      if (tier === "Superstar" || tier === "Star") stars += 1;
    }
    available.delete(decision.playerId);
  }
  const bias = getTeamGeneralManager(gameState, team.teamId)?.profile?.bias;
  rows.push({
    code: team.shortCode ?? team.teamId,
    roster: result.finalRosterSize,
    spend: round((team.cash ?? 0) - result.finalCash),
    cash: round(result.finalCash),
    opt: result.optTarget,
    stars,
    belowMin: result.stoppedBelowMin,
    ambition: identity?.ambition ?? 50,
    starPriority: bias?.starPriority ?? 5,
    cashPriority: bias?.cashPriority ?? 5,
    depthPref: bias?.rosterDepthPreference ?? 5,
    eliteSmall: bias?.eliteSmallRosterPreference ?? 5,
  });
}

rows.sort((a, b) => b.spend - a.spend);
console.log("# Organic Draft Dry-Run · " + saveId);
console.log("Team|Kader|Spend|Cash|OPT|Stars|<Min|Ambition|starPri|cashPri|depthPref|eliteSmall");
for (const r of rows) {
  console.log(
    `${r.code}|${r.roster}|${r.spend}|${r.cash}|${r.opt}|${r.stars}|${r.belowMin ? "!" : ""}|${r.ambition}|${r.starPriority}|${r.cashPriority}|${r.depthPref}|${r.eliteSmall}`,
  );
}

const rosterSizes = rows.map((r) => r.roster);
const spends = rows.map((r) => r.spend);
const cashes = rows.map((r) => r.cash);
const starCounts = rows.map((r) => r.stars);
console.log("\n## Dispersion (Ø · stdev · CV)");
for (const [label, vals] of [
  ["Kadergröße", rosterSizes],
  ["Spend", spends],
  ["Cash", cashes],
  ["Stars", starCounts],
] as const) {
  const m = avg(vals);
  const s = stdev(vals);
  console.log(`${label}: ${round(m)} · ${round(s)} · ${m ? round(s / m, 3) : 0}`);
}

// Median-split correlation: high vs low group average behaviour.
function medianSplitGap(key: (r: Row) => number, metric: (r: Row) => number): number {
  const sorted = [...rows].sort((a, b) => key(a) - key(b));
  const half = Math.floor(sorted.length / 2);
  const low = sorted.slice(0, half);
  const high = sorted.slice(sorted.length - half);
  return round(avg(high.map(metric)) - avg(low.map(metric)));
}
console.log("\n## Identität/GM → Verhalten (Gap high−low Gruppe)");
console.log(`ambition → Spend:        ${medianSplitGap((r) => r.ambition, (r) => r.spend)}`);
console.log(`starPriority → Stars:    ${medianSplitGap((r) => r.starPriority, (r) => r.stars)}`);
console.log(`cashPriority → Cash:     ${medianSplitGap((r) => r.cashPriority, (r) => r.cash)}`);
console.log(`rosterDepthPref → Kader: ${medianSplitGap((r) => r.depthPref, (r) => r.roster)}`);
console.log(`eliteSmall → Kader:      ${medianSplitGap((r) => r.eliteSmall, (r) => r.roster)}`);
const belowMin = rows.filter((r) => r.belowMin).length;
console.log(`\nTeams unter Min: ${belowMin}/${rows.length}`);
