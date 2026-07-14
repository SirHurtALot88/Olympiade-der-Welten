/**
 * P5 — Per-Team Identity-Fidelity Audit (READ-ONLY).
 *
 * Reads an existing save and reports, per team, how faithfully its ACTUAL roster reflects the
 * team's configured identity — on two axes:
 *
 *   A) THEME fidelity — ground truth is lib/ai/team-theme-composition-service.ts. Reuses the
 *      engine's own quota/classification logic (buildTeamThemeCompositionRuntimeContext,
 *      calculateThemeCompositionScore, classifyIdentityQuotaRole, derivePlayerThemeTags) instead
 *      of a parallel heuristic (see docs/design/per-team-identity-fidelity-p5.md Q3).
 *   B) ECONOMIC fidelity — ground truth is the assigned GM bias (getTeamGeneralManager(...).
 *      profile.bias) plus the team identity axis (gameState.teamIdentities). Reports MW, cash,
 *      avg salary, avg contractLength per team next to the GM's value/cash/contract-length axes.
 *
 * This script is READ-ONLY: it never calls persistence.saveSingleplayerState / any write path,
 * and it does not import or modify anything in lib/ai's decision engines — only reads their
 * already-exported classification helpers.
 *
 * Usage:
 *   OLY_APP_SQLITE_PATH=<db> npx tsx scripts/export-identity-fidelity.ts --save-id <id> [--team <code>]
 *
 * See docs/design/per-team-identity-fidelity-p5.md §4 (Teil C — Verifikation) for the spec this
 * implements.
 */

import type { GameState, Player, RosterEntry, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import {
  buildTeamThemeCompositionRuntimeContext,
  calculateThemeCompositionScore,
  derivePlayerThemeTags,
  isQuotaScopedTarget,
  type TeamThemeCompositionTarget,
} from "@/lib/ai/team-theme-composition-service";
import { getTeamGeneralManager } from "@/lib/foundation/team-general-managers";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

function arg(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function round(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

function avg(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function pct(value: number): string {
  return `${round(value * 100, 1)}%`;
}

/** Same "candidate quality" proxy the engine itself uses (see getPlayerThemeQuality, not exported). */
function playerQuality(player: Player): number {
  const coreValues = Object.values(player.coreStats ?? {}).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  const disciplineValues = Object.values(player.disciplineRatings ?? {}).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  return Math.max(coreValues.length ? Math.max(...coreValues) : 0, disciplineValues.length ? Math.max(...disciplineValues) : 0);
}

function medianSplitGap(rows: TeamFidelityRow[], key: (r: TeamFidelityRow) => number | null, metric: (r: TeamFidelityRow) => number | null): number | null {
  const usable = rows.filter((r) => key(r) != null && metric(r) != null);
  if (usable.length < 4) return null;
  const sorted = [...usable].sort((a, b) => (key(a) as number) - (key(b) as number));
  const half = Math.floor(sorted.length / 2);
  const low = sorted.slice(0, half);
  const high = sorted.slice(sorted.length - half);
  return round(avg(high.map((r) => metric(r) as number)) - avg(low.map((r) => metric(r) as number)), 3);
}

type TeamFidelityRow = {
  teamId: string;
  teamName: string;
  rosterCount: number;
  hasThemeTarget: boolean;
  target: TeamThemeCompositionTarget | null;
  quotaShare: number | null;
  minimumShare: number | null;
  targetShare: number | null;
  quotaMet: boolean | null;
  avoidCount: number;
  avoidClean: boolean;
  distinctRaceCount: number;
  races: string[];
  hasRaceQuota: boolean;
  flavorNotRaceLocked: boolean | null;
  flavorTagCoverage: number | null;
  totalMw: number;
  cash: number;
  avgSalary: number;
  avgContractLength: number | null;
  identityFinances: number | null;
  gmArchetype: string | null;
  valuePriority: number | null;
  cashPriority: number | null;
  sellForProfitAggression: number | null;
  shortContractPreference: number | null;
  longContractPreference: number | null;
  mwPerSalary: number | null;
};

function main() {
  const saveId = arg("--save-id");
  const teamFilter = arg("--team");
  if (!saveId) {
    console.error("Usage: npx tsx scripts/export-identity-fidelity.ts --save-id <id> [--team <code>]");
    process.exit(1);
  }

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    console.error(`Save not found: ${saveId}`);
    process.exit(1);
  }
  const gameState: GameState = save.gameState;

  if (gameState.rosters.length === 0) {
    console.log(`# Identity-Fidelity Audit · ${saveId}`);
    console.log("");
    console.log(
      "gameState.rosters is EMPTY for this save (no drafted players yet) — cannot measure roster fidelity against a " +
        "real squad. Reporting theme/GM config only below; re-run against a save that has been through a persisted " +
        "draft (organic-draft-dryrun.ts only PLANS, it does not persist rosters).",
    );
    console.log("");
  }

  const playerById = new Map<string, Player>(gameState.players.map((p) => [p.id, p]));
  const identityByTeamId = new Map<string, TeamIdentity>(gameState.teamIdentities.map((i) => [i.teamId, i]));
  const rostersByTeamId = new Map<string, RosterEntry[]>();
  for (const entry of gameState.rosters) {
    const list = rostersByTeamId.get(entry.teamId) ?? [];
    list.push(entry);
    rostersByTeamId.set(entry.teamId, list);
  }

  const teams: Team[] = teamFilter
    ? gameState.teams.filter((t) => t.teamId === teamFilter || t.shortCode === teamFilter)
    : [...gameState.teams].sort((a, b) => String(a.shortCode ?? a.teamId).localeCompare(String(b.shortCode ?? b.teamId)));

  const rows: TeamFidelityRow[] = [];

  for (const team of teams) {
    const rosterEntries = rostersByTeamId.get(team.teamId) ?? [];
    const rosterPlayers = rosterEntries
      .map((entry) => playerById.get(entry.playerId))
      .filter((p): p is Player => Boolean(p));

    const runtimeContext = buildTeamThemeCompositionRuntimeContext(gameState, team);
    const target = runtimeContext.target;
    const share = runtimeContext.rosterShare;

    // --- Theme fidelity ---
    let avoidCount = 0;
    let flavorTagHits = 0;
    if (target) {
      for (const player of rosterPlayers) {
        const score = calculateThemeCompositionScore({
          gameState,
          team,
          player,
          candidateQuality: playerQuality(player),
          runtimeContext,
        });
        if (score.themeTier === "avoid") avoidCount += 1;
        if (score.themeTier !== "outsider" && score.themeTier !== "avoid") flavorTagHits += 1;
      }
    }
    const races = [...new Set(rosterPlayers.map((p) => String(p.race ?? "").trim().toLowerCase()).filter(Boolean))];
    const hasRaceQuota = Boolean(target?.raceQuotaScoped && target.raceQuotaScoped.races.length > 0);
    const quotaShare = share?.primaryShare ?? null;
    const quotaMet = target ? (quotaShare ?? 0) >= target.minimumShare : null;
    // Avoid a small allowance (design doc: "0 avoid-Tag-Spieler ... allow a small tolerance") —
    // 1 avoid player on a roster of >= 8 is treated as noise, not a real fidelity break.
    const avoidTolerance = rosterPlayers.length >= 8 ? 1 : 0;
    const avoidClean = avoidCount <= avoidTolerance;
    const flavorNotRaceLocked = target ? hasRaceQuota || races.length >= 2 : null;
    const flavorTagCoverage = rosterPlayers.length > 0 ? flavorTagHits / rosterPlayers.length : null;

    // --- Economic fidelity ---
    const contracts = rosterEntries.map((entry) =>
      resolvePlayerEconomyContract({ player: (playerById.get(entry.playerId) ?? null) as never, rosterEntry: entry as never }),
    );
    const totalMw = rosterPlayers.reduce((sum, p, i) => sum + (contracts[i]?.marketValue ?? p.marketValue ?? p.displayMarketValue ?? 0), 0);
    const salaries = rosterEntries.map((entry, i) => contracts[i]?.salary ?? entry.salary ?? playerById.get(entry.playerId)?.salaryDemand ?? 0);
    const avgSalary = avg(salaries);
    const contractLengths = rosterEntries.map((entry) => entry.contractLength).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const avgContractLength = contractLengths.length ? avg(contractLengths) : null;

    const gm = getTeamGeneralManager(gameState, team.teamId);
    const bias = gm?.profile?.bias ?? null;
    const identity = identityByTeamId.get(team.teamId) ?? null;

    rows.push({
      teamId: team.teamId,
      teamName: team.name,
      rosterCount: rosterPlayers.length,
      hasThemeTarget: Boolean(target),
      target,
      quotaShare,
      minimumShare: target?.minimumShare ?? null,
      targetShare: target?.targetShare ?? null,
      quotaMet,
      avoidCount,
      avoidClean,
      distinctRaceCount: races.length,
      races,
      hasRaceQuota,
      flavorNotRaceLocked,
      flavorTagCoverage,
      totalMw,
      cash: team.cash ?? 0,
      avgSalary,
      avgContractLength,
      identityFinances: identity?.finances ?? null,
      gmArchetype: gm?.profile?.archetype ?? null,
      valuePriority: bias?.valuePriority ?? null,
      cashPriority: bias?.cashPriority ?? null,
      sellForProfitAggression: bias?.sellForProfitAggression ?? null,
      shortContractPreference: bias?.shortContractPreference ?? null,
      longContractPreference: bias?.longContractPreference ?? null,
      mwPerSalary: avgSalary > 0 ? totalMw / rosterEntries.length / avgSalary : null,
    });
  }

  // --- Per-team table ---
  console.log(`# Identity-Fidelity Audit (P5) · save=${saveId} · season=${gameState.season?.id ?? "?"} · teams=${rows.length}`);
  console.log("");
  console.log("## Theme fidelity");
  console.log("");
  console.log("Team|Name|Kader|QuotaShare|Min|Target|QuotaMet|Avoid|AvoidClean|Races|RaceQuota|FlavorNotLocked|FlavorCov");
  for (const r of rows) {
    console.log(
      [
        r.teamId,
        r.teamName,
        r.rosterCount,
        r.hasThemeTarget ? pct(r.quotaShare ?? 0) : "n/a",
        r.hasThemeTarget ? pct(r.minimumShare ?? 0) : "n/a",
        r.hasThemeTarget ? pct(r.targetShare ?? 0) : "n/a",
        r.quotaMet === null ? "n/a" : r.quotaMet ? "PASS" : "FAIL",
        r.avoidCount,
        r.avoidClean ? "PASS" : "FAIL",
        `${r.distinctRaceCount}(${r.races.join(",")})`,
        r.hasRaceQuota ? "yes" : "no",
        r.flavorNotRaceLocked === null ? "n/a" : r.flavorNotRaceLocked ? "PASS" : "FAIL",
        r.flavorTagCoverage == null ? "n/a" : pct(r.flavorTagCoverage),
      ].join("|"),
    );
  }

  console.log("");
  console.log("## Economic fidelity (GM bias vs actuals)");
  console.log("");
  console.log("Team|Kader|TotalMW|Cash|AvgSalary|MW/Salary|AvgContractLen|IdentityFinances|GM|valuePri|cashPri|sellProfitAgg|shortContractPref|longContractPref");
  for (const r of rows) {
    console.log(
      [
        r.teamId,
        r.rosterCount,
        round(r.totalMw),
        round(r.cash),
        round(r.avgSalary),
        r.mwPerSalary == null ? "n/a" : round(r.mwPerSalary, 2),
        r.avgContractLength == null ? "n/a" : round(r.avgContractLength, 2),
        r.identityFinances ?? "n/a",
        r.gmArchetype ?? "n/a",
        r.valuePriority ?? "n/a",
        r.cashPriority ?? "n/a",
        r.sellForProfitAggression ?? "n/a",
        r.shortContractPreference ?? "n/a",
        r.longContractPreference ?? "n/a",
      ].join("|"),
    );
  }

  // --- League summary ---
  const themedRows = rows.filter((r) => r.hasThemeTarget);
  const quotaPass = themedRows.filter((r) => r.quotaMet).length;
  const avoidPass = rows.filter((r) => r.avoidClean).length;
  const raceLocked = themedRows.filter((r) => r.flavorNotRaceLocked === false).length;

  console.log("");
  console.log("## SUMMARY");
  console.log("");
  console.log(`Themed teams: ${themedRows.length}/${rows.length} (A-A has no THEME_TARGETS entry — reported n/a above)`);
  console.log(`Quota met (share >= minimumShare): ${quotaPass}/${themedRows.length}`);
  console.log(`Avoid-clean (<= tolerance avoid-tag players on roster): ${avoidPass}/${rows.length}`);
  console.log(`Race-locked (< 2 races, no real race quota): ${raceLocked}/${themedRows.length}`);

  const rowsWithRosters = rows.filter((r) => r.rosterCount > 0);
  const valueVsRatio = medianSplitGap(rowsWithRosters, (r) => r.valuePriority, (r) => r.mwPerSalary);
  const shortPrefVsContract = medianSplitGap(rowsWithRosters, (r) => r.shortContractPreference, (r) => r.avgContractLength);
  const longPrefVsContract = medianSplitGap(rowsWithRosters, (r) => r.longContractPreference, (r) => r.avgContractLength);
  const cashPriVsCash = medianSplitGap(rowsWithRosters, (r) => r.cashPriority, (r) => r.cash);

  console.log("");
  console.log("## Correlation eyeballs (median-split gap: high-group avg − low-group avg)");
  console.log(
    `valuePriority → MW/Salary ratio:        ${valueVsRatio == null ? "n/a (need >=4 teams with rosters+bias)" : valueVsRatio} (positive = high-value-priority teams buy more efficiently, as expected)`,
  );
  console.log(
    `shortContractPreference → avgContractLen: ${shortPrefVsContract == null ? "n/a" : shortPrefVsContract} (negative expected: high short-pref → shorter contracts)`,
  );
  console.log(
    `longContractPreference → avgContractLen:  ${longPrefVsContract == null ? "n/a" : longPrefVsContract} (positive expected: high long-pref → longer contracts)`,
  );
  console.log(
    `cashPriority → cash on hand:              ${cashPriVsCash == null ? "n/a" : cashPriVsCash} (positive expected: high cash-priority teams hoard more cash)`,
  );

  if (rows.some((r) => r.rosterCount === 0)) {
    const empty = rows.filter((r) => r.rosterCount === 0).map((r) => r.teamId);
    console.log("");
    console.log(`NOTE: teams with 0 rostered players (no fidelity signal, config-only rows above): ${empty.join(", ")}`);
  }
}

main();
