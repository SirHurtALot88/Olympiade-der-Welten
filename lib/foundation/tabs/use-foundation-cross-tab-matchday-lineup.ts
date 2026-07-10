import { useCallback, useEffect, useMemo, useRef } from "react";

import type { GameState, Team } from "@/lib/data/olyDataTypes";
import type { FoundationSaveMode } from "@/lib/persistence/foundation-save-mode";
import { getFormCardFlowStatus } from "@/lib/foundation/form-card-flow";
import {
  getLineupDraftSideCounts,
  getMatchdayLineupSideRequirements,
  getTeamMatchdayLineupDraft,
  getTeamMatchdayLineupOpenSlots,
  isTeamMatchdayLineupComplete,
  isTeamMatchdayLineupOperationallyReady,
  isTeamMatchdayLineupSubmitted,
} from "@/lib/foundation/matchday-lineup-readiness";
import {
  buildMatchdaySummary,
  getMatchdaySummaryOptions,
  type MatchdaySummary,
  type MatchdaySummaryTeamRow,
} from "@/lib/foundation/matchday-summary";
import type {
  FoundationAiLineupBatchApplyResponse,
  FoundationResolvePreviewResponse,
} from "@/lib/foundation/tabs/foundation-page-types";
import { shouldBuildFoundationMatchdayFlowDerivations } from "@/lib/foundation/tabs/use-foundation-cross-tab-game-flow";
import {
  appendRoomContextToParams,
  withRoomContextBody,
  type FoundationRoomContext,
} from "@/lib/room/foundation-room-context-client";

export function shouldBuildFoundationMatchdaySummaryDerivations(activeView: string): boolean {
  return (
    activeView === "matchdayArena" ||
    activeView === "matchdayResult" ||
    activeView === "lineup" ||
    activeView === "lineupV2" ||
    activeView === "homeV2"
  );
}

export type HomeNextMatchdayStatus = {
  d1Slots: number;
  d2Slots: number;
  requiredSlots: number;
  filledSlots: number;
  openSlots: number;
  resultAvailable: boolean;
  hasFormCards: boolean;
  hasFormCardPool: boolean;
  formCardBlocker: string | null;
  statusLabel: string;
};

const EMPTY_HOME_NEXT_MATCHDAY_STATUS: HomeNextMatchdayStatus = {
  d1Slots: 0,
  d2Slots: 0,
  requiredSlots: 0,
  filledSlots: 0,
  openSlots: 0,
  resultAvailable: false,
  hasFormCards: false,
  hasFormCardPool: false,
  formCardBlocker: null,
  statusLabel: "Einsatzliste offen",
};

const EMPTY_MATCHDAY_SUMMARY: MatchdaySummary = {
  seasonId: "",
  matchdayId: "",
  matchdayNumber: null,
  d1: { disciplineId: null, disciplineName: null },
  d2: { disciplineId: null, disciplineName: null },
  hasResult: false,
  teamRows: [],
  topTeams: [],
  bottomTeams: [],
  topPlayers: [],
  highlights: [],
  warnings: [],
};

type CurrentMatchdayDisciplineSchedule = {
  discipline1?: { disciplineId?: string | null; displayName?: string | null; playerCount?: number | null } | null;
  discipline2?: { disciplineId?: string | null; displayName?: string | null; playerCount?: number | null } | null;
} | null;

type TeamControlSettingsMap = Record<string, { controlMode?: string | null } | undefined>;

export function resolveFoundationLineupIssueTeamId(input: {
  gameState: GameState;
  resolvePreviewFeed: FoundationResolvePreviewResponse | null;
  managerTeamOptions: Team[];
  resolvedTeamControlSettings: TeamControlSettingsMap;
  preferredTeamId?: string | null;
}): string | null {
  const matchdayLineups = (input.gameState.seasonState.lineupDrafts ?? []).filter(
    (draft) =>
      draft.seasonId === input.gameState.season.id &&
      draft.matchdayId === input.gameState.matchdayState.matchdayId,
  );
  const lineupByTeamId = new Map(matchdayLineups.map((draft) => [draft.teamId, draft] as const));
  const readinessByTeamId = new Map((input.resolvePreviewFeed?.teamRows ?? []).map((row) => [row.teamId, row] as const));
  const issueStatuses = new Set(["missing_lineup", "underfilled_roster", "invalid_lineup", "missing_score_coverage"]);
  const isLineupIssueTeam = (teamId: string | null | undefined) => {
    if (!teamId) {
      return false;
    }
    const readiness = readinessByTeamId.get(teamId);
    if (readiness && issueStatuses.has(readiness.readinessStatus)) {
      return true;
    }
    return !isTeamMatchdayLineupComplete(input.gameState, teamId, lineupByTeamId.get(teamId) ?? null);
  };

  if (isLineupIssueTeam(input.preferredTeamId)) {
    return input.preferredTeamId ?? null;
  }

  const visibleCandidateTeams = input.managerTeamOptions.length ? input.managerTeamOptions : input.gameState.teams;
  const nonPassiveCandidate = visibleCandidateTeams.find((team) => {
    const controlMode =
      input.resolvedTeamControlSettings[team.teamId]?.controlMode ?? (team.humanControlled ? "manual" : "ai");
    return controlMode === "manual" && isLineupIssueTeam(team.teamId);
  });
  if (nonPassiveCandidate) {
    return nonPassiveCandidate.teamId;
  }

  const anyCandidate = visibleCandidateTeams.find((team) => {
    const controlMode =
      input.resolvedTeamControlSettings[team.teamId]?.controlMode ?? (team.humanControlled ? "manual" : "ai");
    return controlMode === "manual" && isLineupIssueTeam(team.teamId);
  });
  return anyCandidate?.teamId ?? input.preferredTeamId ?? null;
}

export function useFoundationCrossTabMatchdayLineup(input: {
  activeView: string;
  gameState: GameState;
  activeManagerTeamId: string | null;
  aiLineupEnsureTeams: Team[];
  currentMatchdayDisciplineSchedule: CurrentMatchdayDisciplineSchedule;
  selectedMatchdaySummaryId: string | null;
  activeSaveId: string;
  readMetaSource: string;
  readMetaReadOnly: boolean;
  roomContext: FoundationRoomContext | null;
  foundationSaveMode: FoundationSaveMode;
  aiLineupEnsureBusy: boolean;
  setAiLineupEnsureBusy: (busy: boolean) => void;
  setAiLineupEnsureFeed: (feed: FoundationAiLineupBatchApplyResponse | null) => void;
  loadSave: (
    saveId?: string,
    saveMode?: FoundationSaveMode,
    options?: { compactInitial?: boolean },
  ) => Promise<GameState | null>;
}) {
  const shouldBuildMatchdayDerivations = shouldBuildFoundationMatchdayFlowDerivations(input.activeView);
  const shouldBuildMatchdaySummary = shouldBuildFoundationMatchdaySummaryDerivations(input.activeView);

  const aiLineupEnsureRunStartedRef = useRef<Set<string>>(new Set());
  const aiLineupEnsureAbortRef = useRef<AbortController | null>(null);

  const homeCurrentLineupDraft = useMemo(() => {
    if (!shouldBuildMatchdayDerivations) {
      return null;
    }
    return input.activeManagerTeamId ? getTeamMatchdayLineupDraft(input.gameState, input.activeManagerTeamId) : null;
  }, [input.activeManagerTeamId, input.gameState, shouldBuildMatchdayDerivations]);

  const currentMatchdayLineupDrafts = useMemo(() => {
    if (!shouldBuildMatchdayDerivations) {
      return [];
    }
    return (input.gameState.seasonState.lineupDrafts ?? []).filter(
      (draft) =>
        draft.seasonId === input.gameState.season.id &&
        draft.matchdayId === input.gameState.matchdayState.matchdayId,
    );
  }, [
    input.gameState.matchdayState.matchdayId,
    input.gameState.season.id,
    input.gameState.seasonState.lineupDrafts,
    shouldBuildMatchdayDerivations,
  ]);

  const currentMatchdayRequiredLineupSlots = shouldBuildMatchdayDerivations
    ? getMatchdayLineupSideRequirements(input.gameState).totalRequired
    : 0;

  const isCurrentMatchdayLineupComplete = useCallback(
    (draft: { teamId: string; entries: unknown[] } | null | undefined) => {
      if (!shouldBuildMatchdayDerivations) {
        return false;
      }
      return Boolean(
        draft &&
          isTeamMatchdayLineupOperationallyReady(
            input.gameState,
            draft.teamId,
            draft as Parameters<typeof isTeamMatchdayLineupOperationallyReady>[2],
          ),
      );
    },
    [input.gameState, shouldBuildMatchdayDerivations],
  );

  const aiLineupMissingTeamIds = useMemo(() => {
    if (!shouldBuildMatchdayDerivations) {
      return [] as string[];
    }
    const readyTeamIds = new Set(
      currentMatchdayLineupDrafts
        .filter((draft) => isCurrentMatchdayLineupComplete(draft))
        .map((draft) => draft.teamId),
    );
    return input.aiLineupEnsureTeams
      .filter((team) => !readyTeamIds.has(team.teamId))
      .map((team) => team.teamId);
  }, [
    currentMatchdayLineupDrafts,
    input.aiLineupEnsureTeams,
    isCurrentMatchdayLineupComplete,
    shouldBuildMatchdayDerivations,
  ]);

  const activeManagerLineupReady = shouldBuildMatchdayDerivations
    ? isCurrentMatchdayLineupComplete(homeCurrentLineupDraft)
    : false;
  const activeManagerLineupSubmitted = shouldBuildMatchdayDerivations
    ? isTeamMatchdayLineupSubmitted(homeCurrentLineupDraft)
    : false;

  const homeNextMatchdayStatus = useMemo<HomeNextMatchdayStatus>(() => {
    if (!shouldBuildMatchdayDerivations) {
      return EMPTY_HOME_NEXT_MATCHDAY_STATUS;
    }

    const d1Slots = input.currentMatchdayDisciplineSchedule?.discipline1?.playerCount ?? 0;
    const d2Slots = input.currentMatchdayDisciplineSchedule?.discipline2?.playerCount ?? 0;
    const requiredSlots = currentMatchdayRequiredLineupSlots;
    const sideCounts = getLineupDraftSideCounts(homeCurrentLineupDraft?.entries ?? []);
    const filledSlots = sideCounts.total;
    const openSlots = input.activeManagerTeamId
      ? getTeamMatchdayLineupOpenSlots(input.gameState, input.activeManagerTeamId, homeCurrentLineupDraft)
      : requiredSlots;
    const resultAvailable = (input.gameState.seasonState.matchdayResults ?? []).some(
      (result) =>
        result.seasonId === input.gameState.season.id &&
        result.matchdayId === input.gameState.matchdayState.matchdayId,
    );
    const formCardFlow = getFormCardFlowStatus(input.gameState, input.activeManagerTeamId);

    return {
      d1Slots,
      d2Slots,
      requiredSlots,
      filledSlots,
      openSlots,
      resultAvailable,
      hasFormCards: formCardFlow.isReady,
      hasFormCardPool: formCardFlow.hasPool,
      formCardBlocker: formCardFlow.blocker,
      statusLabel: resultAvailable
        ? "Result verfügbar"
        : requiredSlots > 0 && filledSlots >= requiredSlots && !activeManagerLineupSubmitted
          ? "Lineup bestätigen"
          : requiredSlots > 0 && filledSlots >= requiredSlots
            ? "Arena bereit"
            : filledSlots > 0
              ? "Einsatzliste unvollständig"
              : "Einsatzliste offen",
    };
  }, [
    activeManagerLineupSubmitted,
    currentMatchdayRequiredLineupSlots,
    homeCurrentLineupDraft,
    input.activeManagerTeamId,
    input.currentMatchdayDisciplineSchedule,
    input.gameState,
    shouldBuildMatchdayDerivations,
  ]);

  const matchdaySummaryOptions = useMemo(() => {
    if (!shouldBuildMatchdaySummary) {
      return [];
    }
    return getMatchdaySummaryOptions(input.gameState, input.gameState.season.id);
  }, [input.gameState, shouldBuildMatchdaySummary]);

  const activeMatchdaySummaryId = useMemo(() => {
    if (!shouldBuildMatchdaySummary) {
      return input.gameState.matchdayState.matchdayId;
    }
    return input.selectedMatchdaySummaryId &&
      matchdaySummaryOptions.some((entry) => entry.matchdayId === input.selectedMatchdaySummaryId)
      ? input.selectedMatchdaySummaryId
      : (matchdaySummaryOptions.at(-1)?.matchdayId ?? input.gameState.matchdayState.matchdayId);
  }, [
    input.gameState.matchdayState.matchdayId,
    input.selectedMatchdaySummaryId,
    matchdaySummaryOptions,
    shouldBuildMatchdaySummary,
  ]);

  const matchdaySummary = useMemo(() => {
    if (!shouldBuildMatchdaySummary) {
      return EMPTY_MATCHDAY_SUMMARY;
    }
    return buildMatchdaySummary(input.gameState, {
      seasonId: input.gameState.season.id,
      matchdayId: activeMatchdaySummaryId,
    });
  }, [activeMatchdaySummaryId, input.gameState, shouldBuildMatchdaySummary]);

  const activeTeamMatchdaySummaryRow = useMemo<MatchdaySummaryTeamRow | null>(() => {
    if (!shouldBuildMatchdaySummary) {
      return null;
    }
    return matchdaySummary.teamRows.find((row) => row.teamId === input.activeManagerTeamId) ?? null;
  }, [input.activeManagerTeamId, matchdaySummary.teamRows, shouldBuildMatchdaySummary]);

  const ensureAiLineupsForCurrentMatchday = useCallback(
    async (trigger: "human_lineup_saved" | "arena_open" | "manual" = "manual") => {
      if (
        input.readMetaSource !== "sqlite" ||
        input.readMetaReadOnly ||
        !input.activeSaveId ||
        input.activeSaveId === "loading-save" ||
        !input.gameState.season.id ||
        !input.gameState.matchdayState.matchdayId ||
        input.aiLineupEnsureBusy ||
        input.aiLineupEnsureTeams.length === 0 ||
        aiLineupMissingTeamIds.length === 0
      ) {
        return null;
      }

      const runKey = [
        input.activeSaveId,
        input.gameState.season.id,
        input.gameState.matchdayState.matchdayId,
        aiLineupMissingTeamIds.join(","),
      ].join(":");
      if (trigger !== "manual" && aiLineupEnsureRunStartedRef.current.has(runKey)) {
        return null;
      }

      aiLineupEnsureRunStartedRef.current.add(runKey);
      input.setAiLineupEnsureBusy(true);
      aiLineupEnsureAbortRef.current?.abort();
      const controller = new AbortController();
      aiLineupEnsureAbortRef.current = controller;
      try {
        const query = appendRoomContextToParams(
          new URLSearchParams({
            saveId: input.activeSaveId,
            seasonId: input.gameState.season.id,
            matchdayId: input.gameState.matchdayState.matchdayId,
            source: input.readMetaSource,
          }),
          input.roomContext,
        );
        const response = await fetch(`/api/lineups/legacy/ai-batch-apply?${query.toString()}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify(
            withRoomContextBody(
              {
                dryRun: false,
                confirm: true,
                includeWarningTeams: true,
                overwriteExisting: false,
                forceAiTeams: true,
              },
              input.roomContext,
            ),
          ),
        });
        if (controller.signal.aborted) {
          return null;
        }
        const payload = (await response.json()) as FoundationAiLineupBatchApplyResponse;
        input.setAiLineupEnsureFeed(payload);
        if (response.ok && !payload.error) {
          await input.loadSave(input.activeSaveId, input.foundationSaveMode, { compactInitial: true });
        }
        return payload;
      } catch (error) {
        if (controller.signal.aborted) {
          return null;
        }
        throw error;
      } finally {
        if (aiLineupEnsureAbortRef.current === controller) {
          aiLineupEnsureAbortRef.current = null;
        }
        input.setAiLineupEnsureBusy(false);
      }
    },
    [
      aiLineupMissingTeamIds,
      input.activeSaveId,
      input.aiLineupEnsureBusy,
      input.aiLineupEnsureTeams.length,
      input.foundationSaveMode,
      input.gameState.matchdayState.matchdayId,
      input.gameState.season.id,
      input.loadSave,
      input.readMetaReadOnly,
      input.readMetaSource,
      input.roomContext,
      input.setAiLineupEnsureBusy,
      input.setAiLineupEnsureFeed,
    ],
  );

  useEffect(() => {
    if (input.activeView !== "matchdayArena" || !activeManagerLineupReady || aiLineupMissingTeamIds.length === 0) {
      return;
    }

    void ensureAiLineupsForCurrentMatchday("arena_open");
  }, [
    activeManagerLineupReady,
    aiLineupMissingTeamIds.length,
    ensureAiLineupsForCurrentMatchday,
    input.activeView,
    input.gameState.matchdayState.matchdayId,
    input.gameState.season.id,
  ]);

  useEffect(() => {
    if (input.activeView !== "lineup" && input.activeView !== "lineupV2" && input.activeView !== "matchdayArena") {
      aiLineupEnsureAbortRef.current?.abort();
      aiLineupEnsureAbortRef.current = null;
    }
  }, [input.activeView]);

  return {
    homeCurrentLineupDraft,
    currentMatchdayLineupDrafts,
    currentMatchdayRequiredLineupSlots,
    isCurrentMatchdayLineupComplete,
    aiLineupMissingTeamIds,
    activeManagerLineupReady,
    activeManagerLineupSubmitted,
    homeNextMatchdayStatus,
    matchdaySummaryOptions,
    activeMatchdaySummaryId,
    matchdaySummary,
    activeTeamMatchdaySummaryRow,
    ensureAiLineupsForCurrentMatchday,
  };
}
