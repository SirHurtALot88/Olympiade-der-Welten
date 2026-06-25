import { createHash, randomUUID } from "node:crypto";

import { previewSeasonEndContracts } from "@/lib/contracts/contract-renewal-service";
import { buildFormCardSeasonUsageAudit, buildGeneratedFormCardRecordsForSeason } from "@/lib/lineups/legacy-lineup-modifiers";
import type { Fixture, GameState, PreSeasonWorkflowLogRecord, SeasonState, StandingRecord } from "@/lib/data/olyDataTypes";
import { previewFacilitySeasonEndFinance } from "@/lib/facilities/facility-season-end-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";
import { normalizePlayerBaselineRecord } from "@/lib/players/player-baseline-service";
import { applyAiSeasonEndXpSpend, previewAiSeasonEndXpSpend } from "@/lib/progression/ai-xp-spend-planner";
import { applySeasonEndXpSpend, previewSeasonEndXpSpend } from "@/lib/progression/season-end-xp-apply-service";
import { buildSeasonSeededDisciplineSchedule } from "@/lib/season/season-discipline-schedule";
import { buildPlayerProgressionForecast } from "@/lib/training/player-progression-forecast";
import { buildCoreStatsFromDisciplineRatings, buildPreviewDisciplineRatingsFromAttributes } from "@/lib/training/season-end-progression-preview";
import { buildSeasonEndProgressionPreview } from "@/lib/training/season-end-progression-preview";
import { buildPrizeMoneyPreview } from "@/lib/season/prize-money-preview";
import { buildSeasonSnapshotDryRun, upsertSeasonSnapshotRecord } from "@/lib/season/season-snapshot-service";
import { advanceSeasonEconomyFactorWindow } from "@/lib/season/season-economy-factors";
import { refreshTeamObjectiveState } from "@/lib/board/team-season-objectives-service";
import type { PlayerGeneratorAttributeName, PlayerGeneratorAttributes } from "@/lib/data/olyDataTypes";
import { resolvePlayerEconomyContract } from "@/lib/foundation/player-economy-contract";

export const PRESEASON_NEXT_SEASON_SETUP_CONFIRM_TOKEN = "APPLY_PRESEASON_NEXT_SEASON_SETUP";

export type PreSeasonWorkflowStepId =
  | "season_review"
  | "season_rewards"
  | "facilities"
  | "player_development"
  | "preseason_management"
  | "transfer_sell_phase"
  | "contract_renewal"
  | "transfer_buy_phase"
  | "next_season_setup"
  | "next_season_ready";

export type PreSeasonWorkflowStep = {
  stepId: PreSeasonWorkflowStepId;
  label: string;
  status: "ready" | "warning" | "blocked" | "preview_only" | "applied";
  productive: boolean;
  summary: Record<string, number | string | boolean | null>;
  warnings: string[];
  blockingReasons: string[];
  confirmToken: string | null;
};

export type PreSeasonWorkflowPreview = {
  ok: boolean;
  dryRun: true;
  productiveWrites: false;
  saveContext: {
    saveId: string;
    seasonId: string;
    nextSeasonId: string;
    nextSeasonLabel: string;
    gamePhase: string;
  };
  controlSummary: {
    manualTeams: number;
    aiTeams: number;
    passiveTeams: number;
  };
  steps: PreSeasonWorkflowStep[];
  warnings: string[];
  blockingReasons: string[];
};

export type PreSeasonWorkflowApplyResult = Omit<PreSeasonWorkflowPreview, "dryRun" | "productiveWrites"> & {
  dryRun: false;
  productiveWrites: true;
  applied: boolean;
  appliedStepId: PreSeasonWorkflowStepId | null;
  auditLogId: string | null;
};

export type PreSeasonProgressionMaterializationResult = {
  save: PersistedSaveGame;
  teamsProcessed: number;
  teamsApplied: number;
  humanOrganicTeams: number;
  aiPlannedTeams: number;
  aiOrganicFallbackTeams: number;
  playerEventsCreated: number;
  warnings: string[];
  blockingReasons: string[];
};

function roundValue(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function toFiniteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const ATTRIBUTE_KEYS: PlayerGeneratorAttributeName[] = [
  "power",
  "health",
  "stamina",
  "intelligence",
  "awareness",
  "determination",
  "speed",
  "dexterity",
  "charisma",
  "will",
  "spirit",
  "torment",
];

function normalizePlayerAttributes(
  attributes: Partial<Record<PlayerGeneratorAttributeName, number | null>> | undefined,
): PlayerGeneratorAttributes | null {
  if (!attributes) return null;
  const values = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, attributes[key]])) as Partial<
    Record<PlayerGeneratorAttributeName, number | null>
  >;
  if (!ATTRIBUTE_KEYS.every((key) => toFiniteNumber(values[key]) != null)) {
    return null;
  }
  return values as PlayerGeneratorAttributes;
}

function driftTowardBaseline(input: {
  current: number | null | undefined;
  baseline: number | null | undefined;
  fraction: number;
  minStep: number;
  digits?: number;
}) {
  const current = toFiniteNumber(input.current);
  const baseline = toFiniteNumber(input.baseline);
  if (current == null) return baseline;
  if (baseline == null) return current;
  const delta = baseline - current;
  if (Math.abs(delta) < 0.001) return roundValue(baseline, input.digits ?? 0);
  const step = Math.min(Math.abs(delta), Math.max(input.minStep, Math.abs(delta) * input.fraction));
  return roundValue(current + Math.sign(delta) * step, input.digits ?? 0);
}

function getStableEconomyTarget(input: {
  currentVisible: number | null | undefined;
  currentRaw: number | null | undefined;
  baselineRaw: number | null | undefined;
  rawScaleDivisor: number;
  maxVisible: number;
}) {
  const baselineRaw = toFiniteNumber(input.baselineRaw);
  if (baselineRaw != null) {
    return baselineRaw > input.maxVisible ? roundValue(baselineRaw / input.rawScaleDivisor, 2) : baselineRaw;
  }

  const currentVisible = toFiniteNumber(input.currentVisible);
  if (currentVisible != null && currentVisible > 0 && currentVisible <= input.maxVisible) {
    return currentVisible;
  }

  const currentRaw = toFiniteNumber(input.currentRaw);
  if (currentRaw != null && currentRaw > 0 && currentRaw <= input.maxVisible) {
    return currentRaw;
  }

  return currentVisible ?? currentRaw ?? null;
}

function coolOffFreeAgentXp(value: number | null | undefined) {
  const current = toFiniteNumber(value);
  if (current == null || current <= 0) return 0;
  return Math.max(0, Math.round(current * 0.72) - 2);
}

function advancePlayerMoraleCarryState(gameState: GameState) {
  const rosterByPlayerId = new Map(gameState.rosters.map((entry) => [entry.playerId, entry] as const));
  return (gameState.playerMoraleState ?? []).map((entry) => {
    const activeRoster = rosterByPlayerId.get(entry.playerId) ?? null;
    if (activeRoster) {
      return {
        ...entry,
        teamId: activeRoster.teamId,
        inactiveSeasons: 0,
      };
    }

    return {
      ...entry,
      inactiveSeasons: (entry.inactiveSeasons ?? 0) + 1,
    };
  });
}

export function applySeasonBaselineProgression(gameState: GameState, options: { completedSeasonId?: string } = {}) {
  const rosterPlayerIds = new Set(gameState.rosters.map((entry) => entry.playerId));
  const completedSeasonId = options.completedSeasonId ?? gameState.season.id;
  const progressedThisSeasonPlayerIds = new Set(
    (gameState.playerProgressionEvents ?? [])
      .filter((event) => event.seasonId === completedSeasonId)
      .map((event) => event.playerId),
  );
  const baselineByPlayerId = new Map(
    (gameState.playerBaselines ?? []).map((baseline) => {
      const normalized = normalizePlayerBaselineRecord(baseline);
      return [normalized.playerId, normalized] as const;
    }),
  );
  const nextMarketValueByPlayerId = new Map<string, number | null>();

  const players = gameState.players.map((player) => {
    const baseline = baselineByPlayerId.get(player.id);
    if (!baseline) {
      return player;
    }

    const isRostered = rosterPlayerIds.has(player.id);
    const hasSeasonEndProgression = progressedThisSeasonPlayerIds.has(player.id);
    const attributeFraction = isRostered ? 0.18 : 0.22;
    const economyFraction = isRostered ? 0.18 : 0.24;
    const nextAttributePatch = Object.fromEntries(
      ATTRIBUTE_KEYS.map((attribute) => [
        attribute,
        hasSeasonEndProgression
          ? (toFiniteNumber(player.attributeSheetStats?.[attribute]) ?? baseline.attributes[attribute])
          : driftTowardBaseline({
              current: player.attributeSheetStats?.[attribute],
              baseline: baseline.attributes[attribute],
              fraction: attributeFraction,
              minStep: 1,
            }),
      ]),
    ) as PlayerGeneratorAttributes;
    const attributesAfter = normalizePlayerAttributes({
      ...(player.attributeSheetStats ?? {}),
      ...nextAttributePatch,
    });
    const nextDisciplineRatings = buildPreviewDisciplineRatingsFromAttributes({
      player,
      attributesAfter,
    });
    const currentEconomy = resolvePlayerEconomyContract({ player });
    const baselineMarketValue = getStableEconomyTarget({
      currentVisible: player.displayMarketValue,
      currentRaw: currentEconomy.marketValue ?? player.marketValue,
      baselineRaw: baseline.marketValue,
      rawScaleDivisor: 1000,
      maxVisible: 500,
    });
    const baselineSalary = getStableEconomyTarget({
      currentVisible: player.displaySalary,
      currentRaw: currentEconomy.salary ?? player.salaryDemand,
      baselineRaw: baseline.salary,
      rawScaleDivisor: 1000,
      maxVisible: 80,
    });
    const nextMarketValue =
      driftTowardBaseline({
        current: player.marketValue ?? currentEconomy.marketValue,
        baseline: baselineMarketValue,
        fraction: economyFraction,
        minStep: 0.6,
        digits: 2,
      }) ?? currentEconomy.marketValue ?? player.marketValue;
    const nextDisplayMarketValue =
      driftTowardBaseline({
        current: player.displayMarketValue ?? player.marketValue ?? currentEconomy.marketValue,
        baseline: baselineMarketValue,
        fraction: economyFraction,
        minStep: 0.6,
        digits: 2,
      }) ?? nextMarketValue;
    const nextSalaryDemand =
      driftTowardBaseline({
        current: player.salaryDemand ?? currentEconomy.salary,
        baseline: baselineSalary,
        fraction: economyFraction,
        minStep: 0.08,
        digits: 2,
      }) ?? currentEconomy.salary ?? player.salaryDemand;
    const nextDisplaySalary =
      driftTowardBaseline({
        current: player.displaySalary ?? player.salaryDemand ?? currentEconomy.salary,
        baseline: baselineSalary,
        fraction: economyFraction,
        minStep: 0.08,
        digits: 2,
      }) ?? nextSalaryDemand;

    nextMarketValueByPlayerId.set(player.id, nextDisplayMarketValue ?? nextMarketValue ?? null);

    return {
      ...player,
      attributeSheetStats: {
        ...(player.attributeSheetStats ?? {}),
        ...nextAttributePatch,
      },
      disciplineRatings: nextDisciplineRatings,
      previousDisciplineRatings: player.disciplineRatings,
      currentDisciplineValues: nextDisciplineRatings,
      disciplineDelta: undefined,
      coreStats: buildCoreStatsFromDisciplineRatings({
        disciplines: gameState.disciplines,
        disciplineRatings: nextDisciplineRatings,
        fallback: player.coreStats,
      }),
      marketValue: nextMarketValue,
      displayMarketValue: nextDisplayMarketValue,
      salaryDemand: nextSalaryDemand,
      displaySalary: nextDisplaySalary,
      bracketLabel: baseline.bracket ?? player.bracketLabel,
      currentXP: isRostered ? player.currentXP : coolOffFreeAgentXp(player.currentXP),
      trainingMode: null,
      fatigue: clamp(player.fatigue ?? 0, 0, 100),
    };
  });

  return {
    ...gameState,
    players,
    playerMoraleState: advancePlayerMoraleCarryState(gameState),
    rosters: gameState.rosters.map((entry) => {
      const nextMarketValue = nextMarketValueByPlayerId.get(entry.playerId);
      if (nextMarketValue == null) return entry;
      return {
        ...entry,
        currentValue: nextMarketValue,
      };
    }),
  };
}

function createProgressionCapturePersistence(input: {
  save: PersistedSaveGame;
  delegate: PersistenceService;
}): { persistence: PersistenceService; getSave: () => PersistedSaveGame } {
  let currentSave = structuredClone(input.save);
  const persistence: PersistenceService = {
    ...input.delegate,
    bootstrapSingleplayerSave() {
      return { save: structuredClone(currentSave), createdFromSeed: false };
    },
    getActiveSave() {
      return structuredClone(currentSave);
    },
    getSaveById(saveId) {
      return saveId === currentSave.saveId ? structuredClone(currentSave) : input.delegate.getSaveById(saveId);
    },
    saveSingleplayerState(saveId, nextGameState) {
      const saved = input.delegate.saveSingleplayerState(saveId, nextGameState);
      if (saveId === currentSave.saveId) {
        currentSave = {
          ...currentSave,
          updatedAt: saved.updatedAt ?? new Date().toISOString(),
          gameState: structuredClone(nextGameState),
        };
      }
      return structuredClone(currentSave);
    },
  };
  return {
    persistence,
    getSave: () => structuredClone(currentSave),
  };
}

function materializeSeasonEndProgressionBeforeNextSeason(
  save: PersistedSaveGame,
  persistence: PersistenceService,
): PreSeasonProgressionMaterializationResult {
  const materializationSave: PersistedSaveGame = { ...save, status: "active" };
  const capture = createProgressionCapturePersistence({ save: materializationSave, delegate: persistence });
  const completedSeasonId = save.gameState.season.id;
  const teamControlSettings = materializationSave.gameState.seasonState.teamControlSettings ?? {};
  const warnings: string[] = [];
  const blockingReasons: string[] = [];
  let teamsProcessed = 0;
  let teamsApplied = 0;
  let humanOrganicTeams = 0;
  let aiPlannedTeams = 0;
  let aiOrganicFallbackTeams = 0;
  let playerEventsCreated = 0;

  for (const team of materializationSave.gameState.teams) {
    const currentSave = capture.getSave();
    const rosterCount = currentSave.gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
    if (rosterCount === 0) continue;
    teamsProcessed += 1;
    const controlMode = teamControlSettings[team.teamId]?.controlMode ?? (team.humanControlled === false ? "ai" : "manual");

    if (controlMode === "ai") {
      const plan = previewAiSeasonEndXpSpend(currentSave, team.teamId);
      if (plan.confirmToken && plan.blockers.length === 0 && plan.plannedUpgrades.length > 0) {
        const result = applyAiSeasonEndXpSpend(currentSave, team.teamId, plan.confirmToken, capture.persistence);
        warnings.push(...result.warnings.map((warning) => `${team.shortCode}:${warning}`));
        if (result.applied) {
          teamsApplied += 1;
          aiPlannedTeams += 1;
          playerEventsCreated += result.eventIds.length;
          continue;
        }
        blockingReasons.push(...result.blockingReasons.map((reason) => `${team.shortCode}:${reason}`));
      } else {
        warnings.push(...plan.warnings.map((warning) => `${team.shortCode}:${warning}`));
      }
    }

    const fallbackSave = capture.getSave();
    const preview = previewSeasonEndXpSpend(fallbackSave, team.teamId, []);
    if (!preview.confirmToken || !preview.ok) {
      const softReasons = preview.blockingReasons.filter((reason) => reason !== "season_xp_no_unmaterialized_xp");
      warnings.push(...preview.warnings.map((warning) => `${team.shortCode}:${warning}`));
      warnings.push(...softReasons.map((reason) => `${team.shortCode}:${reason}`));
      continue;
    }
    const result = applySeasonEndXpSpend(fallbackSave, team.teamId, [], preview.confirmToken, capture.persistence, {
      allowAiTeams: controlMode !== "manual",
    });
    warnings.push(...result.warnings.map((warning) => `${team.shortCode}:${warning}`));
    if (result.applied) {
      teamsApplied += 1;
      playerEventsCreated += result.eventIds.length;
      if (controlMode === "ai") aiOrganicFallbackTeams += 1;
      else humanOrganicTeams += 1;
    } else {
      blockingReasons.push(...result.blockingReasons.map((reason) => `${team.shortCode}:${reason}`));
    }
  }

  const finalSeasonEventCount = (capture.getSave().gameState.playerProgressionEvents ?? []).filter(
    (event) => event.seasonId === completedSeasonId,
  ).length;
  if (teamsProcessed > 0 && finalSeasonEventCount === 0) {
    blockingReasons.push("season_end_progression_no_player_events");
  }

  return {
    save: capture.getSave(),
    teamsProcessed,
    teamsApplied,
    humanOrganicTeams,
    aiPlannedTeams,
    aiOrganicFallbackTeams,
    playerEventsCreated,
    warnings: [...new Set(warnings)],
    blockingReasons: [...new Set(blockingReasons)],
  };
}

function parseSeasonNumber(season: GameState["season"]) {
  const fromId = season.id.match(/(\d+)$/)?.[1];
  const fromName = season.name.match(/(\d+)$/)?.[1];
  return Math.max(1, Number(fromId ?? fromName ?? season.year ?? 1) || 1);
}

function buildNextSeasonContext(gameState: GameState) {
  const nextNumber = parseSeasonNumber(gameState.season) + 1;
  return {
    nextSeasonNumber: nextNumber,
    nextSeasonId: `season-${nextNumber}`,
    nextSeasonLabel: `Season ${nextNumber}`,
  };
}

function buildConfirmToken(input: { saveId: string; fromSeasonId: string; nextSeasonId: string; teamCount: number; rosterCount: number }) {
  return createHash("sha256")
    .update([input.saveId, input.fromSeasonId, input.nextSeasonId, input.teamCount, input.rosterCount].join(":"))
    .digest("hex");
}

function getTeamControlMode(save: PersistedSaveGame, teamId: string) {
  const setting = save.gameState.seasonState.teamControlSettings?.[teamId]?.controlMode;
  if (setting === "ai" || setting === "passive" || setting === "manual") return setting;
  const team = save.gameState.teams.find((entry) => entry.teamId === teamId);
  return team?.humanControlled ? "manual" : "ai";
}

function getSalaryTotal(gameState: GameState, teamId: string) {
  return roundValue(gameState.rosters.filter((entry) => entry.teamId === teamId).reduce((sum, entry) => sum + (entry.salary ?? 0), 0));
}

function buildZeroStandings(gameState: GameState): Record<string, StandingRecord> {
  return Object.fromEntries(
    gameState.teams.map((team, index) => [
      team.teamId,
      {
        points: 0,
        rank: index + 1,
      } satisfies StandingRecord,
    ]),
  );
}

function buildSeasonFixtures(input: { seasonId: string; matchdayIds: string[]; teamIds: string[] }): Fixture[] {
  if (input.teamIds.length < 2) {
    return [];
  }

  return input.matchdayIds.map((matchdayId, index) => ({
    id: `fixture:${input.seasonId}:${matchdayId}`,
    homeTeamId: input.teamIds[index % input.teamIds.length] ?? input.teamIds[0],
    awayTeamId: input.teamIds[(index + 1) % input.teamIds.length] ?? input.teamIds[1],
    matchdayId,
    status: "scheduled" as const,
  }));
}

function signatureSchedule(entries: NonNullable<SeasonState["disciplineSchedule"]>) {
  return entries
    .map((entry) => `${entry.discipline1?.disciplineId ?? "-"}:${entry.discipline2?.disciplineId ?? "-"}`)
    .join("|");
}

function buildNextSeasonGameState(save: PersistedSaveGame): { gameState: GameState; auditLog: PreSeasonWorkflowLogRecord } {
  const { nextSeasonId, nextSeasonLabel, nextSeasonNumber } = buildNextSeasonContext(save.gameState);
  const previousSchedule = save.gameState.seasonState.disciplineSchedule ?? [];
  let schedulePlan = buildSeasonSeededDisciplineSchedule({
    saveId: save.saveId,
    seasonId: nextSeasonId,
    disciplines: save.gameState.disciplines,
    matchdayCount: save.gameState.season.matchdayIds.length || 10,
  });
  let scheduleRerollCount = 0;
  while (
    previousSchedule.length > 0 &&
    signatureSchedule(previousSchedule) === signatureSchedule(schedulePlan.entries) &&
    scheduleRerollCount < 8
  ) {
    scheduleRerollCount += 1;
    schedulePlan = buildSeasonSeededDisciplineSchedule({
      saveId: save.saveId,
      seasonId: nextSeasonId,
      disciplines: save.gameState.disciplines,
      matchdayCount: save.gameState.season.matchdayIds.length || 10,
      scheduleVersion: `season-setup-v2-reroll-${scheduleRerollCount}`,
    });
  }
  const matchdayIds = schedulePlan.matchdayIds;
  const firstMatchdayId = matchdayIds[0] ?? `${nextSeasonId}-matchday-1`;
  const scheduleSameAsPrevious =
    previousSchedule.length > 0 &&
    signatureSchedule(previousSchedule) === signatureSchedule(schedulePlan.entries);
  const economyFactors = advanceSeasonEconomyFactorWindow({
    saveId: save.saveId,
    fromSeasonId: save.gameState.season.id,
    toSeasonId: nextSeasonId,
    seasonState: save.gameState.seasonState,
  });
  const scheduleWarnings = [
    ...schedulePlan.warnings,
    scheduleRerollCount > 0 ? `season_schedule_rerolled:${scheduleRerollCount}` : null,
    scheduleSameAsPrevious ? "season_schedule_same_as_previous_after_reroll_warning" : null,
  ].filter((entry): entry is string => Boolean(entry));
  const nextFormCards = buildGeneratedFormCardRecordsForSeason(
    {
      ...save.gameState,
      season: {
        ...save.gameState.season,
        id: nextSeasonId,
        name: nextSeasonLabel,
        year: Math.max(save.gameState.season.year + 1, nextSeasonNumber),
        currentMatchday: 1,
        matchdayIds,
      },
    },
    save.saveId,
    nextSeasonId,
  );
  const nextSeasonState: SeasonState = {
    ...save.gameState.seasonState,
    seasonId: nextSeasonId,
    schedule: buildSeasonFixtures({
      seasonId: nextSeasonId,
      matchdayIds,
      teamIds: save.gameState.teams.map((team) => team.teamId),
    }),
    disciplineSchedule: schedulePlan.entries,
    seasonEconomyFactors: economyFactors.nextWindow,
    standings: buildZeroStandings(save.gameState),
    formCards: nextFormCards,
    lineupDrafts: [],
    matchdayResults: [],
    disciplineResults: [],
    playerDisciplinePerformances: [],
    disciplineHighlights: [],
    resultAuditLogs: [],
    standingsApplyLogs: [],
    matchdayAdvanceLogs: [],
    cashPrizeApplyLogs: save.gameState.seasonState.cashPrizeApplyLogs ?? [],
    newGameFlow: {
      active: true,
      dismissed: false,
      selectedTeamId: save.gameState.seasonState.newGameFlow?.selectedTeamId ?? null,
      updatedAt: new Date().toISOString(),
      steps: [
        { stepId: "season_intro", status: "open" },
        { stepId: "team_confirm", status: "open" },
        { stepId: "roster_review", status: "open" },
        { stepId: "first_transfers", status: "open" },
        { stepId: "fill_roster", status: "open" },
        { stepId: "training_facilities", status: "open" },
        { stepId: "set_lineup", status: "open" },
      ],
    },
  };
  const auditLog: PreSeasonWorkflowLogRecord = {
    logId: `preseason-workflow__${save.saveId}__${save.gameState.season.id}__${nextSeasonId}__${randomUUID()}`,
    saveId: save.saveId,
    fromSeasonId: save.gameState.season.id,
    toSeasonId: nextSeasonId,
    stepId: "next_season_setup",
    status: "applied",
    errors: [],
    warnings: [
      ...scheduleWarnings,
      `season_economy_factors_advanced:s_plus_4=${economyFactors.rerolledSeasonPlus4.factor}`,
      nextFormCards.length === 0 ? "season_formcards_generation_empty" : null,
      "season_mutator_state_reset_lineup_modifiers_cleared",
    ].filter((entry): entry is string => Boolean(entry)),
    affectedEntities: [
      "season",
      "matchdayState",
      "seasonState.schedule",
      "seasonState.disciplineSchedule",
      "seasonState.seasonEconomyFactors",
      "seasonState.standings",
      "seasonState.formCards",
      "seasonState.newGameFlow",
      "seasonState.lineupDrafts",
      "seasonState.matchdayResults",
      "seasonState.disciplineResults",
      "seasonState.playerDisciplinePerformances",
      "playerProgressionEvents",
      "players.season_baseline_progression",
      "rosters.currentValue",
      "arena_state_reset",
    ],
    timestamp: new Date().toISOString(),
  };

  const nextGameState = refreshTeamObjectiveState(applySeasonBaselineProgression({
      ...save.gameState,
      gamePhase: "season_active",
      season: {
        ...save.gameState.season,
        id: nextSeasonId,
        name: nextSeasonLabel,
        year: Math.max(save.gameState.season.year + 1, nextSeasonNumber),
        currentMatchday: 1,
        matchdayIds,
      },
      seasonState: {
        ...nextSeasonState,
        preSeasonWorkflowLogs: [auditLog, ...(save.gameState.seasonState.preSeasonWorkflowLogs ?? [])],
      },
      matchdayState: {
        matchdayId: firstMatchdayId,
        status: "planning",
        pendingTeamIds: save.gameState.teams.map((team) => team.teamId),
        resolvedFixtureIds: [],
      },
      logs: [
        {
          id: auditLog.logId,
          type: "season",
          message: `${nextSeasonLabel} aktiviert. Pre-Season Workflow abgeschlossen.`,
          createdAt: auditLog.timestamp,
        },
        ...save.gameState.logs,
      ],
    }, { completedSeasonId: save.gameState.season.id }));

  return {
    auditLog,
    gameState: nextGameState,
  };
}

function applyFormCardPenaltyToStandings(save: PersistedSaveGame): { save: PersistedSaveGame; warnings: string[] } {
  const audit = buildFormCardSeasonUsageAudit(save.gameState, save.gameState.season.id);
  const penaltyRows = audit.rows.filter((row) => row.negativePenaltyPoints > 0);
  if (penaltyRows.length === 0) {
    return { save, warnings: [] };
  }

  const nextStandings = { ...save.gameState.seasonState.standings };
  for (const row of penaltyRows) {
    const current = nextStandings[row.teamId] ?? { points: 0 };
    nextStandings[row.teamId] = {
      ...current,
      points: Math.max(0, current.points - row.negativePenaltyPoints),
    };
  }

  const warnings = penaltyRows.map(
    (row) => `formcard_penalty_applied:${row.teamId}:${row.negativePenaltyPoints}pts`,
  );

  return {
    save: {
      ...save,
      gameState: {
        ...save.gameState,
        seasonState: {
          ...save.gameState.seasonState,
          standings: nextStandings,
        },
      },
    },
    warnings,
  };
}

function buildSaveWithRequiredSeasonSnapshot(save: PersistedSaveGame): {
  save: PersistedSaveGame;
  snapshotId: string | null;
  blockingReasons: string[];
  warnings: string[];
} {
  const snapshotPreview = buildSeasonSnapshotDryRun(save.gameState, {
    saveId: save.saveId,
    seasonId: save.gameState.season.id,
  });
  const blockingReasons = [...snapshotPreview.blockingReasons];
  const warnings = [...snapshotPreview.warnings];
  const duplicateIndex = blockingReasons.indexOf("duplicate_season_snapshot");

  if (duplicateIndex >= 0) {
    blockingReasons.splice(duplicateIndex, 1);
    warnings.push("season_snapshot_replaced_before_next_season_setup");
  }
  if (snapshotPreview.snapshot.finalStandings.length === 0) {
    blockingReasons.push("season_snapshot_final_standings_missing");
  }
  if (snapshotPreview.snapshot.playerPerformances.length === 0) {
    blockingReasons.push("season_snapshot_player_performances_missing");
  }

  if (blockingReasons.length > 0) {
    return {
      save,
      snapshotId: null,
      blockingReasons: Array.from(new Set(blockingReasons)),
      warnings: Array.from(new Set(warnings)),
    };
  }

  const nextGameState: GameState = {
    ...save.gameState,
    seasonState: {
      ...save.gameState.seasonState,
      seasonSnapshots: upsertSeasonSnapshotRecord(save.gameState.seasonState.seasonSnapshots, {
        ...snapshotPreview.snapshot,
        status: snapshotPreview.seasonCompleted ? "completed" : "partial",
      }),
    },
  };

  return {
    save: {
      ...save,
      gameState: nextGameState,
    },
    snapshotId: snapshotPreview.snapshot.snapshotId ?? null,
    blockingReasons: [],
    warnings: Array.from(new Set(warnings)),
  };
}

export function buildPreSeasonNextSeasonSetupToken(save: PersistedSaveGame) {
  const { nextSeasonId, nextSeasonLabel } = buildNextSeasonContext(save.gameState);
  return {
    nextSeasonId,
    nextSeasonLabel,
    confirmToken: buildConfirmToken({
      saveId: save.saveId,
      fromSeasonId: save.gameState.season.id,
      nextSeasonId,
      teamCount: save.gameState.teams.length,
      rosterCount: save.gameState.rosters.length,
    }),
  };
}

export function applyPreSeasonNextSeasonSetupLightweight(
  save: PersistedSaveGame,
  confirmToken: string | null | undefined,
  persistence: PersistenceService = createPersistenceService(),
): PreSeasonWorkflowApplyResult {
  const setup = buildPreSeasonNextSeasonSetupToken(save);
  const basePreview: PreSeasonWorkflowPreview = {
    ok: true,
    dryRun: true,
    productiveWrites: false,
    saveContext: {
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      nextSeasonId: setup.nextSeasonId,
      nextSeasonLabel: setup.nextSeasonLabel,
      gamePhase: save.gameState.gamePhase ?? "season_active",
    },
    controlSummary: {
      manualTeams: save.gameState.teams.filter((team) => getTeamControlMode(save, team.teamId) === "manual").length,
      aiTeams: save.gameState.teams.filter((team) => getTeamControlMode(save, team.teamId) === "ai").length,
      passiveTeams: save.gameState.teams.filter((team) => getTeamControlMode(save, team.teamId) === "passive").length,
    },
    steps: [
      {
        stepId: "next_season_setup",
        label: "Season Setup",
        status: "ready",
        productive: true,
        summary: {
          nextSeasonId: setup.nextSeasonId,
          nextSeasonLabel: setup.nextSeasonLabel,
          resetLineups: save.gameState.seasonState.lineupDrafts?.length ?? 0,
          resetFormCards: save.gameState.seasonState.formCards?.length ?? 0,
          matchday: 1,
          standingsReset: true,
        },
        warnings: ["lightweight_next_season_setup_skip_expensive_preview"],
        blockingReasons: [],
        confirmToken: setup.confirmToken,
      },
    ],
    warnings: ["lightweight_next_season_setup_skip_expensive_preview"],
    blockingReasons: [],
  };

  if (confirmToken !== setup.confirmToken) {
    return {
      ...basePreview,
      dryRun: false,
      productiveWrites: true,
      applied: false,
      appliedStepId: null,
      auditLogId: null,
      blockingReasons: [confirmToken ? "preseason_preview_stale" : "confirm_token_required"],
    };
  }

  const penaltyResult = applyFormCardPenaltyToStandings(save);
  const snapshotResult = buildSaveWithRequiredSeasonSnapshot(penaltyResult.save);
  if (snapshotResult.blockingReasons.length > 0) {
    return {
      ...basePreview,
      dryRun: false,
      productiveWrites: true,
      applied: false,
      appliedStepId: null,
      auditLogId: null,
      warnings: [...basePreview.warnings, ...penaltyResult.warnings, ...snapshotResult.warnings],
      blockingReasons: snapshotResult.blockingReasons,
    };
  }

  const progressionResult = materializeSeasonEndProgressionBeforeNextSeason(snapshotResult.save, persistence);
  if (progressionResult.blockingReasons.length > 0) {
    return {
      ...basePreview,
      dryRun: false,
      productiveWrites: true,
      applied: false,
      appliedStepId: null,
      auditLogId: null,
      warnings: [...basePreview.warnings, ...snapshotResult.warnings, ...progressionResult.warnings],
      blockingReasons: progressionResult.blockingReasons,
    };
  }

  const { gameState, auditLog } = buildNextSeasonGameState(progressionResult.save);
  persistence.saveSingleplayerState(save.saveId, gameState);
  return {
    ...basePreview,
    dryRun: false,
    productiveWrites: true,
    applied: true,
    appliedStepId: "next_season_setup",
    auditLogId: auditLog.logId,
    saveContext: {
      ...basePreview.saveContext,
      seasonId: gameState.season.id,
      gamePhase: gameState.gamePhase ?? "season_active",
    },
    warnings: [
      ...basePreview.warnings,
      ...snapshotResult.warnings,
      ...progressionResult.warnings,
      `season_end_progression_applied:teams=${progressionResult.teamsApplied}:events=${progressionResult.playerEventsCreated}`,
    ],
    steps: basePreview.steps.map((step) => ({ ...step, status: "applied" as const })),
  };
}

export async function buildPreSeasonWorkflowPreview(
  save: PersistedSaveGame,
  persistence: PersistenceService = createPersistenceService(),
): Promise<PreSeasonWorkflowPreview> {
  const { nextSeasonId, nextSeasonLabel } = buildNextSeasonContext(save.gameState);
  const controlModes = save.gameState.teams.map((team) => getTeamControlMode(save, team.teamId));
  const controlSummary = {
    manualTeams: controlModes.filter((mode) => mode === "manual").length,
    aiTeams: controlModes.filter((mode) => mode === "ai").length,
    passiveTeams: controlModes.filter((mode) => mode === "passive").length,
  };
  const prizePreview = await buildPrizeMoneyPreview(
    { saveId: save.saveId, seasonId: save.gameState.season.id, source: "sqlite", phase: "season_end" },
    persistence,
  );
  const facilityPreviews = save.gameState.teams.map((team) => previewFacilitySeasonEndFinance(save, team.teamId));
  const totalPrizeMoney = roundValue(prizePreview.items.reduce((sum, item) => sum + (item.prizeMoney ?? 0), 0));
  const totalRankChangePrize = prizePreview.summary.totalRankChangePrize == null ? null : roundValue(prizePreview.summary.totalRankChangePrize);
  const totalSponsor = roundValue(prizePreview.items.reduce((sum, item) => sum + (item.seasonCash ?? 0), 0));
  const totalUpkeep = roundValue(facilityPreviews.reduce((sum, item) => sum + item.facilityUpkeepTotal, 0));
  const totalFacilityIncome = roundValue(facilityPreviews.reduce((sum, item) => sum + item.facilityIncomeTotal, 0));
  const totalSalary = roundValue(save.gameState.teams.reduce((sum, team) => sum + getSalaryTotal(save.gameState, team.teamId), 0));
  const cashBefore = roundValue(save.gameState.teams.reduce((sum, team) => sum + (toFiniteNumber(team.cash) ?? 0), 0));
  const cashAfterRewards = roundValue(
    prizePreview.items.reduce((sum, item) => sum + (item.projectedCash ?? item.currentCash ?? 0), 0),
  );
  const cashAfterFacilities = roundValue(cashAfterRewards + totalFacilityIncome - totalUpkeep);
  const prizeApplyLogs = save.gameState.seasonState.cashPrizeApplyLogs ?? [];
  const currentSeasonPrizeApplyLogs = prizeApplyLogs.filter((log) => log.seasonId === save.gameState.season.id);
  const prizeApplied = currentSeasonPrizeApplyLogs.length > 0;
  const forecastsByPlayerId = new Map(
    save.gameState.rosters.map((entry) => {
      const player = save.gameState.players.find((candidate) => candidate.id === entry.playerId)!;
      return [
        entry.playerId,
        buildPlayerProgressionForecast({
          gameState: save.gameState,
          player,
          playerRating: null,
          seasonPerformance: null,
          trainingModeByPlayerId: {},
          currentXP: player.currentXP ?? 0,
          spentXP: player.spentXP ?? 0,
          lifetimeXP: player.lifetimeXP ?? null,
        }),
      ] as const;
    }).filter((entry) => Boolean(entry[1])),
  );
  const progressionPreview = buildSeasonEndProgressionPreview({
    gameState: save.gameState,
    forecastsByPlayerId,
    upgradeRequests: save.gameState.rosters.map((entry) => ({ playerId: entry.playerId, attribute: "power" })),
  });
  const contractPreview = previewSeasonEndContracts(save);
  const marketPreviewWarning = "market_candidate_scan_deferred_use_transfermarkt_tab_or_ai_market_apply_service";
  const nextSeasonConfirmToken = buildConfirmToken({
    saveId: save.saveId,
    fromSeasonId: save.gameState.season.id,
    nextSeasonId,
    teamCount: save.gameState.teams.length,
    rosterCount: save.gameState.rosters.length,
  });
  const rewardsWarnings = [
    ...prizePreview.globalWarnings,
    ...facilityPreviews.flatMap((preview) => preview.warnings.map((warning) => `${preview.team?.shortCode ?? preview.team?.teamId}:${warning}`)),
    prizePreview.source.prizeTable === "missing" ? "prize_money_source_missing" : null,
    totalSponsor <= 0 ? "sponsor_source_missing" : null,
  ].filter((entry): entry is string => Boolean(entry));
  const steps: PreSeasonWorkflowStep[] = [
    {
      stepId: "season_review",
      label: "Season Review",
      status: "preview_only",
      productive: false,
      summary: {
        seasonId: save.gameState.season.id,
        finalStandings: Object.keys(save.gameState.seasonState.standings ?? {}).length,
        snapshots: save.gameState.seasonState.seasonSnapshots?.length ?? 0,
        productiveWrites: false,
      },
      warnings: [],
      blockingReasons: [],
      confirmToken: null,
    },
    {
      stepId: "season_rewards",
      label: "Preisgeld & Finanzen",
      status: prizePreview.blockedRules.length > 0 ? "blocked" : rewardsWarnings.length > 0 ? "warning" : "ready",
      productive: true,
      summary: {
        cashBefore,
        prizeMoney: totalPrizeMoney,
        rankChangePrize: totalRankChangePrize,
        sponsor: totalSponsor,
        cashAfterRewards,
        prizeApplied,
        alreadyApplied: prizeApplied,
        applyLogCount: currentSeasonPrizeApplyLogs.length,
      },
      warnings: [...rewardsWarnings, prizeApplied ? "already_applied" : "prize_money_open"],
      blockingReasons: prizePreview.blockedRules,
      confirmToken: "USE_CASH_PRIZE_AND_FACILITY_CONFIRM_STEPS",
    },
    {
      stepId: "facilities",
      label: "Facilities",
      status: facilityPreviews.some((preview) => preview.blockingReasons.length > 0) ? "blocked" : facilityPreviews.some((preview) => preview.warnings.length > 0) ? "warning" : "ready",
      productive: true,
      summary: { facilityUpkeep: totalUpkeep, facilityIncome: totalFacilityIncome, salaryTotal: totalSalary, cashAfterFacilities },
      warnings: facilityPreviews.flatMap((preview) => preview.warnings.map((warning) => `${preview.team?.shortCode ?? preview.team?.teamId}:${warning}`)),
      blockingReasons: facilityPreviews.flatMap((preview) => preview.blockingReasons.map((blocker) => `${preview.team?.shortCode ?? preview.team?.teamId}:${blocker}`)),
      confirmToken: "USE_FACILITY_SEASON_END_CONFIRM_STEP",
    },
    {
      stepId: "player_development",
      label: "XP / Spielerentwicklung",
      status: "ready",
      productive: true,
      summary: { players: progressionPreview.rows.length, planned: progressionPreview.rows.filter((row) => row.status === "planned").length, blocked: progressionPreview.rows.filter((row) => row.status === "blocked").length, productiveWrites: true },
      warnings: [...progressionPreview.warnings, "applied_with_next_season_setup"],
      blockingReasons: [],
      confirmToken: "APPLIED_WITH_NEXT_SEASON_SETUP",
    },
    {
      stepId: "preseason_management",
      label: "Training / Ziele",
      status: "preview_only",
      productive: false,
      summary: { facilityUpgradeServiceReady: true, specialistWingPrepared: true, manualTeamsWaiting: controlSummary.manualTeams, aiTeamsReady: controlSummary.aiTeams },
      warnings: ["existing_apply_services_only", "manual_teams_wait_for_user_decision"],
      blockingReasons: [],
      confirmToken: null,
    },
    {
      stepId: "transfer_sell_phase",
      label: "Verkäufe",
      status: controlSummary.aiTeams > 0 ? "ready" : "preview_only",
      productive: true,
      summary: { aiTeams: controlSummary.aiTeams, sellTeams: null, manualTeamsSkipped: controlSummary.manualTeams, passiveTeamsSkipped: controlSummary.passiveTeams, usesSellService: true },
      warnings: ["human_teams_no_auto_sell", "ai_sell_before_buy", "uses executeLocalTransfermarktSell via ai-market-plan-apply-service", "transfer_history_required", marketPreviewWarning],
      blockingReasons: [],
      confirmToken: "USE_AI_MARKET_APPLY_CONFIRM_TOKEN_SELL_ONLY",
    },
    {
      stepId: "contract_renewal",
      label: "Verlängern",
      status: contractPreview.blockingReasons.length > 0 ? "blocked" : contractPreview.expiringCount > 0 ? "warning" : "ready",
      productive: true,
      summary: {
        renewalServiceReady: true,
        expiringContracts: contractPreview.expiringCount,
        outOfContractAfterTick: contractPreview.outOfContractAfterTickCount,
        manualDecisionsRequired: contractPreview.manualDecisionCount,
        aiRenewalCandidates: contractPreview.aiRenewalCandidates,
        aiReleaseCandidates: contractPreview.aiReleaseCandidates,
        contractEventsExisting: save.gameState.seasonState.contractEvents?.length ?? 0,
      },
      warnings: contractPreview.warnings,
      blockingReasons: contractPreview.blockingReasons,
      confirmToken: contractPreview.confirmToken,
    },
    {
      stepId: "transfer_buy_phase",
      label: "Kaufen",
      status: controlSummary.aiTeams > 0 ? "ready" : "preview_only",
      productive: true,
      summary: { aiTeams: controlSummary.aiTeams, buyTeams: null, manualTeamsSkipped: controlSummary.manualTeams, passiveTeamsSkipped: controlSummary.passiveTeams, usesBuyService: true },
      warnings: ["human_teams_no_auto_buy", "buy_after_sell", "uses executeLocalTransfermarktBuy via ai-market-plan-apply-service", "transfer_history_required", marketPreviewWarning],
      blockingReasons: [],
      confirmToken: "USE_AI_MARKET_APPLY_CONFIRM_TOKEN_BUY_AFTER_SELL",
    },
    {
      stepId: "next_season_setup",
      label: "Season Setup",
      status: "ready",
      productive: true,
      summary: { nextSeasonId, nextSeasonLabel, resetLineups: save.gameState.seasonState.lineupDrafts?.length ?? 0, resetFormCards: save.gameState.seasonState.formCards?.length ?? 0, matchday: 1, standingsReset: true },
      warnings: ["team_control_settings_preserved", "rosters_and_transfer_history_preserved"],
      blockingReasons: [],
      confirmToken: nextSeasonConfirmToken,
    },
    {
      stepId: "next_season_ready",
      label: "Neue Saison aktivieren",
      status: "ready",
      productive: true,
      summary: { button: "Neue Saison starten", gamePhaseAfterApply: "season_active", reconciliation: "local_save_scope_and_counts" },
      warnings: [],
      blockingReasons: [],
      confirmToken: nextSeasonConfirmToken,
    },
  ];
  const warnings = [...new Set(steps.flatMap((step) => step.warnings))];
  const blockingReasons = [...new Set(steps.flatMap((step) => step.blockingReasons))];

  return {
    ok: blockingReasons.length === 0,
    dryRun: true,
    productiveWrites: false,
    saveContext: {
      saveId: save.saveId,
      seasonId: save.gameState.season.id,
      nextSeasonId,
      nextSeasonLabel,
      gamePhase: save.gameState.gamePhase ?? "season_active",
    },
    controlSummary,
    steps,
    warnings,
    blockingReasons,
  };
}

export async function applyPreSeasonNextSeasonSetup(
  save: PersistedSaveGame,
  confirmToken: string | null | undefined,
  persistence: PersistenceService = createPersistenceService(),
): Promise<PreSeasonWorkflowApplyResult> {
  const preview = await buildPreSeasonWorkflowPreview(save, persistence);
  const setupStep = preview.steps.find((step) => step.stepId === "next_season_setup");
  if (!setupStep?.confirmToken || confirmToken !== setupStep.confirmToken) {
    return {
      ...preview,
      dryRun: false,
      productiveWrites: true,
      applied: false,
      appliedStepId: null,
      auditLogId: null,
      blockingReasons: [...preview.blockingReasons, confirmToken ? "preseason_preview_stale" : "confirm_token_required"],
    };
  }
  const penaltyResult = applyFormCardPenaltyToStandings(save);
  const snapshotResult = buildSaveWithRequiredSeasonSnapshot(penaltyResult.save);
  if (snapshotResult.blockingReasons.length > 0) {
    return {
      ...preview,
      dryRun: false,
      productiveWrites: true,
      applied: false,
      appliedStepId: null,
      auditLogId: null,
      warnings: [...preview.warnings, ...penaltyResult.warnings, ...snapshotResult.warnings],
      blockingReasons: snapshotResult.blockingReasons,
    };
  }

  const progressionResult = materializeSeasonEndProgressionBeforeNextSeason(snapshotResult.save, persistence);
  if (progressionResult.blockingReasons.length > 0) {
    return {
      ...preview,
      dryRun: false,
      productiveWrites: true,
      applied: false,
      appliedStepId: null,
      auditLogId: null,
      warnings: [...preview.warnings, ...snapshotResult.warnings, ...progressionResult.warnings],
      blockingReasons: progressionResult.blockingReasons,
    };
  }

  const { gameState, auditLog } = buildNextSeasonGameState(progressionResult.save);
  persistence.saveSingleplayerState(save.saveId, gameState);
  const nextPreview = await buildPreSeasonWorkflowPreview({ ...progressionResult.save, gameState }, persistence);

  return {
    ...nextPreview,
    dryRun: false,
    productiveWrites: true,
    applied: true,
    appliedStepId: "next_season_setup",
    auditLogId: auditLog.logId,
    warnings: [
      ...nextPreview.warnings,
      ...penaltyResult.warnings,
      ...snapshotResult.warnings,
      ...progressionResult.warnings,
      `season_end_progression_applied:teams=${progressionResult.teamsApplied}:events=${progressionResult.playerEventsCreated}`,
    ],
    steps: nextPreview.steps.map((step) =>
      step.stepId === "next_season_setup" || step.stepId === "next_season_ready"
        ? { ...step, status: "applied" as const }
        : step,
    ),
  };
}
