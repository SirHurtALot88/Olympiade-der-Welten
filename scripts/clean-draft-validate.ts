/**
 * Validation harness for the clean S1 draft engine (OLY_CLEAN_DRAFT).
 *
 * Bootstraps ONE fresh Season-1 save, runs the canonical S1 draft phase (which uses the clean engine
 * by default; OLY_CLEAN_DRAFT=0 opts out), then classifies every roster by market value and checks R-R's races.
 * Uses an isolated scratch SQLite DB — never touches the shared/live save.
 */
import path from "node:path";

const SCRATCH_DIR =
  process.env.OLY_CLEAN_DRAFT_SCRATCH ??
  "/tmp/claude-0/-home-user-Olympiade-der-Welten/3517e856-a4ae-54fc-ab94-5139036205fa/scratchpad";
process.env.OLY_APP_SQLITE_PATH = path.join(SCRATCH_DIR, `clean-draft-sim-${Date.now()}.sqlite`);

import { loadEnvConfig } from "@next/env";

import type { GameState, TeamControlSettings } from "@/lib/data/olyDataTypes";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { withNormalizedTeamGeneralManagers } from "@/lib/foundation/team-general-managers";
import { getTeamStrategyProfile } from "@/lib/foundation/team-strategy-profiles";
import { getTeamThemeCompositionTarget } from "@/lib/ai/team-theme-composition-service";
import { buildLeagueMarketBrackets } from "@/lib/ai/market-pick-engine/market-brackets";
import { planTeamLanes } from "@/lib/ai/clean-draft-engine/plan-team-lanes";
import { buildCleanThemeTarget } from "@/lib/ai/clean-draft-engine/run-clean-draft";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { SEASON_START_RESET_CONFIRM_TOKEN } from "@/lib/persistence/season-start-reset-contract";
import { runSeasonStartReset } from "@/lib/persistence/season-start-reset-service";
import { withScenarioMeta } from "@/lib/persistence/scenario-meta";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { runCanonicalSeasonOneDraftPhase } from "@/lib/season/long-run-canonical";

const PROJECT_ROOT = path.resolve(__dirname, "..");

type Lane = "SS" | "St" | "Co" | "De" | "Bu" | "Re";
const LANE_ORDER: Lane[] = ["SS", "St", "Co", "De", "Bu", "Re"];

function classify(marketValue: number): Lane {
  if (marketValue >= 65) return "SS";
  if (marketValue >= 45) return "St";
  if (marketValue >= 30) return "Co";
  if (marketValue >= 20) return "De";
  if (marketValue >= 12) return "Bu";
  return "Re";
}

function log(message: string) {
  console.log(message);
}

function setAllTeamsAi(save: PersistedSaveGame, persistence: PersistenceService) {
  const settings = Object.fromEntries(
    save.gameState.teams.map((team) => [
      team.teamId,
      {
        teamId: team.teamId,
        controlMode: "ai",
        ownerId: "ai",
        ownerSlot: "ai",
        displayLabel: `AI · ${team.shortCode}`,
        aiLineupPreviewEnabled: true,
        aiLineupApplyEnabled: true,
        aiLineupAutoApplyEnabled: false,
        aiTransferPreviewEnabled: true,
        aiTransferAutoApplyEnabled: true,
        aiSellPreviewEnabled: true,
        aiSellAutoApplyEnabled: true,
        notes: "clean_draft_validate_all_ai",
        strategyLock: null,
      } satisfies TeamControlSettings,
    ]),
  );
  const gameState = withScenarioMeta(
    {
      ...save.gameState,
      teams: save.gameState.teams.map((team) => ({ ...team, humanControlled: false })),
      seasonState: { ...save.gameState.seasonState, teamControlSettings: settings },
    },
    {
      scenarioType: "sandbox_multiseason_test",
      label: save.name,
      description: "Clean draft validation save.",
      sourceSaveId: save.saveId,
      isStableTestPoint: true,
      allowTestWrites: true,
      containsSeasonHistory: false,
      containsFinalStandings: false,
    },
  );
  return persistence.saveSingleplayerState(save.saveId, gameState);
}

function laneHistogram(lanes: string[]) {
  const order = ["superstar", "star", "core", "depth", "backup", "reserve"];
  const counts = lanes.reduce<Record<string, number>>((acc, lane) => {
    acc[lane] = (acc[lane] ?? 0) + 1;
    return acc;
  }, {});
  return order
    .filter((lane) => counts[lane])
    .map((lane) => `${lane}:${counts[lane]}`)
    .join(" ");
}

function previewPlans(gameState: GameState, teamCodes: string[]) {
  const brackets = buildLeagueMarketBrackets(gameState.players.map((player) => player.marketValue));
  log("\n=== PLAN PREVIEW (pre-draft, budget-fit lane mix) ===");
  for (const code of teamCodes) {
    const team = gameState.teams.find((entry) => entry.teamId === code || entry.shortCode === code);
    if (!team) continue;
    const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const strategy = getTeamStrategyProfile(gameState, team.teamId);
    const themeTarget = buildCleanThemeTarget(getTeamThemeCompositionTarget(team.teamId));
    const plan = planTeamLanes({
      teamId: team.teamId,
      identity,
      strategy,
      spendableCash: team.cash,
      currentRosterCount: gameState.rosters.filter((entry) => entry.teamId === team.teamId).length,
      brackets,
    });
    const meanCost = plan.slots.reduce((sum, slot) => sum + brackets[slot.lane].targetMw, 0);
    log(
      `${team.shortCode.padStart(4)} cash=${team.cash.toFixed(0).padStart(4)} spendable=${plan.spendable.toFixed(0).padStart(4)} perSlot=${plan.perSlotBudget.toFixed(1).padStart(5)} slots=${String(plan.slots.length).padStart(2)} ΣmeanCost=${meanCost.toFixed(0).padStart(4)} theme=${themeTarget ? themeTarget.coreRaces.join("/") : "-"} | ${laneHistogram(plan.slots.map((s) => s.lane))}`,
    );
  }
}

function rosterDetail(gameState: GameState, teamCode: string) {
  const team = gameState.teams.find((entry) => entry.shortCode === teamCode || entry.teamId === teamCode);
  if (!team) return;
  const playersById = new Map(gameState.players.map((player) => [player.id, player]));
  const roster = gameState.rosters
    .filter((entry) => entry.teamId === team.teamId)
    .map((entry) => playersById.get(entry.playerId))
    .filter((player): player is NonNullable<typeof player> => Boolean(player))
    .sort((a, b) => b.marketValue - a.marketValue);
  log(
    `\n=== ROSTER DETAIL ${team.shortCode} (cash=${team.cash.toFixed(0)}, n=${roster.length}) ===`,
  );
  log(roster.map((player) => `${classify(player.marketValue)}:${player.marketValue.toFixed(0)}(${player.race})`).join("  "));
}

function report(gameState: GameState) {
  const playersById = new Map(gameState.players.map((player) => [player.id, player]));
  const leagueTotals: Record<Lane, number> = { SS: 0, St: 0, Co: 0, De: 0, Bu: 0, Re: 0 };
  let totalPlayers = 0;
  let belowMin = 0;
  let negativeCash = 0;

  log("\n=== PER-TEAM LANE BREAKDOWN (by market value) ===");
  log(
    ["team", "roster", "min", "cash", ...LANE_ORDER].map((h) => h.padStart(h.length <= 2 ? 4 : 7)).join(" "),
  );
  const richestByCashDesc: Array<{ code: string; premium: number }> = [];

  for (const team of gameState.teams) {
    const identity = gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const { playerMin } = deriveRosterTargets(team, identity ?? undefined);
    const roster = gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const counts: Record<Lane, number> = { SS: 0, St: 0, Co: 0, De: 0, Bu: 0, Re: 0 };
    for (const entry of roster) {
      const player = playersById.get(entry.playerId);
      const mv = player?.marketValue ?? 0;
      const lane = classify(mv);
      counts[lane] += 1;
      leagueTotals[lane] += 1;
      totalPlayers += 1;
    }
    if (roster.length < playerMin) belowMin += 1;
    if (team.cash < 0) negativeCash += 1;
    richestByCashDesc.push({ code: team.shortCode, premium: counts.SS + counts.St });
    log(
      [
        team.shortCode.padStart(4),
        String(roster.length).padStart(6),
        String(playerMin).padStart(3),
        team.cash.toFixed(0).padStart(6),
        ...LANE_ORDER.map((lane) => String(counts[lane]).padStart(lane.length <= 2 ? 4 : 7)),
      ].join(" "),
    );
  }

  log("\n=== LEAGUE LANE TOTALS ===");
  log(LANE_ORDER.map((lane) => `${lane}=${leagueTotals[lane]}`).join(" "));
  const reserveShare = totalPlayers > 0 ? (leagueTotals.Re / totalPlayers) * 100 : 0;
  const realTier = leagueTotals.SS + leagueTotals.St + leagueTotals.Co + leagueTotals.De + leagueTotals.Bu;
  log(
    `total=${totalPlayers} reserveShare=${reserveShare.toFixed(1)}% realTier(SS..Bu)=${realTier} (${((realTier / (totalPlayers || 1)) * 100).toFixed(1)}%)`,
  );
  log(`teamsBelowMin=${belowMin} teamsNegativeCash=${negativeCash}`);
  log("Baseline (old path): SS23 St23 Co30 De31 Bu2 Re264  reserveShare~72%  R-R ~1/11 aqua");

  // R-R theme check
  const rr = gameState.teams.find((team) => team.teamId === "R-R");
  if (rr) {
    const rrRoster = gameState.rosters.filter((entry) => entry.teamId === "R-R");
    const races = rrRoster
      .map((entry) => playersById.get(entry.playerId)?.race ?? "?")
      .map((race) => String(race).toLowerCase());
    const themeTarget = getTeamThemeCompositionTarget("R-R");
    const coreRaces = new Set((themeTarget?.raceQuotaScoped?.races ?? []).map((race) => race.toLowerCase()));
    const fishAqua = races.filter((race) => race === "fish" || race === "aqua").length;
    const coreCount = races.filter((race) => coreRaces.has(race)).length;
    log("\n=== R-R 'Riptide Rivers' RACES ===");
    log(races.join(", "));
    const raceHist = races.reduce<Record<string, number>>((acc, race) => {
      acc[race] = (acc[race] ?? 0) + 1;
      return acc;
    }, {});
    log(`histogram: ${Object.entries(raceHist).map(([race, n]) => `${race}:${n}`).join(" ")}`);
    log(
      `fish+aqua=${fishAqua}/${races.length} (${((fishAqua / (races.length || 1)) * 100).toFixed(0)}%)  quotaRaces(fish/aqua/lizard)=${coreCount}/${races.length} (min ${(themeTarget?.minimumShare ?? 0) * 100}%)`,
    );
    log(`R-R majority fish/aqua: ${fishAqua * 2 > races.length ? "YES" : "NO"}`);
  }

  // A rich team can still buy premium?
  const anyPremium = richestByCashDesc.some((row) => row.premium > 0);
  log(`\nAny team bought premium (SS/St): ${anyPremium ? "YES" : "NO"}`);
}

async function main() {
  const startedAt = Date.now();
  loadEnvConfig(PROJECT_ROOT);
  log(`[clean-draft-validate] OLY_CLEAN_DRAFT=${process.env.OLY_CLEAN_DRAFT ?? "(unset)"}`);
  log(`[clean-draft-validate] DB=${process.env.OLY_APP_SQLITE_PATH}`);

  const persistence = createPersistenceService();
  const created = persistence.createFreshSeasonOneSave({ name: `Clean Draft Validate ${new Date().toISOString()}`, activate: true });
  const reset = await runSeasonStartReset({
    source: "sqlite",
    saveId: created.saveId,
    seasonId: created.gameState.season.id,
    dryRun: false,
    confirmToken: SEASON_START_RESET_CONFIRM_TOKEN,
  });
  if (reset.status !== "applied") {
    throw new Error(`Season-start reset blocked: ${reset.blockingReasons.join(" | ") || reset.warnings.join(" | ")}`);
  }
  let save = persistence.getSaveById(created.saveId) ?? created;
  save = persistence.saveSingleplayerState(save.saveId, withNormalizedTeamGeneralManagers(save.gameState));
  save = setAllTeamsAi(save, persistence);

  // Pick representative teams across the cash range for the plan preview + roster detail.
  const byCashAsc = [...save.gameState.teams].sort((a, b) => a.cash - b.cash);
  const poorTeam = byCashAsc[0]!;
  const richTeam = byCashAsc[byCashAsc.length - 1]!;
  const previewCodes = Array.from(
    new Set([poorTeam.shortCode, richTeam.shortCode, "Z-H", "M-M", "R-R"]),
  );
  previewPlans(save.gameState, previewCodes);

  log(`[clean-draft-validate] running S1 draft (freeAgents=${save.gameState.players.length})…`);
  const draftStartedAt = Date.now();
  const draftPhase = await runCanonicalSeasonOneDraftPhase(save, persistence);
  const draftMs = Date.now() - draftStartedAt;

  save = persistence.getSaveById(save.saveId) ?? save;
  report(save.gameState);
  rosterDetail(save.gameState, poorTeam.shortCode);
  rosterDetail(save.gameState, richTeam.shortCode);
  rosterDetail(save.gameState, "R-R");

  log(`\n=== TIMING & BLOCKERS ===`);
  log(`draft wall-time: ${(draftMs / 1000).toFixed(1)}s   total: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  log(`blockers (${draftPhase.blockers.length}): ${draftPhase.blockers.slice(0, 20).join(" | ") || "none"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
