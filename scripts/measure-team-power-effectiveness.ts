/**
 * Standalone, READ-ONLY measurement harness for the "Team Powers" system.
 *
 * Answers three questions about team powers over one or more simulated seasons:
 *   (1) Does the AI actually deploy them?           -> adoption / usage-rate metrics
 *   (2) WHEN across a season are they deployed?     -> early/mid/late timing histogram
 *   (3) Are they too strong, or do they keep teams  -> strength ceilings + an
 *       balanced ("halten sich die Waage")?             equalization correlation.
 *
 * The user's ideal: team powers that make teams roughly EQUALLY strong, i.e. that
 * help weak teams close the gap rather than amplify the lead of strong teams.
 *
 * This script drives the existing sim exactly like scripts/smoke-season-block-1.ts and
 * only READS engine output (drafts + resolve previews). It edits NO engine source.
 *
 * Usage:
 *   node --import tsx scripts/measure-team-power-effectiveness.ts [--seasons N] [--outDir path]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";
import { loadLocalLegacyLineupContext } from "@/lib/lineups/legacy-lineup-local-service";
import { loadSqliteLegacyMatchdayResolvePreview } from "@/lib/foundation/legacy-matchday-resolve-preview-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  runLocalMatchdayAutoRun,
  MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
} from "@/lib/season/matchday-auto-run-service";
import { ADVANCE_MATCHDAY_CONFIRM_TOKEN, executeMatchdayAdvance } from "@/lib/season/matchday-progress-service";
import {
  runLocalSeasonCompletion,
  SEASON_COMPLETION_CONFIRM_TOKEN,
} from "@/lib/season/season-completion-service";
import {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} from "@/lib/season/preseason-workflow-service";
import type { TeamPowerEffectType } from "@/lib/data/olyDataTypes";

// ---------------------------------------------------------------------------
// arg parsing
// ---------------------------------------------------------------------------
function argValue(name: string): string | null {
  const prefix = `${name}=`;
  const inline = process.argv.find((entry) => entry.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1] ?? null;
  return null;
}

const REQUESTED_SEASONS = Math.max(1, Number(argValue("--seasons") ?? "1") || 1);
const OUT_DIR_OVERRIDE = argValue("--outDir");

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------
function requireValue<T>(value: T | null | undefined, message: string): T {
  if (value == null) throw new Error(message);
  return value;
}

function logProgress(message: string) {
  console.error(`[team-power-measure] ${message}`);
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values: number[]): number {
  const usable = values.filter((v) => Number.isFinite(v));
  if (usable.length === 0) return 0;
  return usable.reduce((sum, v) => sum + v, 0) / usable.length;
}

function stdev(values: number[]): number {
  const usable = values.filter((v) => Number.isFinite(v));
  if (usable.length < 2) return 0;
  const m = mean(usable);
  const variance = usable.reduce((sum, v) => sum + (v - m) ** 2, 0) / usable.length;
  return Math.sqrt(variance);
}

/** Pearson correlation between two equal-length numeric series. */
function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  if (dx2 === 0 || dy2 === 0) return null;
  return num / Math.sqrt(dx2 * dy2);
}

// ---------------------------------------------------------------------------
// roster setup (copied verbatim from scripts/smoke-season-block-1.ts)
// ---------------------------------------------------------------------------
function resolveMaxRequiredSeasonRosterSize(saveId: string, seasonId: string) {
  const persistence = createPersistenceService();
  const save = requireValue(persistence.getSaveById(saveId), `Save ${saveId} missing.`);
  let maxRequiredUniquePlayers = 0;

  for (const matchdayId of save.gameState.season.matchdayIds) {
    const contextResult = loadLocalLegacyLineupContext({
      saveId,
      seasonId,
      matchdayId,
      teamId: save.gameState.teams[0]!.teamId,
    });
    if (!contextResult.ok) {
      throw new Error(`Lineup context failed for ${matchdayId}: ${contextResult.errors.join(" | ")}`);
    }
    maxRequiredUniquePlayers = Math.max(
      maxRequiredUniquePlayers,
      (contextResult.context.matchdayContract?.discipline1?.requiredPlayers ?? 0) +
        (contextResult.context.matchdayContract?.discipline2?.requiredPlayers ?? 0),
    );
  }

  return maxRequiredUniquePlayers;
}

function topUpRostersForLineups(saveId: string, seasonId: string) {
  const persistence = createPersistenceService();
  const save = requireValue(persistence.getSaveById(saveId), `Save ${saveId} missing.`);
  const requiredUniquePlayers = resolveMaxRequiredSeasonRosterSize(saveId, seasonId);
  const usedPlayerIds = new Set(save.gameState.rosters.map((entry) => entry.playerId));
  const freePlayers = save.gameState.players.filter((player) => !usedPlayerIds.has(player.id));
  let poolIndex = 0;
  let rosterCounter = save.gameState.rosters.length;
  let changed = false;

  for (const team of save.gameState.teams) {
    const teamRoster = save.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const shortfall = Math.max(0, requiredUniquePlayers - teamRoster.length);
    for (let index = 0; index < shortfall; index += 1) {
      const player = freePlayers[poolIndex];
      if (!player) throw new Error("Not enough free players to top up rosters for the measurement run.");
      const economy = resolvePlayerEconomyContract({ player });
      const salary = economy.salary ?? player.displaySalary ?? player.salaryDemand;
      const marketValue = economy.purchasePrice ?? economy.marketValue ?? player.displayMarketValue ?? player.marketValue;
      poolIndex += 1;
      save.gameState.rosters.push({
        id: `measure-tp-roster-${rosterCounter}`,
        teamId: team.teamId,
        playerId: player.id,
        contractLength: 3,
        salary: Math.round(salary),
        upkeep: Math.round(salary),
        purchasePrice: Math.round(marketValue),
        currentValue: Math.round(marketValue),
        roleTag: "bench",
        joinedSeasonId: seasonId,
      });
      rosterCounter += 1;
      changed = true;
    }
  }

  if (changed) persistence.saveSingleplayerState(save.saveId, save.gameState);
}

function setAllTeamsToAi(saveId: string) {
  const persistence = createPersistenceService();
  const save = requireValue(persistence.getSaveById(saveId), "Save missing for AI control setup.");
  save.gameState.seasonState.teamControlSettings = Object.fromEntries(
    save.gameState.teams.map((team) => [
      team.teamId,
      {
        teamId: team.teamId,
        controlMode: "ai" as const,
        aiLineupPreviewEnabled: true,
        aiLineupApplyEnabled: true,
        aiLineupAutoApplyEnabled: false,
        aiTransferPreviewEnabled: false,
        aiTransferAutoApplyEnabled: false,
        aiSellPreviewEnabled: false,
        aiSellAutoApplyEnabled: false,
        notes: null,
        strategyLock: null,
      },
    ]),
  );
  persistence.saveSingleplayerState(saveId, save.gameState);
}

// ---------------------------------------------------------------------------
// data model for captured measurements
// ---------------------------------------------------------------------------
const DEBUFF_EFFECTS: ReadonlySet<TeamPowerEffectType> = new Set([
  "snipe_debuff",
  "field_debuff",
  "rivalry_debuff",
]);

type SideSample = {
  seasonId: string;
  matchdayIndex: number; // 0-based within season
  matchdaysInSeason: number;
  teamId: string;
  teamName: string;
  side: "d1" | "d2";
  baseScore: number;
  score: number;
  deployed: boolean;
  deployedPowerId: string | null;
  effectType: TeamPowerEffectType | null;
  teamPowerImpactPct: number; // % of the selected active power (0 if none)
  teamPowerModifier: number; // absolute score delta (selected self-boost + passive folded in)
  debuffReceivedPoints: number; // points removed from THIS side by others' debuffs
};

type SeasonStanding = {
  seasonId: string;
  teamId: string;
  teamName: string;
  points: number;
  rank: number | null;
};

type TeamPowerMeta = {
  teamId: string;
  seasonId: string;
  activeSelectedCount: number; // non-passive, selectedForSeason
  activeChargesTotal: number; // sum of chargesTotal over selected non-passive powers
  passiveCount: number;
  passiveModifierMax: number; // max isPassive modifier (design ceiling 3)
};

/** Parse the point magnitude out of a `team_power_debuff:...  -<num> (<pct>%)` warning. */
function parseDebuffPoints(warning: string): number {
  // format: `team_power_debuff:${sourceName}: ${label} -${perTargetImpact} (${impactPct}%)`
  const match = warning.match(/-(\d+(?:\.\d+)?)\s*\(/);
  if (!match) return 0;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : 0;
}

// ---------------------------------------------------------------------------
// capture one matchday's deployments + realized impact (read-only)
// ---------------------------------------------------------------------------
function captureMatchday(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  matchdayIndex: number;
  matchdaysInSeason: number;
}): SideSample[] {
  const { saveId, seasonId, matchdayId, matchdayIndex, matchdaysInSeason } = input;
  const persistence = createPersistenceService();
  const save = requireValue(persistence.getSaveById(saveId), "Save missing during matchday capture.");

  // (A) Deployments: which sides have a teamPowerId set on the draft for this matchday.
  const drafts = (save.gameState.seasonState.lineupDrafts ?? []).filter(
    (draft) => draft.seasonId === seasonId && draft.matchdayId === matchdayId,
  );
  const deployedPowerBySide = new Map<string, string>(); // key: `${teamId}::${side}` -> powerId
  for (const draft of drafts) {
    const d1 = draft.modifiers?.d1?.teamPowerId;
    const d2 = draft.modifiers?.d2?.teamPowerId;
    if (d1) deployedPowerBySide.set(`${draft.teamId}::d1`, d1);
    if (d2) deployedPowerBySide.set(`${draft.teamId}::d2`, d2);
  }

  // Map every team-power id -> effectType (needed to classify boosts vs debuffs).
  const powerEffectById = new Map<string, TeamPowerEffectType>();
  for (const power of save.gameState.seasonState.teamPowers ?? []) {
    if (power.seasonId === seasonId) powerEffectById.set(power.id, power.effectType);
  }

  // (B) Realized impact: re-run the resolve preview read-only over the just-applied lineups.
  const payload = loadSqliteLegacyMatchdayResolvePreview({ saveId, seasonId, matchdayId });
  if (!payload) return [];

  const samples: SideSample[] = [];
  for (const discipline of payload.preview.disciplinePreviews) {
    for (const team of discipline.teamResults) {
      const key = `${team.teamId}::${team.disciplineSide}`;
      const deployedPowerId = deployedPowerBySide.get(key) ?? null;
      const effectType =
        (team.teamPowerEffectType ?? null) ??
        (deployedPowerId ? powerEffectById.get(deployedPowerId) ?? null : null);
      const debuffReceivedPoints = (team.warnings ?? [])
        .filter((w) => w.startsWith("team_power_debuff:"))
        .reduce((sum, w) => sum + parseDebuffPoints(w), 0);

      samples.push({
        seasonId,
        matchdayIndex,
        matchdaysInSeason,
        teamId: team.teamId,
        teamName: team.teamName,
        side: team.disciplineSide,
        baseScore: team.baseScore ?? 0,
        score: team.score ?? 0,
        deployed: Boolean(deployedPowerId),
        deployedPowerId,
        effectType,
        teamPowerImpactPct: team.teamPowerImpact ?? 0,
        teamPowerModifier: team.teamPowerModifier ?? 0,
        debuffReceivedPoints,
      });
    }
  }
  return samples;
}

function captureTeamPowerMeta(saveId: string, seasonId: string): TeamPowerMeta[] {
  const persistence = createPersistenceService();
  const save = requireValue(persistence.getSaveById(saveId), "Save missing for team-power meta capture.");
  const byTeam = new Map<string, TeamPowerMeta>();
  for (const team of save.gameState.teams) {
    byTeam.set(team.teamId, {
      teamId: team.teamId,
      seasonId,
      activeSelectedCount: 0,
      activeChargesTotal: 0,
      passiveCount: 0,
      passiveModifierMax: 0,
    });
  }
  for (const power of save.gameState.seasonState.teamPowers ?? []) {
    if (power.seasonId !== seasonId) continue;
    const meta = byTeam.get(power.teamId);
    if (!meta) continue;
    if (power.isPassive) {
      meta.passiveCount += 1;
      meta.passiveModifierMax = Math.max(meta.passiveModifierMax, power.modifier ?? 0);
    } else if (power.selectedForSeason) {
      meta.activeSelectedCount += 1;
      meta.activeChargesTotal += power.chargesTotal ?? 0;
    }
  }
  return [...byTeam.values()];
}

function captureStandings(saveId: string, seasonId: string): SeasonStanding[] {
  const persistence = createPersistenceService();
  const save = requireValue(persistence.getSaveById(saveId), "Save missing for standings capture.");
  const nameByTeamId = new Map(save.gameState.teams.map((t) => [t.teamId, t.name] as const));
  const standings = save.gameState.seasonState.standings ?? {};
  const rows: SeasonStanding[] = [];
  for (const [teamId, record] of Object.entries(standings)) {
    rows.push({
      seasonId,
      teamId,
      teamName: nameByTeamId.get(teamId) ?? teamId,
      points: record.points ?? 0,
      rank: record.rank ?? null,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// drive a single season's matchdays and capture everything
// ---------------------------------------------------------------------------
async function runSeasonMatchdays(input: {
  saveId: string;
  seasonId: string;
  persistence: ReturnType<typeof createPersistenceService>;
}): Promise<{ samples: SideSample[]; powerMeta: TeamPowerMeta[]; standings: SeasonStanding[] }> {
  const { saveId, seasonId, persistence } = input;
  const setupSave = requireValue(persistence.getSaveById(saveId), "Save missing before season matchdays.");
  const matchdaysInSeason = setupSave.gameState.season.matchdayIds.length;
  const samples: SideSample[] = [];

  for (let index = 0; index < matchdaysInSeason; index += 1) {
    const currentSave = requireValue(persistence.getSaveById(saveId), "Save missing during matchday loop.");
    const matchdayId = currentSave.gameState.matchdayState.matchdayId;
    logProgress(`Season ${seasonId} — Spieltag ${index + 1}/${matchdaysInSeason} (${matchdayId}) startet.`);

    const autoRun = await runLocalMatchdayAutoRun(
      {
        saveId,
        seasonId,
        matchdayId,
        source: "sqlite",
        execute: true,
        dryRun: false,
        confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
        options: {
          includeWarningLineups: true,
          overwriteExistingLineups: true,
          stopOnTie: false,
          advanceAfterCashApply: false,
        },
      },
      persistence,
    );
    if (!autoRun.ok) {
      throw new Error(`Matchday ${matchdayId} blocked: ${autoRun.blockingReasons.join(" | ")}`);
    }

    // Capture deployments + realized impact BEFORE advancing (drafts freshly applied).
    const matchdaySamples = captureMatchday({
      saveId,
      seasonId,
      matchdayId,
      matchdayIndex: index,
      matchdaysInSeason,
    });
    samples.push(...matchdaySamples);

    const advance = await executeMatchdayAdvance(
      {
        saveId,
        seasonId,
        source: "sqlite",
        execute: true,
        confirm: ADVANCE_MATCHDAY_CONFIRM_TOKEN,
      },
      persistence,
    );
    if (!advance.ok || !advance.applied) {
      throw new Error(`Advance after ${matchdayId} blocked: ${advance.blockingReasons.join(" | ")}`);
    }
  }

  // Standings + power meta are captured after all matchdays, before any season completion reset.
  const powerMeta = captureTeamPowerMeta(saveId, seasonId);
  const standings = captureStandings(saveId, seasonId);
  return { samples, powerMeta, standings };
}

// ---------------------------------------------------------------------------
// aggregation
// ---------------------------------------------------------------------------
type TeamAggregate = {
  teamId: string;
  teamName: string;
  // charges
  activeChargesTotal: number;
  activeSelectedCount: number;
  passiveCount: number;
  passiveModifierMax: number;
  deployments: number; // sides on which an active power was deployed
  usageRatePct: number | null;
  // timing (season-thirds, deployment counts)
  timingEarly: number;
  timingMid: number;
  timingLate: number;
  deploymentMatchdayIndices: number[];
  // realized active impact (only on deployed sides)
  avgActiveImpactPct: number;
  maxActiveImpactPct: number;
  // debuff
  intendedDebuffImpactPct: number; // sum of impact% on this team's deployed debuff sides
  debuffPointsDealtEstimate: number; // sum of points removed from opponents (attributed via warnings)
  debuffPointsReceived: number;
  // balance inputs
  baselineStrength: number; // avg baseScore across all its sides/matchdays (pre-power)
  powerNetAdvantagePct: number; // avg over sides of (teamPowerModifier% of base − debuff% received)
  // standings (across seasons)
  totalPoints: number;
  finalRankLast: number | null;
};

function seasonThird(matchdayIndex: number, matchdaysInSeason: number): "early" | "mid" | "late" {
  if (matchdaysInSeason <= 0) return "early";
  const frac = matchdayIndex / matchdaysInSeason;
  if (frac < 1 / 3) return "early";
  if (frac < 2 / 3) return "mid";
  return "late";
}

function aggregate(input: {
  samples: SideSample[];
  powerMeta: TeamPowerMeta[];
  standings: SeasonStanding[];
}) {
  const { samples, powerMeta, standings } = input;
  const teamIds = new Set(samples.map((s) => s.teamId));

  // Roll up per-season power meta into per-team totals (charges available across seasons).
  const chargesByTeam = new Map<string, { charges: number; selected: number; passive: number; passiveMax: number }>();
  for (const meta of powerMeta) {
    const current = chargesByTeam.get(meta.teamId) ?? { charges: 0, selected: 0, passive: 0, passiveMax: 0 };
    current.charges += meta.activeChargesTotal;
    current.selected += meta.activeSelectedCount;
    current.passive += meta.passiveCount;
    current.passiveMax = Math.max(current.passiveMax, meta.passiveModifierMax);
    chargesByTeam.set(meta.teamId, current);
  }

  const aggregates: TeamAggregate[] = [];
  for (const teamId of teamIds) {
    const teamSamples = samples.filter((s) => s.teamId === teamId);
    const teamName = teamSamples[0]?.teamName ?? teamId;
    const deployedSamples = teamSamples.filter((s) => s.deployed);
    const charges = chargesByTeam.get(teamId) ?? { charges: 0, selected: 0, passive: 0, passiveMax: 0 };

    // timing
    let early = 0;
    let mid = 0;
    let late = 0;
    const indices: number[] = [];
    for (const s of deployedSamples) {
      indices.push(s.matchdayIndex);
      const bucket = seasonThird(s.matchdayIndex, s.matchdaysInSeason);
      if (bucket === "early") early += 1;
      else if (bucket === "mid") mid += 1;
      else late += 1;
    }

    // active impact (boosts + any deployed power's reported impact%)
    const activeImpacts = deployedSamples.map((s) => s.teamPowerImpactPct).filter((v) => v > 0);
    const avgActiveImpactPct = activeImpacts.length ? mean(activeImpacts) : 0;
    const maxActiveImpactPct = activeImpacts.length ? Math.max(...activeImpacts) : 0;

    // debuff intended (impact% on this team's deployed debuff sides)
    const intendedDebuffImpactPct = deployedSamples
      .filter((s) => s.effectType && DEBUFF_EFFECTS.has(s.effectType))
      .reduce((sum, s) => sum + s.teamPowerImpactPct, 0);

    // debuff received by this team
    const debuffPointsReceived = round(teamSamples.reduce((sum, s) => sum + s.debuffReceivedPoints, 0));

    // balance inputs — per-side net advantage as % of base
    const netAdvantages: number[] = [];
    const baselines: number[] = [];
    for (const s of teamSamples) {
      if (s.baseScore <= 0) continue;
      baselines.push(s.baseScore);
      const ownGainPct = (s.teamPowerModifier / s.baseScore) * 100; // includes passive + self-boost
      const debuffPct = (s.debuffReceivedPoints / s.baseScore) * 100;
      netAdvantages.push(ownGainPct - debuffPct);
    }

    aggregates.push({
      teamId,
      teamName,
      activeChargesTotal: charges.charges,
      activeSelectedCount: charges.selected,
      passiveCount: charges.passive,
      passiveModifierMax: charges.passiveMax,
      deployments: deployedSamples.length,
      usageRatePct: charges.charges > 0 ? round((deployedSamples.length / charges.charges) * 100) : null,
      timingEarly: early,
      timingMid: mid,
      timingLate: late,
      deploymentMatchdayIndices: indices.sort((a, b) => a - b),
      avgActiveImpactPct: round(avgActiveImpactPct),
      maxActiveImpactPct: round(maxActiveImpactPct),
      intendedDebuffImpactPct: round(intendedDebuffImpactPct),
      debuffPointsDealtEstimate: 0, // filled in below
      debuffPointsReceived,
      baselineStrength: round(mean(baselines)),
      powerNetAdvantagePct: round(mean(netAdvantages)),
      totalPoints: 0, // filled below
      finalRankLast: null,
    });
  }

  // debuff points DEALT: SideSample stores only the numeric debuffReceivedPoints (not the
  // source team name), so total debuff DEALT across the league equals total debuff RECEIVED.
  // We distribute that "dealt" credit across teams by each team's share of intended-debuff
  // deployment % (a team that never deploys a debuff power dealt none).
  const totalReceived = samples.reduce((sum, s) => sum + s.debuffReceivedPoints, 0);
  const totalIntended = aggregates.reduce((sum, a) => sum + a.intendedDebuffImpactPct, 0);
  for (const a of aggregates) {
    if (totalIntended > 0) {
      a.debuffPointsDealtEstimate = round((a.intendedDebuffImpactPct / totalIntended) * totalReceived);
    }
  }

  // standings roll-up
  const pointsByTeam = new Map<string, number>();
  const lastRankByTeam = new Map<string, number | null>();
  const lastSeasonId = standings.length ? standings[standings.length - 1]!.seasonId : null;
  for (const st of standings) {
    pointsByTeam.set(st.teamId, (pointsByTeam.get(st.teamId) ?? 0) + st.points);
    if (st.seasonId === lastSeasonId) lastRankByTeam.set(st.teamId, st.rank);
  }
  for (const a of aggregates) {
    a.totalPoints = pointsByTeam.get(a.teamId) ?? 0;
    a.finalRankLast = lastRankByTeam.get(a.teamId) ?? null;
  }

  return aggregates.sort((x, y) => y.totalPoints - x.totalPoints);
}

// ---------------------------------------------------------------------------
// reporting
// ---------------------------------------------------------------------------
const DESIGN_ACTIVE_IMPACT_CEILING = 13; // %
const PASSIVE_CEILING = 3; // %

function buildLeagueVerdict(aggregates: TeamAggregate[], samples: SideSample[]) {
  const totalDeployments = aggregates.reduce((sum, a) => sum + a.deployments, 0);
  const teamsNeverDeployed = aggregates.filter((a) => a.deployments === 0);
  const totalChargesAvailable = aggregates.reduce((sum, a) => sum + a.activeChargesTotal, 0);
  const leagueChargeSpendPct = totalChargesAvailable > 0 ? round((totalDeployments / totalChargesAvailable) * 100) : null;

  // timing histogram
  let early = 0;
  let mid = 0;
  let late = 0;
  for (const a of aggregates) {
    early += a.timingEarly;
    mid += a.timingMid;
    late += a.timingLate;
  }

  // strength ceilings
  const maxActiveImpactPct = samples.reduce((mx, s) => (s.deployed ? Math.max(mx, s.teamPowerImpactPct) : mx), 0);
  const maxPassivePct = aggregates.reduce((mx, a) => Math.max(mx, a.passiveModifierMax), 0);
  const activeCeilingBreached = maxActiveImpactPct > DESIGN_ACTIVE_IMPACT_CEILING + 1e-9;
  const passiveCeilingBreached = maxPassivePct > PASSIVE_CEILING + 1e-9;

  // equalization correlation
  const teamsWithBaseline = aggregates.filter((a) => Number.isFinite(a.baselineStrength) && a.baselineStrength > 0);
  const correlation = pearson(
    teamsWithBaseline.map((a) => a.baselineStrength),
    teamsWithBaseline.map((a) => a.powerNetAdvantagePct),
  );
  let verdict: "AMPLIFY" | "NEUTRAL" | "EQUALIZE" | "INDETERMINATE" = "INDETERMINATE";
  if (correlation != null) {
    if (correlation > 0.2) verdict = "AMPLIFY";
    else if (correlation < -0.2) verdict = "EQUALIZE";
    else verdict = "NEUTRAL";
  }

  // points dispersion (final totals across teams)
  const points = aggregates.map((a) => a.totalPoints);
  const pointsStdev = round(stdev(points));
  const pointsSpread = points.length ? round(Math.max(...points) - Math.min(...points)) : 0;

  return {
    totalDeployments,
    teamsNeverDeployed: teamsNeverDeployed.map((a) => a.teamName),
    teamsNeverDeployedCount: teamsNeverDeployed.length,
    totalChargesAvailable,
    leagueChargeSpendPct,
    timing: { early, mid, late },
    maxActiveImpactPct: round(maxActiveImpactPct),
    maxPassivePct: round(maxPassivePct),
    activeCeilingBreached,
    passiveCeilingBreached,
    correlation: correlation == null ? null : round(correlation, 3),
    verdict,
    pointsStdev,
    pointsSpread,
  };
}

function writeReport(outDir: string, data: {
  meta: Record<string, unknown>;
  aggregates: TeamAggregate[];
  verdict: ReturnType<typeof buildLeagueVerdict>;
}) {
  mkdirSync(outDir, { recursive: true });

  // data.json
  writeFileSync(path.join(outDir, "data.json"), JSON.stringify(data, null, 2));

  // per-team.csv
  const csvHeader = [
    "teamId",
    "teamName",
    "activeChargesTotal",
    "activeSelectedCount",
    "passiveCount",
    "passiveModifierMax",
    "deployments",
    "usageRatePct",
    "timingEarly",
    "timingMid",
    "timingLate",
    "avgActiveImpactPct",
    "maxActiveImpactPct",
    "intendedDebuffImpactPct",
    "debuffPointsDealtEstimate",
    "debuffPointsReceived",
    "baselineStrength",
    "powerNetAdvantagePct",
    "totalPoints",
    "finalRankLast",
  ].join(",");
  const csvRows = data.aggregates.map((a) =>
    [
      a.teamId,
      JSON.stringify(a.teamName),
      a.activeChargesTotal,
      a.activeSelectedCount,
      a.passiveCount,
      a.passiveModifierMax,
      a.deployments,
      a.usageRatePct ?? "",
      a.timingEarly,
      a.timingMid,
      a.timingLate,
      a.avgActiveImpactPct,
      a.maxActiveImpactPct,
      a.intendedDebuffImpactPct,
      a.debuffPointsDealtEstimate,
      a.debuffPointsReceived,
      a.baselineStrength,
      a.powerNetAdvantagePct,
      a.totalPoints,
      a.finalRankLast ?? "",
    ].join(","),
  );
  writeFileSync(path.join(outDir, "per-team.csv"), [csvHeader, ...csvRows].join("\n") + "\n");

  // report.md
  const v = data.verdict;
  const verdictExplain: Record<string, string> = {
    AMPLIFY: "Team powers AMPLIFY the gap — strong teams gain more (BAD for the user's equal-strength goal).",
    NEUTRAL: "Team powers are roughly NEUTRAL — gain is uncorrelated with baseline strength.",
    EQUALIZE: "Team powers EQUALIZE — weak teams gain more, closing the gap (GOOD for the user's goal).",
    INDETERMINATE: "Not enough data to judge the balance correlation.",
  };
  const lines: string[] = [];
  lines.push("# Team Power Effectiveness Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Run parameters");
  lines.push("");
  for (const [k, val] of Object.entries(data.meta)) lines.push(`- **${k}**: ${String(val)}`);
  lines.push("");
  lines.push("## (1) Adoption — does the AI deploy team powers?");
  lines.push("");
  lines.push(`- Total active deployments (charge-based, per discipline side): **${v.totalDeployments}**`);
  lines.push(`- League charges available: **${v.totalChargesAvailable}** → spent **${v.leagueChargeSpendPct ?? "n/a"}%**`);
  lines.push(`- Teams that NEVER deployed an active power: **${v.teamsNeverDeployedCount}**${v.teamsNeverDeployed.length ? ` (${v.teamsNeverDeployed.join(", ")})` : ""}`);
  lines.push("");
  lines.push("## (2) Timing — WHEN across the season");
  lines.push("");
  const timingTotal = v.timing.early + v.timing.mid + v.timing.late || 1;
  lines.push(`- Early third: **${v.timing.early}** (${round((v.timing.early / timingTotal) * 100)}%)`);
  lines.push(`- Mid third:   **${v.timing.mid}** (${round((v.timing.mid / timingTotal) * 100)}%)`);
  lines.push(`- Late third:  **${v.timing.late}** (${round((v.timing.late / timingTotal) * 100)}%)`);
  lines.push("");
  lines.push("## (3) Strength — too strong, or in balance?");
  lines.push("");
  lines.push(`- Max realized ACTIVE impact: **${v.maxActiveImpactPct}%** (design ceiling ~${DESIGN_ACTIVE_IMPACT_CEILING}%) ${v.activeCeilingBreached ? "⚠️ CEILING BREACHED" : "OK"}`);
  lines.push(`- Max PASSIVE bonus: **${v.maxPassivePct}%** (ceiling ${PASSIVE_CEILING}%) ${v.passiveCeilingBreached ? "⚠️ CEILING BREACHED" : "OK"}`);
  lines.push("");
  lines.push("### Equalization (the balance answer)");
  lines.push("");
  lines.push(`- Pearson correlation(baseline strength, power net advantage): **${v.correlation ?? "n/a"}**`);
  lines.push(`- Verdict: **${v.verdict}** — ${verdictExplain[v.verdict]}`);
  lines.push(`- Interpretation scale: > +0.2 ⇒ AMPLIFY · between −0.2 and +0.2 ⇒ NEUTRAL · < −0.2 ⇒ EQUALIZE`);
  lines.push(`- Final points dispersion: stdev **${v.pointsStdev}**, top–bottom spread **${v.pointsSpread}**`);
  lines.push("");
  lines.push("## Per-team detail");
  lines.push("");
  lines.push("| Team | Charges | Used | Use% | E/M/L | avgImpact% | maxImpact% | Debuff dealt~ | Debuff recv | Baseline | NetAdv% | Points | Rank |");
  lines.push("|------|--------:|-----:|-----:|:-----:|-----------:|-----------:|--------------:|------------:|---------:|--------:|-------:|-----:|");
  for (const a of data.aggregates) {
    lines.push(
      `| ${a.teamName} | ${a.activeChargesTotal} | ${a.deployments} | ${a.usageRatePct ?? "-"} | ${a.timingEarly}/${a.timingMid}/${a.timingLate} | ${a.avgActiveImpactPct} | ${a.maxActiveImpactPct} | ${a.debuffPointsDealtEstimate} | ${a.debuffPointsReceived} | ${a.baselineStrength} | ${a.powerNetAdvantagePct} | ${a.totalPoints} | ${a.finalRankLast ?? "-"} |`,
    );
  }
  lines.push("");
  lines.push("### Notes on methodology");
  lines.push("");
  lines.push("- `teamPowerModifier` already folds the always-on passive identity bonus into the reported score delta, so `NetAdv%` = (teamPowerModifier as % of baseScore) − (debuff points received as % of baseScore). This captures selected self/support boosts + passive minus debuffs received, without double-counting passive.");
  lines.push("- `Debuff dealt~` is an estimate: total debuff points removed across the league (parsed from `team_power_debuff` warnings) distributed by each team's share of intended debuff deployment %.");
  lines.push("- Deployments and realized impact are read from the live resolve preview for each matchday (read-only), not recomputed independently.");
  writeFileSync(path.join(outDir, "report.md"), lines.join("\n") + "\n");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const persistence = createPersistenceService();
  const previousActiveSave = persistence.getActiveSave();
  const createdSave = persistence.createFreshSeasonOneSave({
    name: `Team Power Measurement ${new Date().toISOString()}`,
  });
  const saveId = createdSave.saveId;
  let seasonId = createdSave.gameState.season.id;
  const firstSeasonId = seasonId;

  const allSamples: SideSample[] = [];
  const allPowerMeta: TeamPowerMeta[] = [];
  const allStandings: SeasonStanding[] = [];
  let seasonsPlayed = 0;

  try {
    for (let seasonIndex = 0; seasonIndex < REQUESTED_SEASONS; seasonIndex += 1) {
      logProgress(`=== Season ${seasonIndex + 1}/${REQUESTED_SEASONS} (${seasonId}) ===`);
      topUpRostersForLineups(saveId, seasonId);
      setAllTeamsToAi(saveId);

      const { samples, powerMeta, standings } = await runSeasonMatchdays({ saveId, seasonId, persistence });
      allSamples.push(...samples);
      allPowerMeta.push(...powerMeta);
      allStandings.push(...standings);
      seasonsPlayed += 1;

      const isLastSeason = seasonIndex === REQUESTED_SEASONS - 1;
      if (isLastSeason) break;

      // Advance to next season (copied pattern from smoke-season-block-1.ts).
      logProgress("Season completion + next-season setup.");
      const completion = await runLocalSeasonCompletion(
        {
          saveId,
          seasonId,
          source: "sqlite",
          execute: true,
          dryRun: false,
          confirmToken: SEASON_COMPLETION_CONFIRM_TOKEN,
        },
        persistence,
      );
      if (!completion.ok || !completion.applied) {
        throw new Error(`Season completion blocked: ${completion.blockingReasons.join(" | ")}`);
      }
      const reviewSave = requireValue(persistence.getSaveById(saveId), "Save missing after completion.");
      const nextSeasonToken = buildPreSeasonNextSeasonSetupToken(reviewSave).confirmToken;
      const nextSeason = applyPreSeasonNextSeasonSetupLightweight(reviewSave, nextSeasonToken, persistence);
      if (!nextSeason.applied) {
        throw new Error(`Next season setup blocked: ${nextSeason.blockingReasons.join(" | ")}`);
      }
      const advancedSave = requireValue(persistence.getSaveById(saveId), "Save missing after next-season setup.");
      seasonId = advancedSave.gameState.season.id;
    }

    // ----- aggregate + report -----
    const aggregates = aggregate({ samples: allSamples, powerMeta: allPowerMeta, standings: allStandings });
    const verdict = buildLeagueVerdict(aggregates, allSamples);

    const outDir = OUT_DIR_OVERRIDE
      ? path.resolve(OUT_DIR_OVERRIDE)
      : path.resolve(process.cwd(), "outputs", `team-power-effectiveness-${firstSeasonId}`);

    const meta = {
      saveId,
      requestedSeasons: REQUESTED_SEASONS,
      seasonsPlayed,
      firstSeasonId,
      lastSeasonId: seasonId,
      teams: aggregates.length,
      totalSideSamples: allSamples.length,
    };

    writeReport(outDir, { meta, aggregates, verdict });

    // sanity: team powers MUST have deployed (mirrors block-1's team_powers_not_used assertion)
    if (verdict.totalDeployments <= 0) {
      throw new Error("CAPTURE BUG: zero team-power deployments recorded, but the sim should deploy them.");
    }

    // ----- concise stdout summary -----
    const timingTotal = verdict.timing.early + verdict.timing.mid + verdict.timing.late || 1;
    console.log(
      JSON.stringify(
        {
          outDir,
          seasonsPlayed,
          teams: aggregates.length,
          adoption: {
            totalDeployments: verdict.totalDeployments,
            leagueChargeSpendPct: verdict.leagueChargeSpendPct,
            teamsNeverDeployed: verdict.teamsNeverDeployedCount,
          },
          timingSplitPct: {
            early: round((verdict.timing.early / timingTotal) * 100),
            mid: round((verdict.timing.mid / timingTotal) * 100),
            late: round((verdict.timing.late / timingTotal) * 100),
          },
          maxActiveImpactPct: verdict.maxActiveImpactPct,
          activeCeilingBreached: verdict.activeCeilingBreached,
          maxPassivePct: verdict.maxPassivePct,
          passiveCeilingBreached: verdict.passiveCeilingBreached,
          equalization: {
            correlation: verdict.correlation,
            verdict: verdict.verdict,
          },
          pointsDispersion: {
            stdev: verdict.pointsStdev,
            spread: verdict.pointsSpread,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    if (previousActiveSave?.saveId && previousActiveSave.saveId !== saveId) {
      persistence.activateSave(previousActiveSave.saveId);
    }
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
