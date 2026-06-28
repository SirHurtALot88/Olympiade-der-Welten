import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { runAiPicksExecutePreview, type AiPicksRunResult } from "@/lib/ai/ai-picks-run-service";
import type { GameState, Player, RosterEntry, RosterPromisedRole, Team, TransferHistoryEntry } from "@/lib/data/olyDataTypes";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { withScenarioMeta } from "@/lib/persistence/scenario-meta";
import { setGmAssignmentSeedSalt } from "@/lib/foundation/team-general-managers";
import { AI_PICKS_RUN_CONFIRM_TOKEN } from "@/lib/ai/ai-picks-run-contract";

const OUTPUT_DIR = path.join(process.env.OLY_EXPORT_DIR ?? "outputs", "fresh-pick-audit-10x");

type Level = "GREEN" | "YELLOW" | "RED";

type CliArgs = {
  runs: number;
  stepsPerTeam: number;
  apply: boolean;
};

type RunRecord = {
  run: number;
  saveId: string;
  saveName: string;
  status: Level;
  previewStatus: string;
  previewClean: boolean;
  plannedPicks: number;
  appliedPicks: number;
  teamsBelowMin: number;
  teamsOverMax: number;
  targetGapGt2: number;
  redTeams: number;
  yellowTeams: number;
  cashMin: number | null;
  cashMax: number | null;
  durationMs: number;
  activeCandidate: boolean;
  draftSeed: string;
};

type TeamRecord = {
  run: number;
  saveId: string;
  teamId: string;
  teamName: string;
  status: Level;
  rosterCount: number;
  playerMin: number;
  playerOpt: number;
  playerMax: number;
  cashStart: number | null;
  cashEnd: number | null;
  totalSpend: number;
  avgSpend: number | null;
  mostExpensivePlayer: string | null;
  mostExpensiveShareOfStartCash: number | null;
  salaryTotal: number;
  salaryToCashRatio: number | null;
  roleMix: string;
  avgIdentityFit: number | null;
  avgThemeFit: number | null;
  avgNeedFit: number | null;
  avgAxisFit: number | null;
  strongestAxis: string | null;
  weakestAxis: string | null;
  openNeedsAfterDraft: string;
  reachedMin: boolean;
  reachedOpt: boolean;
  underOptReason: string | null;
  overspendWarning: string | null;
  starAndTrashRisk: boolean;
  needFirstScore: number;
  budgetPacingScore: number;
  identityFitScore: number;
  themeFitScore: number;
  axisFitScore: number;
  roleMixScore: number;
  overspendRisk: number;
  retoolParity: number;
  specialQuota: string | null;
  redFlags: string;
  yellowFlags: string;
};

type PickRecord = {
  run: number;
  saveId: string;
  pickNo: number;
  teamId: string;
  playerId: string;
  playerName: string;
  price: number | null;
  salary: number | null;
  contractLength: number;
  promisedRole: RosterPromisedRole;
  role: string;
  phase: string | null;
  focusType: string | null;
  focusKey: string | null;
  stepAxis: string | null;
  topNeedBeforePick: string | null;
  solvedNeed: string | null;
  marginalNeedGain: number | null;
  axisFitPOW: number | null;
  axisFitSPE: number | null;
  axisFitMEN: number | null;
  axisFitSOC: number | null;
  disciplineFitTop5: number | null;
  identityFit: number | null;
  themeFit: number | null;
  classFit: number | null;
  raceFit: number | null;
  subclassFit: number | null;
  traitFit: number | null;
  salaryRisk: number | null;
  contractRisk: number | null;
  draftSeed: string | null;
  baseScore: number | null;
  tieBreakJitter: number | null;
  scoreWithSeed: number | null;
  tieBreakBand: string | null;
  budgetBefore: number | null;
  budgetAfter: number | null;
  futureRosterFeasibility: string | null;
  whyPicked: string;
  whyRejectedBetterLookingCandidate: string | null;
  redFlag: string | null;
  yellowFlag: string | null;
};

type RejectedRecord = {
  run: number;
  saveId: string;
  teamId: string;
  pickNo: number;
  selectedPlayerId: string;
  rejectedRank: number;
  rejectedPlayerId: string;
  rejectedPlayerName: string;
  rejectedClass: string;
  rejectedPrice: number | null;
  rejectedScore: number | null;
  whyRejected: string;
};

type OverspendRecord = {
  run: number;
  saveId: string;
  teamId: string;
  status: Level;
  mostExpensivePlayer: string | null;
  mostExpensiveShareOfStartCash: number | null;
  expensiveOver40Pct: boolean;
  expensiveOver60Pct: boolean;
  starPickWithNeedFit: boolean;
  starPickWithIdentityFit: boolean;
  starPickWithThemeFit: boolean;
  starPickWithAvoidTag: boolean;
  coreAfterStarFinanceable: boolean;
  starAndTrashRisk: boolean;
  cashBelow5: boolean;
  cashOver100WithOpenNeeds: boolean;
  notes: string;
};

function parseArgs(argv: string[]): CliArgs {
  let runs = 10;
  let stepsPerTeam = 12;
  let apply = true;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--runs") {
      const parsed = Number(argv[index + 1] ?? "");
      runs = Number.isFinite(parsed) ? Math.max(1, Math.min(20, Math.round(parsed))) : runs;
      index += 1;
    } else if (token === "--steps-per-team") {
      const parsed = Number(argv[index + 1] ?? "");
      stepsPerTeam = Number.isFinite(parsed) ? Math.max(1, Math.min(16, Math.round(parsed))) : stepsPerTeam;
      index += 1;
    } else if (token === "--preview-only") {
      apply = false;
    }
  }
  return { runs, stepsPerTeam, apply };
}

function csvCell(value: unknown) {
  const text =
    value == null
      ? ""
      : Array.isArray(value)
        ? value.join(" | ")
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "";
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `${[headers.map(csvCell).join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n")}\n`;
}

function round(value: number | null | undefined, digits = 2) {
  return value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
}

function avg(values: Array<number | null | undefined>) {
  const finite = values.filter((value): value is number => value != null && Number.isFinite(value));
  return finite.length > 0 ? round(finite.reduce((sum, value) => sum + value, 0) / finite.length) : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function activePicks(team: AiPicksRunResult["teams"][number]) {
  return team.plannedPicks.filter((pick) => pick.status !== "blocked");
}

function deriveContractLength(price: number | null | undefined, role: string | null | undefined) {
  if (role === "superstar_pick" || (price ?? 0) >= 60) return 4;
  if (role === "star_pick" || (price ?? 0) >= 35) return 3;
  if ((price ?? 0) >= 18) return 2;
  return 1;
}

function derivePromisedRole(price: number | null | undefined, contractLength: number, rosterBefore: number): RosterPromisedRole {
  if (contractLength >= 4 || (price ?? 0) >= 35 || rosterBefore < 6) return "starter";
  if (contractLength >= 2 || (price ?? 0) >= 18) return "rotation";
  return "prospect";
}

function roleFromPickLane(lane: string | null | undefined) {
  if (lane === "superstar_pick" || lane === "star_pick") return "Star";
  if (lane === "core_investment") return "Core";
  if (lane === "specialist_investment" || lane === "depth_value") return "Rotation";
  if (lane === "backup") return "Backup";
  return "Prospect";
}

function roleTagFromPromised(promisedRole: RosterPromisedRole): RosterEntry["roleTag"] {
  return promisedRole === "starter" || promisedRole === "rotation" ? "starter" : promisedRole === "bench" ? "bench" : "prospect";
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function playerTokens(player: Player | null | undefined) {
  const tokens = [
    player?.name,
    player?.race,
    player?.className,
    player?.referenceClass,
    ...(player?.subclasses ?? []),
    ...(player?.traitsPositive ?? []),
    ...(player?.traitsNegative ?? []),
    player?.gender,
  ];
  return new Set(tokens.flatMap((value) => normalize(value).split(/[^a-z0-9]+/g).filter(Boolean)));
}

function hasAny(tokens: Set<string>, needles: string[]) {
  return needles.some((needle) => tokens.has(normalize(needle)) || [...tokens].some((token) => token.includes(normalize(needle))));
}

function isFemale(player: Player | null | undefined, tokens = playerTokens(player)) {
  return normalize(player?.gender) === "female" || hasAny(tokens, ["female", "woman", "girl", "lady", "madame", "queen", "princess", "witch", "succubus"]);
}

function isPet(player: Player | null | undefined, tokens = playerTokens(player)) {
  return normalize(player?.race) === "animal" || hasAny(tokens, ["pet", "animal", "beast", "cat", "dog"]);
}

function getHeight(player: Player | null | undefined) {
  const raw = (player as { height?: unknown } | null | undefined)?.height;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const parsed = Number(String(raw ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isHeightOrSizeThemePlayer(player: Player | null | undefined, tokens = playerTokens(player)) {
  return (
    getHeight(player) >= 5 ||
    hasAny(tokens, ["giant", "titan", "colossus", "tall", "huge", "ogre", "troll", "behemoth", "goliath", "hulk", "massive"])
  );
}

function specialQuotaForTeam(teamId: string, players: Player[]) {
  const total = Math.max(players.length, 1);
  const count = (predicate: (player: Player, tokens: Set<string>) => boolean) =>
    players.filter((player) => predicate(player, playerTokens(player))).length;
  const share = (value: number) => round(value / total, 3) ?? 0;
  if (teamId === "H-R") return { label: "Demon/Hell", share: share(count((_p, t) => hasAny(t, ["demon", "hell", "fiend", "prime", "succubus", "incubus", "infernal", "devil"]))), target: 0.75, hard: true };
  if (teamId === "L-K") return { label: "Undead/Vampire/Skeleton/Ghoul", share: share(count((_p, t) => hasAny(t, ["undead", "vampire", "skeleton", "ghoul", "lich", "zombie", "ghost", "wraith", "revenant", "mummy"]))), target: 0.75, hard: false };
  if (teamId === "P-C") return { label: "Pirate/Swashbuckler/Wayfarer", share: share(count((_p, t) => hasAny(t, ["pirate", "swashbuckler", "wayfarer", "corsair"]))), target: 0.75, hard: true };
  if (teamId === "V-D") return { label: "Female/Pet", share: share(count((p, t) => isFemale(p, t) || isPet(p, t))), target: 1, hard: true };
  if (teamId === "D-P") return { label: "Female", share: share(count((p, t) => isFemale(p, t))), target: 0.8, hard: true };
  if (teamId === "T-G") return { label: "Height>=5/SizeTheme", share: share(count((p, t) => isHeightOrSizeThemePlayer(p, t))), target: 1, hard: true };
  if (teamId === "D-L") return { label: "Human", share: share(count((p, t) => normalize(p.race) === "human" || hasAny(t, ["human"]))), target: 0.75, hard: false };
  if (teamId === "S-S") return { label: "Construct/Bot/Augmented", share: share(count((_p, t) => hasAny(t, ["construct", "robot", "android", "machine", "augmented", "cyborg", "bot"]))), target: 0.6, hard: true };
  if (teamId === "R-R") return { label: "Aqua/Nature/Alien", share: share(count((_p, t) => hasAny(t, ["aqua", "aquatic", "fish", "alien", "nature", "plant", "river", "water", "ocean", "sea"]))), target: 0.6, hard: false };
  if (teamId === "W-W") return { label: "Mental/Mage/Arcane", share: share(count((_p, t) => hasAny(t, ["mage", "wizard", "arcane", "mental", "will", "torment", "witch"]))), target: 0.5, hard: false };
  return null;
}

function teamLevel(redFlags: string[], yellowFlags: string[]): Level {
  if (redFlags.length > 0) return "RED";
  if (yellowFlags.length > 0) return "YELLOW";
  return "GREEN";
}

function combineLevel(levels: Level[]): Level {
  if (levels.includes("RED")) return "RED";
  if (levels.includes("YELLOW")) return "YELLOW";
  return "GREEN";
}

function applyPreviewToSave(save: NonNullable<ReturnType<ReturnType<typeof createPersistenceService>["getActiveSave"]>>, preview: AiPicksRunResult) {
  const playersById = new Map(save.gameState.players.map((player) => [player.id, player]));
  const teamCash = new Map(save.gameState.teams.map((team) => [team.teamId, team.cash]));
  const teamRosterCount = new Map(save.gameState.teams.map((team) => [team.teamId, 0]));
  const rosters: RosterEntry[] = [];
  const transferHistory: TransferHistoryEntry[] = [];
  const timestamp = new Date().toISOString();

  for (const team of preview.teams) {
    for (const pick of activePicks(team)) {
      const price = pick.marketValue ?? 0;
      const currentCash = teamCash.get(team.teamId) ?? 0;
      const rosterBefore = teamRosterCount.get(team.teamId) ?? 0;
      const contractLength = deriveContractLength(price, pick.pickLane);
      const promisedRole = derivePromisedRole(price, contractLength, rosterBefore);
      const player = playersById.get(pick.playerId) ?? null;
      rosters.push({
        id: `roster-${randomUUID()}`,
        teamId: team.teamId,
        playerId: pick.playerId,
        contractLength,
        salary: pick.salary ?? 0,
        upkeep: pick.salary ?? 0,
        purchasePrice: price,
        currentValue: price,
        roleTag: roleTagFromPromised(promisedRole),
        promisedRole,
        joinedSeasonId: save.gameState.season.id,
      });
      transferHistory.unshift({
        id: `history-${randomUUID()}`,
        playerId: pick.playerId,
        playerName: pick.playerName,
        seasonId: save.gameState.season.id,
        matchdayId: save.gameState.matchdayState.matchdayId ?? null,
        phase: "fresh_pick_audit_10x",
        source: "ai_pick_10x_audit",
        seasonLabel: save.gameState.season.name,
        transferType: "buy",
        fromTeamId: null,
        toTeamId: team.teamId,
        fee: price,
        salary: pick.salary ?? 0,
        marketValue: price,
        remainingContractLength: contractLength,
        happenedAt: timestamp,
      });
      teamCash.set(team.teamId, round(currentCash - price) ?? currentCash - price);
      teamRosterCount.set(team.teamId, rosterBefore + 1);
      if (!player) {
        // Should never happen; leaving row traceable through transfer history is more useful than throwing mid-series.
      }
    }
  }

  const gameState: GameState = {
    ...save.gameState,
    teams: save.gameState.teams.map((team) => ({
      ...team,
      cash: round(teamCash.get(team.teamId) ?? team.cash) ?? team.cash,
    })),
    rosters,
    transferHistory,
  };
  return withScenarioMeta(gameState, {
    scenarioType: "ai_redraft_test",
    label: save.name,
    description: "10x Fresh Start Pick Audit batch-applied from AI2 preview picks.",
    isStableTestPoint: true,
  });
}

function buildRecordsForRun(input: {
  run: number;
  saveId: string;
  preview: AiPicksRunResult;
  gameState: GameState;
  durationMs: number;
  draftSeed: string;
}) {
  const { run, saveId, preview, gameState } = input;
  const playersById = new Map(gameState.players.map((player) => [player.id, player]));
  const teamsById = new Map(gameState.teams.map((team) => [team.teamId, team]));
  const identitiesByTeam = new Map(gameState.teamIdentities.map((identity) => [identity.teamId, identity]));
  const pickRows: PickRecord[] = [];
  const rejectedRows: RejectedRecord[] = [];
  const teamRows: TeamRecord[] = [];
  const overspendRows: OverspendRecord[] = [];
  let globalPickNo = 0;

  for (const teamResult of preview.teams) {
    const team = teamsById.get(teamResult.teamId);
    const identity = identitiesByTeam.get(teamResult.teamId) ?? null;
    const targets = deriveRosterTargets(team, identity);
    const picks = activePicks(teamResult);
    const pickedPlayers = picks.map((pick) => playersById.get(pick.playerId)).filter((player): player is Player => Boolean(player));
    const cashStart = teamResult.previewSummary.startingCash ?? teamResult.cashBefore ?? null;
    const cashEnd = teamResult.previewSummary.cashAfterPlannedBuys ?? teamResult.cashAfter ?? null;
    const totalSpend = round(teamResult.previewSummary.plannedSpendTotal ?? picks.reduce((sum, pick) => sum + (pick.marketValue ?? 0), 0)) ?? 0;
    const salaryTotal = round(picks.reduce((sum, pick) => sum + (pick.salary ?? 0), 0)) ?? 0;
    const mostExpensivePick = [...picks].sort((left, right) => (right.marketValue ?? 0) - (left.marketValue ?? 0))[0] ?? null;
    const roleCounts = new Map<string, number>();
    for (const pick of picks) roleCounts.set(roleFromPickLane(pick.pickLane), (roleCounts.get(roleFromPickLane(pick.pickLane)) ?? 0) + 1);
    const specialQuota = specialQuotaForTeam(teamResult.teamId, pickedPlayers);
    const redFlags: string[] = [];
    const yellowFlags: string[] = [];
    const rosterCount = picks.length;
    const targetGap = Math.max((teamResult.targetRosterSize ?? teamResult.targetRosterOpt ?? targets.playerOpt) - rosterCount, 0);
    const mostExpensiveShare = cashStart && cashStart > 0 && mostExpensivePick ? round((mostExpensivePick.marketValue ?? 0) / cashStart, 4) : null;
    const starPicks = picks.filter((pick) => pick.pickLane === "star_pick" || pick.pickLane === "superstar_pick");
    const cheapAfterStar = picks.filter((pick) => (pick.marketValue ?? 0) < 18).length;
    const starAndTrashRisk = starPicks.length > 0 && cheapAfterStar >= Math.max(3, Math.ceil(picks.length * 0.4));
    const negativeNonMercenary = picks.filter(
      (pick) => (pick.scoreBreakdown.teamIdentityScore ?? 0) < 0 && (pick.scoreBreakdown.mercenaryNegativeFitPenalty ?? 0) >= 0,
    );
    if (rosterCount < targets.playerMin) redFlags.push("under_playerMin");
    if (rosterCount > targets.playerMax) redFlags.push("over_playerMax");
    if (cashEnd != null && cashEnd < -0.01) redFlags.push("negative_cash");
    if (negativeNonMercenary.length > 0) redFlags.push("negative_fit_non_mercenary");
    if (specialQuota && specialQuota.hard && specialQuota.share < specialQuota.target) redFlags.push(`${specialQuota.label}_quota_${specialQuota.share}_lt_${specialQuota.target}`);
    if (targetGap > 2) yellowFlags.push(`under_opt_gap_${targetGap}`);
    if (starAndTrashRisk) yellowFlags.push("star_and_trash_risk");
    if (mostExpensiveShare != null && mostExpensiveShare > 0.6 && teamResult.teamCode !== "M-M") yellowFlags.push("single_star_over_60pct_cash");
    if (cashEnd != null && cashEnd > 100 && targetGap > 0) yellowFlags.push("cash_high_with_open_needs");
    if (specialQuota && !specialQuota.hard && specialQuota.share < specialQuota.target) yellowFlags.push(`${specialQuota.label}_quota_soft_${specialQuota.share}`);

    const identityAvg = avg(picks.map((pick) => pick.scoreBreakdown.teamIdentityScore));
    const themeAvg = avg(picks.map((pick) => pick.scoreBreakdown.teamThemeFitScore));
    const needAvg = avg(picks.map((pick) => pick.scoreBreakdown.needMatchScore));
    const axisAvg = avg(picks.map((pick) => pick.scoreBreakdown.teamAxisFitScore));
    const parityParts = {
      needFirstScore: clamp((needAvg ?? 0) * 8 + 45, 0, 100),
      budgetPacingScore: clamp(100 - Math.max(0, targetGap - 2) * 18 - (cashEnd != null && cashEnd < 0 ? 80 : 0), 0, 100),
      identityFitScore: clamp((identityAvg ?? 0) * 5 + 50, 0, 100),
      themeFitScore: clamp((themeAvg ?? 0) * 5 + 50, 0, 100),
      axisFitScore: clamp((axisAvg ?? 0) * 8 + 50, 0, 100),
      roleMixScore: clamp(100 - Math.max(0, targetGap - 2) * 20 - (starAndTrashRisk ? 35 : 0), 0, 100),
      overspendRisk: clamp((mostExpensiveShare ?? 0) * 100 + (starAndTrashRisk ? 30 : 0), 0, 100),
    };
    const status = teamLevel(redFlags, yellowFlags);
    const retoolParity = round(
      (parityParts.needFirstScore +
        parityParts.budgetPacingScore +
        parityParts.identityFitScore +
        parityParts.themeFitScore +
        parityParts.axisFitScore +
        parityParts.roleMixScore +
        (100 - parityParts.overspendRisk)) /
        7,
    ) ?? 0;

    let budgetBefore = cashStart;
    for (const pick of picks) {
      globalPickNo += 1;
      const price = pick.marketValue ?? null;
      const budgetAfter = budgetBefore != null && price != null ? round(budgetBefore - price) : pick.expectedCashAfter ?? null;
      const contractLength = deriveContractLength(price, pick.pickLane);
      const promisedRole = derivePromisedRole(price, contractLength, Math.max((pick.expectedRosterAfter ?? 1) - 1, 0));
      const pickRed: string[] = [];
      const pickYellow: string[] = [];
      if ((pick.scoreBreakdown.teamIdentityScore ?? 0) < 0 && (pick.scoreBreakdown.mercenaryNegativeFitPenalty ?? 0) >= 0) pickRed.push("negative_fit_non_mercenary");
      if (budgetAfter != null && budgetAfter < -0.01) pickRed.push("negative_cash_after_pick");
      if ((price ?? 0) > (cashStart ?? 0) * 0.6 && teamResult.teamCode !== "M-M") pickYellow.push("expensive_pick_over_60pct_start_cash");
      pickRows.push({
        run,
        saveId,
        pickNo: globalPickNo,
        teamId: teamResult.teamId,
        playerId: pick.playerId,
        playerName: pick.playerName,
        price,
        salary: pick.salary ?? null,
        contractLength,
        promisedRole,
        role: roleFromPickLane(pick.pickLane),
        phase: pick.pickPhase ?? null,
        focusType: pick.pickLane ?? null,
        focusKey: pick.bestNeedDisciplineId ?? pick.plannedAxisNeed ?? null,
        stepAxis: pick.plannedAxisNeed ?? pick.actualPlayerPrimaryAxis ?? null,
        topNeedBeforePick: pick.needLabel ?? null,
        solvedNeed: pick.bestNeedDisciplineId ?? pick.needLabel ?? null,
        marginalNeedGain: pick.scoreBreakdown.needMatchScore ?? null,
        axisFitPOW: pick.plannedAxisNeed === "pow" ? pick.scoreBreakdown.teamAxisFitScore : null,
        axisFitSPE: pick.plannedAxisNeed === "spe" ? pick.scoreBreakdown.teamAxisFitScore : null,
        axisFitMEN: pick.plannedAxisNeed === "men" ? pick.scoreBreakdown.teamAxisFitScore : null,
        axisFitSOC: pick.plannedAxisNeed === "soc" ? pick.scoreBreakdown.teamAxisFitScore : null,
        disciplineFitTop5: pick.scoreBreakdown.disciplineCoverageScore ?? null,
        identityFit: pick.scoreBreakdown.teamIdentityScore ?? null,
        themeFit: pick.scoreBreakdown.teamThemeFitScore ?? null,
        classFit: pick.scoreBreakdown.classFitScore ?? null,
        raceFit: pick.scoreBreakdown.raceOrArchetypeFitScore ?? null,
        subclassFit: null,
        traitFit: null,
        salaryRisk: pick.salary != null && price != null && price > 0 ? round(pick.salary / price, 3) : null,
        contractRisk: contractLength >= 4 && (pick.scoreBreakdown.teamIdentityScore ?? 0) < 3 ? 1 : 0,
        draftSeed: pick.draftSeed ?? input.draftSeed,
        baseScore: pick.baseScore != null ? round(pick.baseScore) : null,
        tieBreakJitter: pick.tieBreakJitter != null ? round(pick.tieBreakJitter) : null,
        scoreWithSeed: pick.scoreWithSeed != null ? round(pick.scoreWithSeed) : null,
        tieBreakBand: pick.tieBreakBand ?? null,
        budgetBefore,
        budgetAfter,
        futureRosterFeasibility: pick.minimumReachableAfterPick ? "minimum_reachable" : "minimum_risk",
        whyPicked: pick.reasons.join(" | "),
        whyRejectedBetterLookingCandidate: pick.rejectedCheaperAlternatives?.[0]
          ? `cheaper alternative rejected: ${pick.rejectedCheaperAlternatives[0].playerName}`
          : null,
        redFlag: pickRed.join(" | ") || null,
        yellowFlag: pickYellow.join(" | ") || null,
      });
      (pick.rejectedCheaperAlternatives ?? []).slice(0, 5).forEach((rejected, index) => {
        rejectedRows.push({
          run,
          saveId,
          teamId: teamResult.teamId,
          pickNo: globalPickNo,
          selectedPlayerId: pick.playerId,
          rejectedRank: index + 1,
          rejectedPlayerId: rejected.playerId,
          rejectedPlayerName: rejected.playerName,
          rejectedClass: rejected.className,
          rejectedPrice: rejected.price,
          rejectedScore: rejected.finalScore,
          whyRejected: pick.valueJustification?.join(" | ") || "selected candidate had better need/identity/budget context",
        });
      });
      budgetBefore = budgetAfter;
    }

    teamRows.push({
      run,
      saveId,
      teamId: teamResult.teamId,
      teamName: teamResult.teamName,
      status,
      rosterCount,
      playerMin: targets.playerMin,
      playerOpt: targets.playerOpt,
      playerMax: targets.playerMax,
      cashStart,
      cashEnd,
      totalSpend,
      avgSpend: picks.length > 0 ? round(totalSpend / picks.length) : null,
      mostExpensivePlayer: mostExpensivePick?.playerName ?? null,
      mostExpensiveShareOfStartCash: mostExpensiveShare,
      salaryTotal,
      salaryToCashRatio: cashStart && cashStart > 0 ? round(salaryTotal / cashStart, 3) : null,
      roleMix: [...roleCounts.entries()].map(([role, count]) => `${role}:${count}`).join(" | "),
      avgIdentityFit: identityAvg,
      avgThemeFit: themeAvg,
      avgNeedFit: needAvg,
      avgAxisFit: axisAvg,
      strongestAxis: picks.map((pick) => pick.actualPlayerPrimaryAxis).filter(Boolean)[0] ?? null,
      weakestAxis: teamResult.openNeeds.find((need) => ["pow", "spe", "men", "soc"].includes(need.axis))?.axis ?? null,
      openNeedsAfterDraft: targetGap > 0 ? `target_gap:${targetGap}` : "",
      reachedMin: rosterCount >= targets.playerMin,
      reachedOpt: rosterCount >= targets.playerOpt,
      underOptReason: targetGap > 0 ? (targetGap <= 2 ? "quality_or_budget_skip_allowed" : "too_many_skips") : null,
      overspendWarning: mostExpensiveShare != null && mostExpensiveShare > 0.4 ? "most_expensive_over_40pct_start_cash" : null,
      starAndTrashRisk,
      ...parityParts,
      retoolParity,
      specialQuota: specialQuota ? `${specialQuota.label}:${specialQuota.share}/${specialQuota.target}` : null,
      redFlags: redFlags.join(" | "),
      yellowFlags: yellowFlags.join(" | "),
    });

    const overspendStatus = teamLevel(
      redFlags.filter((flag) => ["under_playerMin", "negative_cash", "over_playerMax"].includes(flag)),
      [
        ...(mostExpensiveShare != null && mostExpensiveShare > 0.4 ? ["expensive_anchor"] : []),
        ...(starAndTrashRisk ? ["star_and_trash"] : []),
      ],
    );
    overspendRows.push({
      run,
      saveId,
      teamId: teamResult.teamId,
      status: overspendStatus,
      mostExpensivePlayer: mostExpensivePick?.playerName ?? null,
      mostExpensiveShareOfStartCash: mostExpensiveShare,
      expensiveOver40Pct: (mostExpensiveShare ?? 0) > 0.4,
      expensiveOver60Pct: (mostExpensiveShare ?? 0) > 0.6,
      starPickWithNeedFit: starPicks.some((pick) => (pick.scoreBreakdown.needMatchScore ?? 0) >= 4),
      starPickWithIdentityFit: starPicks.some((pick) => (pick.scoreBreakdown.teamIdentityScore ?? 0) >= 4),
      starPickWithThemeFit: starPicks.some((pick) => (pick.scoreBreakdown.teamThemeFitScore ?? 0) >= 4),
      starPickWithAvoidTag: starPicks.some((pick) => (pick.scoreBreakdown.offThemePenalty ?? 0) <= -6),
      coreAfterStarFinanceable: picks.length >= Math.min(targets.playerOpt, targets.playerMin + 2),
      starAndTrashRisk,
      cashBelow5: cashEnd != null && cashEnd < 5,
      cashOver100WithOpenNeeds: cashEnd != null && cashEnd > 100 && targetGap > 0,
      notes: [...redFlags, ...yellowFlags].join(" | "),
    });
  }

  const runStatus = combineLevel(teamRows.map((row) => row.status));
  const cashValues = teamRows.map((row) => row.cashEnd).filter((value): value is number => value != null);
  const runRecord: RunRecord = {
    run,
    saveId,
    saveName: preview.saveContext.saveName ?? saveId,
    status: runStatus,
    previewStatus: preview.status,
    previewClean: preview.qualityGate.passed && preview.blockingReasons.length === 0,
    plannedPicks: preview.globalPreview.plannedPickCount,
    appliedPicks: gameState.rosters.length,
    teamsBelowMin: teamRows.filter((row) => !row.reachedMin).length,
    teamsOverMax: teamRows.filter((row) => row.rosterCount > row.playerMax).length,
    targetGapGt2: teamRows.filter((row) => row.openNeedsAfterDraft.includes("target_gap:") && Number(row.openNeedsAfterDraft.split(":")[1]) > 2).length,
    redTeams: teamRows.filter((row) => row.status === "RED").length,
    yellowTeams: teamRows.filter((row) => row.status === "YELLOW").length,
    cashMin: cashValues.length ? round(Math.min(...cashValues)) : null,
    cashMax: cashValues.length ? round(Math.max(...cashValues)) : null,
    durationMs: input.durationMs,
    activeCandidate: runStatus !== "RED",
    draftSeed: input.draftSeed,
  };

  return { runRecord, teamRows, pickRows, rejectedRows, overspendRows };
}

function buildVariationRows(teamRows: TeamRecord[], pickRows: PickRecord[]) {
  const pickedByTeamPlayer = new Map<string, number>();
  for (const pick of pickRows) {
    const key = `${pick.teamId}:${pick.playerId}:${pick.playerName}`;
    pickedByTeamPlayer.set(key, (pickedByTeamPlayer.get(key) ?? 0) + 1);
  }
  const topRepeated = [...pickedByTeamPlayer.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 20)
    .map(([key, count]) => ({ key, count }));
  const byTeam = new Map<string, TeamRecord[]>();
  for (const row of teamRows) {
    byTeam.set(row.teamId, [...(byTeam.get(row.teamId) ?? []), row]);
  }
  const teamVariance = [...byTeam.entries()].map(([teamId, rows]) => {
    const spread = (values: number[]) => (values.length ? round(Math.max(...values) - Math.min(...values)) : null);
    return {
      teamId,
      runs: rows.length,
      rosterCountSpread: spread(rows.map((row) => row.rosterCount)),
      totalSpendSpread: spread(rows.map((row) => row.totalSpend)),
      avgSpendSpread: spread(rows.map((row) => row.avgSpend ?? 0)),
      identityFitSpread: spread(rows.map((row) => row.avgIdentityFit ?? 0)),
      redRuns: rows.filter((row) => row.status === "RED").length,
      yellowRuns: rows.filter((row) => row.status === "YELLOW").length,
    };
  });
  return { topRepeated, teamVariance };
}

function buildSummary(input: {
  runRows: RunRecord[];
  teamRows: TeamRecord[];
  pickRows: PickRecord[];
}) {
  const overall = combineLevel(input.runRows.map((row) => row.status));
  const avgDurationMs = input.runRows.length
    ? input.runRows.reduce((sum, row) => sum + row.durationMs, 0) / input.runRows.length
    : 0;
  const longestRun = [...input.runRows].sort((left, right) => right.durationMs - left.durationMs)[0] ?? null;
  const stableGoodTeams = [...new Set(input.teamRows.filter((row) => row.status === "GREEN").map((row) => row.teamId))]
    .filter((teamId) => input.teamRows.filter((row) => row.teamId === teamId && row.status === "GREEN").length >= Math.ceil(input.runRows.length * 0.8));
  const problemTeams = [...new Set(input.teamRows.filter((row) => row.status === "RED").map((row) => row.teamId))];
  const yellowTeams = [...new Set(input.teamRows.filter((row) => row.status === "YELLOW").map((row) => row.teamId))];
  const overspendTeams = [...new Set(input.teamRows.filter((row) => (row.mostExpensiveShareOfStartCash ?? 0) > 0.55).map((row) => row.teamId))];
  const lowIdentityTeams = [...new Set(input.teamRows.filter((row) => (row.avgIdentityFit ?? 0) < 2).map((row) => row.teamId))];
  const variation = buildVariationRows(input.teamRows, input.pickRows);
  const topRepeatedPlayers = variation.topRepeated.map((row) => `- ${row.key}: ${row.count}x`).join("\n") || "- keine";
  const highVarianceTeams = variation.teamVariance
    .sort((left, right) => (right.totalSpendSpread ?? 0) - (left.totalSpendSpread ?? 0))
    .slice(0, 20)
    .map((row) => `- ${row.teamId}: spendSpread ${row.totalSpendSpread}, rosterSpread ${row.rosterCountSpread}, red ${row.redRuns}`)
    .join("\n");
  const yellowBreakdown =
    input.teamRows
      .filter((row) => row.status === "YELLOW")
      .slice(0, 40)
      .map(
        (row) =>
          `- Run ${row.run} ${row.teamId}: ${row.yellowFlags || "yellow"} · roster ${row.rosterCount}/${row.playerOpt} · cash ${row.cashEnd}`,
      )
      .join("\n") || "- keine";
  const runTable =
    input.runRows
      .map(
        (row) =>
          `- Run ${row.run}: ${row.status}, picks ${row.appliedPicks || row.plannedPicks}, RED ${row.redTeams}, YELLOW ${row.yellowTeams}, ${Math.round(row.durationMs / 1000)}s`,
      )
      .join("\n") || "- keine";

  return `# Fresh Pick Audit 10x Summary

- Overall: ${overall}
- Runs: ${input.runRows.length}
- Avg duration: ${Math.round(avgDurationMs / 1000)}s
- Longest run: ${longestRun ? `Run ${longestRun.run} · ${Math.round(longestRun.durationMs / 1000)}s` : "n/a"}
- Planned picks total: ${input.runRows.reduce((sum, row) => sum + row.plannedPicks, 0)}
- Applied picks total: ${input.runRows.reduce((sum, row) => sum + row.appliedPicks, 0)}
- RED teams total rows: ${input.teamRows.filter((row) => row.status === "RED").length}
- YELLOW teams total rows: ${input.teamRows.filter((row) => row.status === "YELLOW").length}
- Stable good teams: ${stableGoodTeams.join(", ") || "none"}
- Regular problem teams: ${problemTeams.join(", ") || "none"}
- Yellow watch teams: ${yellowTeams.join(", ") || "none"}
- Overspend tendency teams: ${overspendTeams.join(", ") || "none"}
- Low identity teams: ${lowIdentityTeams.join(", ") || "none"}

## Run Performance

${runTable}

## Yellow Watch Rows

${yellowBreakdown}

## Top 20 repeated team/player pairs

${topRepeatedPlayers}

## Top 20 variance teams

${highVarianceTeams || "- keine"}

## Decision

${overall === "RED" ? "No season simulation. Fix recurring RED teams first, then run a new 10x series." : "Fresh pick engine is playable for the next step. Keep the best non-RED save active."}
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();
  const previousActive = persistence.getActiveSave();
  const runRows: RunRecord[] = [];
  const teamRows: TeamRecord[] = [];
  const pickRows: PickRecord[] = [];
  const rejectedRows: RejectedRecord[] = [];
  const overspendRows: OverspendRecord[] = [];
  let bestSaveId: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  await mkdir(OUTPUT_DIR, { recursive: true });

  for (let run = 1; run <= args.runs; run += 1) {
    const started = Date.now();
    const draftSeed = `fresh-pick-audit-10x:run-${run}`;
    // Pro Lauf andere GMs zuweisen (fit-nah aus dem Top-Band), damit Audits zeigen,
    // wie sich Picks unter Star-Picker- vs. Depth-Spammer-GMs verschieben.
    setGmAssignmentSeedSalt(`gm-run-${run}`);
    const save = persistence.createFreshSeasonOneSave({
      saveId: `fresh-pick-audit-run-${run}-${Date.now()}`,
      name: `fresh-pick-audit-run-${run}-${new Date().toISOString()}`,
    });
    setGmAssignmentSeedSalt(null);
    const preview = await runAiPicksExecutePreview({
      source: "sqlite",
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      dryRun: true,
      confirmToken: AI_PICKS_RUN_CONFIRM_TOKEN,
      teamScope: "all",
      allowSetupAllTeams: true,
      stepsPerTeam: args.stepsPerTeam,
      runMode: "season1_optimum_execute",
      draftSeed,
    });

    let finalSave = persistence.getSaveById(save.saveId) ?? save;
    if (args.apply && preview.qualityGate.passed && preview.blockingReasons.length === 0) {
      const appliedState = applyPreviewToSave(finalSave, preview);
      finalSave = persistence.saveSingleplayerState(finalSave.saveId, appliedState);
    }
    const records = buildRecordsForRun({
      run,
      saveId: save.saveId,
      preview,
      gameState: finalSave.gameState,
      durationMs: Date.now() - started,
      draftSeed,
    });
    runRows.push(records.runRecord);
    teamRows.push(...records.teamRows);
    pickRows.push(...records.pickRows);
    rejectedRows.push(...records.rejectedRows);
    overspendRows.push(...records.overspendRows);

    const candidateScore = records.teamRows.reduce((sum, row) => sum + row.retoolParity, 0) / Math.max(records.teamRows.length, 1)
      - records.runRecord.redTeams * 50
      - records.runRecord.yellowTeams * 6
      - records.runRecord.targetGapGt2 * 10;
    if (args.apply && records.runRecord.status !== "RED" && candidateScore > bestScore) {
      bestScore = candidateScore;
      bestSaveId = save.saveId;
    }

    await writeFile(path.join(OUTPUT_DIR, "fresh-pick-audit-10x-runs.csv"), toCsv(runRows as unknown as Array<Record<string, unknown>>), "utf8");
    await writeFile(path.join(OUTPUT_DIR, "fresh-pick-audit-10x-team.csv"), toCsv(teamRows as unknown as Array<Record<string, unknown>>), "utf8");
    await writeFile(path.join(OUTPUT_DIR, "fresh-pick-audit-10x-picks.csv"), toCsv(pickRows as unknown as Array<Record<string, unknown>>), "utf8");
    await writeFile(path.join(OUTPUT_DIR, "fresh-pick-audit-10x-rejected-candidates.csv"), toCsv(rejectedRows as unknown as Array<Record<string, unknown>>), "utf8");
    await writeFile(path.join(OUTPUT_DIR, "fresh-pick-audit-10x-overspend.csv"), toCsv(overspendRows as unknown as Array<Record<string, unknown>>), "utf8");
    await writeFile(path.join(OUTPUT_DIR, "fresh-pick-audit-10x-summary.md"), buildSummary({ runRows, teamRows, pickRows }), "utf8");
    console.log(JSON.stringify(records.runRecord));
  }

  if (bestSaveId) {
    persistence.activateSave(bestSaveId);
  } else if (previousActive) {
    persistence.activateSave(previousActive.saveId);
  }

  const active = persistence.getActiveSave();
  console.log(JSON.stringify({
    outputDir: OUTPUT_DIR,
    overall: combineLevel(runRows.map((row) => row.status)),
    runs: runRows.length,
    bestSaveId,
    activeSaveId: active?.saveId ?? null,
    activeRosters: active?.gameState.rosters.length ?? null,
  }, null, 2));
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
