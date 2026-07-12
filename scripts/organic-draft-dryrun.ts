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

const exampleTeamCode = arg("--team") ?? "D-P";
type TierLabel = "Superstar" | "Star" | "Core" | "Depth" | "Backup" | "Reserve";
const TIERS: TierLabel[] = ["Superstar", "Star", "Core", "Depth", "Backup", "Reserve"];

const available = new Map(pool.map((p) => [p.id, p]));
type Row = {
  code: string;
  roster: number;
  spend: number;
  cash: number;
  mw: number;
  opt: number;
  tiers: Record<TierLabel, number>;
  kern: number;
  stars: number;
  belowMin: boolean;
  ambition: number;
  starPriority: number;
  cashPriority: number;
  depthPref: number;
  eliteSmall: number;
};
const rows: Row[] = [];
const draftedByCode = new Map<string, Player[]>();

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
  const code = team.shortCode ?? team.teamId;
  const tiers: Record<TierLabel, number> = {
    Superstar: 0, Star: 0, Core: 0, Depth: 0, Backup: 0, Reserve: 0,
  };
  const drafted: Player[] = [];
  let mw = 0;
  for (const decision of result.decisions) {
    const player = byId.get(decision.playerId);
    if (player) {
      drafted.push(player);
      mw += player.marketValue ?? 0;
      tiers[classifyMarketBracket(player.marketValue ?? 0, brackets)] += 1;
    }
    available.delete(decision.playerId);
  }
  draftedByCode.set(code, drafted);
  const kern = drafted.length
    ? Math.round(((tiers.Superstar + tiers.Star + tiers.Core + tiers.Depth) / drafted.length) * 100)
    : 0;
  const bias = getTeamGeneralManager(gameState, team.teamId)?.profile?.bias;
  rows.push({
    code,
    roster: result.finalRosterSize,
    spend: round((team.cash ?? 0) - result.finalCash),
    cash: round(result.finalCash),
    mw: round(mw),
    opt: result.optTarget,
    tiers,
    kern,
    stars: tiers.Superstar + tiers.Star,
    belowMin: result.stoppedBelowMin,
    ambition: identity?.ambition ?? 50,
    starPriority: bias?.starPriority ?? 5,
    cashPriority: bias?.cashPriority ?? 5,
    depthPref: bias?.rosterDepthPreference ?? 5,
    eliteSmall: bias?.eliteSmallRosterPreference ?? 5,
  });
}

// --- Per-team MW/Cash/roles table ---
const byMw = [...rows].sort((a, b) => b.mw - a.mw);
console.log("\n## Teams (MW · Cash · Rollen)");
console.log("Team|Kader|MW|Cash|SStar|Star|Core|Depth|Backup|Reserve|Kern%");
for (const r of byMw) {
  const t = r.tiers;
  console.log(`${r.code}|${r.roster}|${r.mw}|${r.cash}|${t.Superstar}|${t.Star}|${t.Core}|${t.Depth}|${t.Backup}|${t.Reserve}|${r.kern}%`);
}

// --- Top-10 most expensive drafted players ---
const allDrafted: Array<{ p: Player; team: string }> = [];
for (const [code, players] of draftedByCode) for (const p of players) allDrafted.push({ p, team: code });
allDrafted.sort((a, b) => (b.p.marketValue ?? 0) - (a.p.marketValue ?? 0));
console.log("\n## Top-10 teuerste Spieler (Liga)");
console.log("#|Spieler|Team|MW|Gehalt|Tier");
allDrafted.slice(0, 10).forEach((e, i) => {
  console.log(`${i + 1}|${e.p.name}|${e.team}|${round(e.p.marketValue ?? 0)}|${round(e.p.salaryDemand ?? 0)}|${classifyMarketBracket(e.p.marketValue ?? 0, brackets)}`);
});

// --- Example team roster ---
const example = draftedByCode.get(exampleTeamCode);
if (example) {
  console.log(`\n## Beispielteam ${exampleTeamCode} — Kader (${example.length})`);
  console.log("Spieler|MW|Gehalt|Tier|Top-Disziplinen(>60)");
  for (const p of [...example].sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0))) {
    const topDiscs = Object.entries(p.disciplineRatings ?? {})
      .filter(([, v]) => v > 60)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, v]) => `${id}:${Math.round(v)}`)
      .join(" ");
    console.log(`${p.name}|${round(p.marketValue ?? 0)}|${round(p.salaryDemand ?? 0)}|${classifyMarketBracket(p.marketValue ?? 0, brackets)}|${topDiscs}`);
  }
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
