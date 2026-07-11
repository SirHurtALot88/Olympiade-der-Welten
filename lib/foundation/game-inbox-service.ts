import type { GameFlowState, GameFlowStep } from "@/lib/foundation/game-flow-controller";
import { buildTeamPlayerTrainingLoadPlans, type AiTeamTrainingIntensity } from "@/lib/ai/ai-player-training-load-service";
import type {
  GameInboxItem,
  GameInboxSeverity,
  GameInboxStatus,
  GameState,
  Player,
  RosterEntry,
  Team,
  TeamControlSettings,
} from "@/lib/data/olyDataTypes";
import { getInjuryRiskPercent, getPlayerAvailabilityView } from "@/lib/fatigue/fatigue-injury-service";
import { buildTeamControlSettingsMap, DEFAULT_ACTIVE_OWNER_ID, getTeamOwner } from "@/lib/foundation/team-control-settings";
import { FACILITY_CATALOG } from "@/lib/facilities/facility-catalog";
import { calculateFacilityIncome, calculateFacilityUpkeep, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { FACILITY_CONDITION_WARNING, getFacilityConditionStatus } from "@/lib/facilities/facility-condition";
import { buildBeliebtheitLeagueContext, computeTeamBeliebtheit } from "@/lib/economy/team-beliebtheit";
import { buildTeamObjectiveOverview } from "@/lib/board/team-season-objectives-service";
import { buildMatchdaySummary } from "@/lib/foundation/matchday-summary";
import { formatCockpitReason } from "@/lib/foundation/tabs/cockpit-ui-helpers";
import { getFormCardFlowStatus } from "@/lib/foundation/form-card-flow";
import { buildFormCardSeasonUsageAudit } from "@/lib/lineups/legacy-lineup-modifiers";
import { isTeamMatchdayLineupComplete, isTeamMatchdayLineupSubmitted } from "@/lib/foundation/matchday-lineup-readiness";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import { listOpenSponsorEvents } from "@/lib/sponsor/sponsor-event-service";
import { getTransferWindowStatus } from "@/lib/market/transfer-window-policy";
import { hasPersistedTeamCaptain } from "@/lib/morale/team-captain-service";

export type GameInboxTargetView =
  | "home"
  | "season"
  | "cockpit"
  | "lineup"
  | "matchdayArena"
  | "matchdayResult"
  | "teams"
  | "training"
  | "prize"
  | "market"
  | "history"
  | "teamSettings"
  | "admin";

export type BuildGameInboxInput = {
  gameState: GameState;
  saveId: string;
  activeTeamId?: string | null;
  activeOwnerId?: string | null;
  hostMode?: boolean;
  gameFlowState?: GameFlowState | null;
  now?: string;
};

export type GameInboxFilter = {
  teamId?: string | "ALL" | null;
  category?: string | "ALL" | null;
  includeDone?: boolean;
  includeDismissed?: boolean;
};

type OptionalRoomFlowState = {
  step?: string;
  requiredParticipantIds?: string[];
  completedParticipantIds?: string[];
};

function normalizeStatus(value: string | null | undefined): GameInboxStatus {
  return value === "done" || value === "dismissed" ? value : "open";
}

function severityRank(severity: GameInboxSeverity) {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function formatInboxDetail(value: string | null | undefined) {
  if (!value) {
    return "—";
  }
  return formatCockpitReason(value);
}

function parseProgressionInboxDescription(description: string) {
  const upgradesMatch = description.match(/(\d+) Upgrade\(s\)/);
  const xpMatch = description.match(/(\d+) XP ausgegeben/);
  return {
    upgrades: upgradesMatch ? Number(upgradesMatch[1]) : 0,
    xpSpent: xpMatch ? Number(xpMatch[1]) : 0,
  };
}

const INBOX_CHRONICLE_ONLY_SOURCES = new Set([
  "player_progression_events",
  "facility_events",
  "cash_prize_apply_logs",
  "matchday_results",
  "season_snapshots",
  "transfer_history",
]);

export function isGameInboxChronicleOnlySource(source: string) {
  return INBOX_CHRONICLE_ONLY_SOURCES.has(source) || source.startsWith("story:");
}

export function groupInboxItemsForDisplay(items: GameInboxItem[]) {
  const groupedProgression = new Map<string, GameInboxItem[]>();
  const groupedFacilities = new Map<string, GameInboxItem[]>();
  const passthrough: GameInboxItem[] = [];

  for (const item of items) {
    if (item.source === "player_progression_events") {
      const key = `${item.teamId ?? "global"}:${item.seasonId ?? "season"}`;
      const bucket = groupedProgression.get(key) ?? [];
      bucket.push(item);
      groupedProgression.set(key, bucket);
      continue;
    }
    if (item.source === "facility_events") {
      const key = `${item.teamId ?? "global"}:${item.seasonId ?? "season"}`;
      const bucket = groupedFacilities.get(key) ?? [];
      bucket.push(item);
      groupedFacilities.set(key, bucket);
      continue;
    }
    passthrough.push(item);
  }

  const result = [...passthrough];

  for (const [key, group] of groupedProgression) {
    if (group.length === 1) {
      result.push(group[0]!);
      continue;
    }
    const totals = group.reduce(
      (summary, item) => {
        const parsed = parseProgressionInboxDescription(item.description);
        return {
          upgrades: summary.upgrades + parsed.upgrades,
          xpSpent: summary.xpSpent + parsed.xpSpent,
        };
      },
      { upgrades: 0, xpSpent: 0 },
    );
    const template = [...group].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0]!;
    result.push({
      ...template,
      itemId: `grouped:player_progression_events:${key}`,
      title: `${group.length} XP-Upgrades durchgeführt`,
      description: `${group.length} Spieler · ${totals.upgrades} Upgrade(s) · ${totals.xpSpent} XP ausgegeben.`,
      createdAt: template.createdAt,
    });
  }

  for (const [key, group] of groupedFacilities) {
    if (group.length === 1) {
      result.push(group[0]!);
      continue;
    }
    const template = [...group].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0]!;
    const facilityLabels = group
      .map((item) => item.description.replace(/: Level .+$/, ""))
      .slice(0, 3)
      .join(" · ");
    result.push({
      ...template,
      itemId: `grouped:facility_events:${key}`,
      title: `${group.length} Facility-Events`,
      description: `${group.length} Upgrades: ${facilityLabels}${group.length > 3 ? " · …" : ""}.`,
      createdAt: template.createdAt,
    });
  }

  return result.sort((left, right) => {
    const statusDelta = (left.status === "open" ? 0 : 1) - (right.status === "open" ? 0 : 1);
    if (statusDelta !== 0) return statusDelta;
    const severityDelta = severityRank(left.severity) - severityRank(right.severity);
    if (severityDelta !== 0) return severityDelta;
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}

function getStoredStatusMap(gameState: GameState) {
  return new Map((gameState.gameInboxItems ?? []).map((item) => [item.itemId, normalizeStatus(item.status)] as const));
}

function withStoredStatus(item: GameInboxItem, storedStatusById: Map<string, GameInboxStatus>): GameInboxItem {
  return {
    ...item,
    status: storedStatusById.get(item.itemId) ?? item.status,
  };
}

function resolvePlayerDisplayName(gameState: GameState, playerId: string) {
  return gameState.players.find((player) => player.id === playerId)?.name ?? playerId;
}

function createItem(
  input: Omit<GameInboxItem, "saveId" | "seasonId" | "createdAt" | "status"> & {
    saveId: string;
    seasonId: string;
    createdAt: string;
    status?: GameInboxStatus;
  },
): GameInboxItem {
  return {
    ...input,
    status: input.status ?? "open",
  };
}

function getVisibleTeamIds(input: BuildGameInboxInput, settingsMap: Record<string, TeamControlSettings>) {
  if (input.hostMode) {
    return new Set(input.gameState.teams.map((team) => team.teamId));
  }

  const activeOwnerId = input.activeOwnerId ?? DEFAULT_ACTIVE_OWNER_ID;
  const scenarioOwnership = input.gameState.scenarioMeta?.teamOwnership ?? [];
  if (scenarioOwnership.length > 0) {
    const ownedByScenario = scenarioOwnership
      .filter((ownership) => {
        if (activeOwnerId === DEFAULT_ACTIVE_OWNER_ID) {
          return ownership.userId === "user_chris" || ownership.ownerDisplayName === "Chris";
        }
        if (activeOwnerId === "franky_remote_placeholder") {
          return ownership.userId === "user_franky" || ownership.ownerDisplayName === "Franky";
        }
        if (activeOwnerId === "ai") {
          return ownership.controllerType === "ai";
        }
        return ownership.userId === activeOwnerId || ownership.participantId === activeOwnerId;
      })
      .map((ownership) => ownership.teamId);
    if (ownedByScenario.length > 0) {
      return new Set(ownedByScenario);
    }
  }

  return new Set(
    input.gameState.teams
      .filter((team) => getTeamOwner(settingsMap[team.teamId]) === activeOwnerId)
      .map((team) => team.teamId),
  );
}

function getTeamRosterPlayerIds(gameState: GameState, teamId: string) {
  return gameState.rosters.filter((entry) => entry.teamId === teamId).map((entry) => entry.playerId);
}

function getPlayerName(gameState: GameState, playerId: string) {
  return gameState.players.find((player) => player.id === playerId)?.name ?? playerId;
}

function getTeamLabel(gameState: GameState, teamId: string | null | undefined) {
  if (!teamId) return "—";
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  return team?.shortCode ?? team?.name ?? teamId;
}

function teamTrainingMissingCount(gameState: GameState, teamId: string) {
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  return getTeamRosterPlayerIds(gameState, teamId).filter((playerId) => playersById.get(playerId)?.trainingMode == null).length;
}

function resolveTeamTrainingBaselineIntensity(gameState: GameState, teamId: string): AiTeamTrainingIntensity {
  const settings = gameState.seasonState.aiManagerTrainingSettings?.[teamId];
  if (settings?.trainingIntensity === "light") return "light";
  if (settings?.trainingIntensity === "hard") return "hard";
  return "normal";
}

function buildPlayerHealthInboxTasks(input: {
  saveId: string;
  gameState: GameState;
  team: Team;
  roster: RosterEntry[];
  playerById: Map<string, Player>;
  controlMode: string;
  createdAt: string;
}) {
  if (input.controlMode !== "manual") {
    return [] as GameInboxItem[];
  }

  const items: GameInboxItem[] = [];
  const matchdayId = input.gameState.matchdayState.matchdayId;
  const seasonId = input.gameState.season.id;
  const teamBaselineIntensity = resolveTeamTrainingBaselineIntensity(input.gameState, input.team.teamId);
  const trainingPlans = buildTeamPlayerTrainingLoadPlans({
    gameState: input.gameState,
    teamId: input.team.teamId,
    teamBaselineIntensity,
  });
  const lineupRestPlayerIds = new Set<string>();

  for (const entry of input.roster) {
    const player = input.playerById.get(entry.playerId);
    if (!player) continue;

    const availability = getPlayerAvailabilityView(
      input.gameState,
      entry.playerId,
      input.team.teamId,
      matchdayId,
    );

    if (availability.isUnavailable && availability.injuryStatus === "injured") {
      items.push(
        createItem({
          itemId: `player_injured:${input.saveId}:${seasonId}:${matchdayId}:${input.team.teamId}:${entry.playerId}`,
          saveId: input.saveId,
          seasonId,
          matchday: matchdayId,
          teamId: input.team.teamId,
          playerId: entry.playerId,
          category: "warning",
          severity: "critical",
          title: "Verletzter Spieler",
          description: `${getPlayerName(input.gameState, entry.playerId)} fehlt${availability.injuryUntilMatchday ? ` bis ${availability.injuryUntilMatchday}` : ""}.`,
          targetView: "lineup",
          targetParams: { team: input.team.teamId, player: entry.playerId },
          ctaLabel: "Lineup prüfen",
          source: "player_health_injury",
          createdAt: input.createdAt,
        }),
      );
      continue;
    }

    const fatigue = player.fatigue ?? availability.fatigue ?? 0;
    const riskPercent = getInjuryRiskPercent(fatigue);
    if (fatigue >= 70 || riskPercent >= 15) {
      items.push(
        createItem({
          itemId: `player_fatigue_risk:${input.saveId}:${seasonId}:${input.team.teamId}:${entry.playerId}`,
          saveId: input.saveId,
          seasonId,
          matchday: matchdayId,
          teamId: input.team.teamId,
          playerId: entry.playerId,
          category: "training",
          severity: fatigue >= 80 || riskPercent >= 25 ? "critical" : "warning",
          title: fatigue >= 80 || riskPercent >= 25 ? "Hohes Verletzungsrisiko" : "Ermüdung beobachten",
          description: `${getPlayerName(input.gameState, entry.playerId)}: Fatigue ${Math.round(fatigue)}, Verletzungsrisiko ${riskPercent}%.`,
          targetView: "training",
          targetParams: { team: input.team.teamId, player: entry.playerId },
          ctaLabel: "Training prüfen",
          source: "player_health_fatigue_risk",
          createdAt: input.createdAt,
        }),
      );
    }
  }

  for (const plan of trainingPlans) {
    if (plan.needsLineupRest && !lineupRestPlayerIds.has(plan.playerId)) {
      lineupRestPlayerIds.add(plan.playerId);
      items.push(
        createItem({
          itemId: `player_lineup_rest:${input.saveId}:${seasonId}:${matchdayId}:${input.team.teamId}:${plan.playerId}`,
          saveId: input.saveId,
          seasonId,
          matchday: matchdayId,
          teamId: input.team.teamId,
          playerId: plan.playerId,
          category: "warning",
          severity: "warning",
          title: "Spielpause empfohlen",
          description: `${plan.playerName}: hohe Belastung — für den nächsten Spieltag pausieren.`,
          targetView: "lineup",
          targetParams: { team: input.team.teamId, player: plan.playerId },
          ctaLabel: "Lineup prüfen",
          source: "player_health_lineup_rest",
          createdAt: input.createdAt,
        }),
      );
    }

    if (
      plan.trainingDemandPreferred === "hart" &&
      (plan.currentFatigue >= 55 || plan.currentInjuryRiskPercent >= 10)
    ) {
      items.push(
        createItem({
          itemId: `player_training_load:${input.saveId}:${seasonId}:${input.team.teamId}:${plan.playerId}`,
          saveId: input.saveId,
          seasonId,
          matchday: matchdayId,
          teamId: input.team.teamId,
          playerId: plan.playerId,
          category: "training",
          severity: plan.projectedInjuryRiskPercent >= 20 ? "warning" : "info",
          title: "Hard-Training vs. Erholung",
          description: `${plan.playerName}: Hard-Demand unter Belastung (Fatigue ${Math.round(plan.currentFatigue)}, Modus ${plan.selectedMode}).`,
          targetView: "training",
          targetParams: { team: input.team.teamId, player: plan.playerId },
          ctaLabel: "Training steuern",
          source: "player_health_training_load",
          createdAt: input.createdAt,
        }),
      );
    }
  }

  return items;
}

function buildFlowItem(input: BuildGameInboxInput, createdAt: string): GameInboxItem | null {
  const step = input.gameFlowState?.currentStep;
  if (!step) return null;
  return createItem({
    itemId: `flow:${input.saveId}:${input.gameState.season.id}:${step.stepId}:${step.teamId ?? "global"}`,
    saveId: input.saveId,
    seasonId: input.gameState.season.id,
    matchday: input.gameState.matchdayState.matchdayId,
    teamId: step.teamId ?? input.activeTeamId ?? null,
    category: step.status === "blocked" ? "warning" : "task",
    severity: step.status === "blocked" ? "critical" : step.status === "warning" ? "warning" : "info",
    title: step.label,
    description: formatInboxDetail(step.blockers[0] ?? step.warnings[0] ?? step.cta),
    targetView: step.targetView,
    targetParams: {
      team: step.teamId ?? input.activeTeamId ?? null,
      panel: step.targetPanel ?? null,
    },
    source: "game_flow_controller",
    createdAt,
  });
}

function buildTeamTasks(input: BuildGameInboxInput, visibleTeamIds: Set<string>, createdAt: string) {
  const items: GameInboxItem[] = [];
  const settingsMap = buildTeamControlSettingsMap(input.gameState.teams, input.gameState.seasonState.teamControlSettings);
  const playerById = new Map(input.gameState.players.map((player) => [player.id, player] as const));
  // Einmalig für die Liga: Beliebtheit skaliert die Arena-Einnahme in der
  // Cash-Risiko-Vorschau (konsistent zur echten Season-End-Resolution).
  const beliebtheitContext = buildBeliebtheitLeagueContext(input.gameState);

  for (const team of input.gameState.teams) {
    if (!visibleTeamIds.has(team.teamId)) continue;

    const controlMode = settingsMap[team.teamId]?.controlMode ?? (team.humanControlled ? "manual" : "ai");
    const roster = input.gameState.rosters.filter((entry) => entry.teamId === team.teamId);
    const rosterCount = roster.length;
    const rosterOptTarget = team.rosterOptTarget ?? team.rosterLimit ?? 12;
    const rosterMinTarget = team.rosterMinTarget ?? Math.max(10, rosterOptTarget - 2);
    const lineupDraft =
      (input.gameState.seasonState.lineupDrafts ?? []).find(
        (draft) =>
          draft.seasonId === input.gameState.season.id &&
          draft.matchdayId === input.gameState.matchdayState.matchdayId &&
          draft.teamId === team.teamId,
      ) ?? null;
    const lineupStatus = {
      hasLineup: isTeamMatchdayLineupComplete(input.gameState, team.teamId, lineupDraft),
      isSubmitted: isTeamMatchdayLineupSubmitted(lineupDraft),
    };
    if (rosterCount > 0 && !lineupStatus.hasLineup && controlMode === "manual") {
      items.push(
        createItem({
          itemId: `lineup_missing:${input.saveId}:${input.gameState.season.id}:${input.gameState.matchdayState.matchdayId}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          matchday: input.gameState.matchdayState.matchdayId,
          teamId: team.teamId,
          category: "task",
          severity: team.teamId === input.activeTeamId ? "critical" : "warning",
          title: "Lineup fehlt",
          description: `${team.shortCode}: Einsatzliste für ${input.gameState.matchdayState.matchdayId} ist noch leer.`,
          targetView: "lineup",
          targetParams: { team: team.teamId },
          ctaLabel: "Lineup öffnen",
          source: "lineup_drafts",
          createdAt,
        }),
      );
    }

    const lineupComplete = lineupStatus.hasLineup;
    if (rosterCount > 0 && lineupComplete && !lineupStatus.isSubmitted && controlMode === "manual") {
      items.push(
        createItem({
          itemId: `lineup_not_submitted:${input.saveId}:${input.gameState.season.id}:${input.gameState.matchdayState.matchdayId}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          matchday: input.gameState.matchdayState.matchdayId,
          teamId: team.teamId,
          category: "task",
          severity: team.teamId === input.activeTeamId ? "critical" : "warning",
          title: "Lineup bestätigen",
          description: `${team.shortCode}: Einsatzliste ist voll, aber noch nicht bestätigt.`,
          targetView: "lineup",
          targetParams: { team: team.teamId },
          ctaLabel: "Lineup bestätigen",
          source: "lineup_drafts",
          createdAt,
        }),
      );
    }
    const formCardFlow = getFormCardFlowStatus(input.gameState, team.teamId);
    if (rosterCount > 0 && lineupComplete && !formCardFlow.hasPool && controlMode === "manual") {
      items.push(
        createItem({
          itemId: `formcards_open:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          matchday: input.gameState.matchdayState.matchdayId,
          teamId: team.teamId,
          category: "task",
          severity: "warning",
          title: "Formkarten-Pool fehlt",
          description: `${team.shortCode}: Formkarten fuer diese Saison muessen noch in der Einsatzliste erzeugt werden.`,
          targetView: "lineup",
          targetParams: { team: team.teamId, panel: "formcards" },
          ctaLabel: "Formkarten erzeugen",
          source: "season_formcards",
          createdAt,
        }),
      );
    }

    if (
      controlMode === "manual" &&
      rosterCount >= rosterMinTarget &&
      lineupComplete &&
      !hasPersistedTeamCaptain(input.gameState, team.teamId)
    ) {
      items.push(
        createItem({
          itemId: `captain_missing:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          category: "task",
          severity: team.teamId === input.activeTeamId ? "warning" : "info",
          title: "Kapitän ernennen",
          description: `${team.shortCode}: Kader ist vollständig — wähle einen Saison-Kapitän für Moral-Bonus.`,
          targetView: "home",
          targetParams: { team: team.teamId, panel: "captain-picker" },
          ctaLabel: "Kapitän wählen",
          source: "team_captain_missing",
          createdAt,
        }),
      );
    }

    const formCardUsageAudit = buildFormCardSeasonUsageAudit(input.gameState, input.gameState.season.id).rows.find(
      (row) => row.teamId === team.teamId,
    );
    if (controlMode === "manual" && (formCardUsageAudit?.unusedNegativeCards ?? 0) > 0) {
      items.push(
        createItem({
          itemId: `formcards_negative_open:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          matchday: input.gameState.matchdayState.matchdayId,
          teamId: team.teamId,
          category: "task",
          severity: "warning",
          title: "Negative Formkarten offen",
          description: `${team.shortCode}: ${formCardUsageAudit!.unusedNegativeCards} negative Karte(n) ungenutzt — am Saisonende drohen ${formCardUsageAudit!.negativePenaltyPoints} Strafpunkte.`,
          targetView: "lineup",
          targetParams: { team: team.teamId, panel: "formcards" },
          ctaLabel: "Formkarten pruefen",
          source: "season_formcards",
          createdAt,
        }),
      );
    }

    if (controlMode === "manual" && !getTeamSponsorContract(input.gameState, team.teamId)) {
      items.push(
        createItem({
          itemId: `sponsor_choice_missing:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          category: "sponsor",
          severity: "warning",
          title: "Sponsor wählen",
          description: `${team.shortCode}: Wähle einen von drei Sponsor-Verträgen für die Saison.`,
          targetView: "teams",
          targetParams: { team: team.teamId, panel: "sponsor-choice" },
          ctaLabel: "Sponsor wählen",
          source: "sponsor_v2_choice_pending",
          createdAt,
        }),
      );
    }

    for (const event of listOpenSponsorEvents(input.gameState, team.teamId)) {
      if (controlMode !== "manual") {
        continue;
      }
      items.push(
        createItem({
          itemId: event.eventId,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          category: "sponsor",
          severity: event.cashDelta >= 0 ? "info" : "warning",
          title: event.eventType === "activation_bonus" ? "Sponsor-Aktion" : "Sponsor-Ereignis",
          description: event.message,
          targetView: "teams",
          targetParams: { team: team.teamId, panel: "sponsor-choice", sponsorEventId: event.eventId },
          ctaLabel: event.cashDelta >= 0 ? "Bonus annehmen" : "Ereignis prüfen",
          source: `sponsor_event:${event.eventType}`,
          createdAt: event.createdAt,
        }),
      );
    }

    const missingTraining = teamTrainingMissingCount(input.gameState, team.teamId);
    if (missingTraining > 0 && controlMode === "manual") {
      items.push(
        createItem({
          itemId: `training_missing:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          category: "training",
          severity: "warning",
          title: "Training nicht gesetzt",
          description: `${team.shortCode}: ${missingTraining} Spieler ohne Trainingsmodus.`,
          targetView: "trainingV2",
          targetParams: { team: team.teamId, panel: "training-plan" },
          ctaLabel: "Training öffnen",
          source: "player_training_mode",
          createdAt,
        }),
      );
    }

    const xpPlayers = roster
      .map((entry) => playerById.get(entry.playerId))
      .filter((player) => (player?.currentXP ?? 0) > 0);
    if (xpPlayers.length > 0) {
      items.push(
        createItem({
          itemId: `xp_available:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          category: "training",
          severity: "info",
          title: "XP verfügbar",
          description: `${team.shortCode}: ${xpPlayers.length} Spieler können entwickelt werden.`,
          targetView: "trainingV2",
          targetParams: { team: team.teamId, panel: "season-end-development" },
          ctaLabel: "XP ausgeben",
          source: "player_current_xp",
          createdAt,
        }),
      );
    }

    const expiring = roster.filter(
      (entry) => (entry.contractLength ?? 0) <= 1 || entry.contractStatus === "expiring" || entry.contractStatus === "renewal_pending",
    );
    if (expiring.length > 0) {
      items.push(
        createItem({
          itemId: `contracts_expiring:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          category: "contract",
          severity: "warning",
          title: "Verträge laufen aus",
          description: `${team.shortCode}: ${expiring.length} Vertrag(e) brauchen Entscheidung.`,
          targetView: "teams",
          targetParams: { team: team.teamId, panel: "contracts" },
          ctaLabel: "Kader verwalten",
          source: "roster_contracts",
          createdAt,
        }),
      );
    }

    const transferWindowOpen = getTransferWindowStatus(input.gameState).open;
    const sellCandidates: Array<{ entry: typeof roster[number]; player: NonNullable<ReturnType<typeof playerById.get>>; profit: number; isExpiring: boolean }> = [];
    for (const entry of roster) {
        const player = playerById.get(entry.playerId);
        if (!player) continue;
        const purchase = entry.purchasePrice ?? player?.marketValue ?? 0;
        const current = entry.currentValue ?? player?.displayMarketValue ?? player?.marketValue ?? 0;
        const profit = current - purchase;
        const isExpiring = (entry.contractLength ?? 0) <= 1 || entry.contractStatus === "expiring" || entry.contractStatus === "renewal_pending";
        const pressureScore = (team.cash < 0 ? 2 : 0) + (profit >= 8 || current >= purchase * 1.2 ? 1 : 0) + (isExpiring ? 1 : 0);
        if (pressureScore >= 2) {
          sellCandidates.push({ entry, player, profit, isExpiring });
        }
    }
    const sellCandidate = sellCandidates.sort((left, right) => right.profit - left.profit)[0];
    if (transferWindowOpen && sellCandidate) {
      items.push(
        createItem({
          itemId: `transfer_candidate:${input.saveId}:${input.gameState.season.id}:${team.teamId}:${sellCandidate.entry.playerId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          playerId: sellCandidate.entry.playerId,
          category: "transfer",
          severity: team.cash < 0 ? "critical" : "warning",
          title: "Spieler verkaufen",
          description: `${sellCandidate.player.name}: ${sellCandidate.profit >= 0 ? "+" : ""}${sellCandidate.profit.toFixed(1)} MW-Puffer${sellCandidate.isExpiring ? ", Vertrag läuft aus" : ""}.`,
          targetView: "teams",
          targetParams: { team: team.teamId, player: sellCandidate.entry.playerId, panel: "roster" },
          ctaLabel: "Spieler prüfen",
          source: "roster_value_contract_cash",
          createdAt,
        }),
      );
    }

    if (transferWindowOpen && rosterCount > 0 && rosterCount < rosterOptTarget && team.cash >= 8) {
      items.push(
        createItem({
          itemId: `transfer_buy_candidate:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          category: "transfer",
          severity: rosterCount < rosterMinTarget ? "warning" : "info",
          title: "Spieler kaufen",
          description: `${team.shortCode}: Kader ${rosterCount}/${team.rosterLimit} (Ziel ${rosterOptTarget}), Cash ${team.cash.toFixed(1)} — Transfermarkt prüfen.`,
          targetView: "market",
          targetParams: { team: team.teamId },
          ctaLabel: "Transfermarkt öffnen",
          source: "roster_cash_transfer_window",
          createdAt,
        }),
      );
    }

    const facilities = getTeamFacilityState(input.gameState, team.teamId);
    const wornFacility = FACILITY_CATALOG.map((facility) => {
      const state = facilities.facilities[facility.facilityId];
      return {
        facility,
        conditionPct: state?.conditionPct ?? 0,
        level: state?.level ?? 0,
      };
    }).find((entry) => entry.level > 0 && entry.conditionPct < FACILITY_CONDITION_WARNING);
    if (wornFacility) {
      const status = getFacilityConditionStatus(wornFacility.conditionPct);
      items.push(
        createItem({
          itemId: `facility_condition_low:${input.saveId}:${input.gameState.season.id}:${team.teamId}:${wornFacility.facility.facilityId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          category: "facility",
          severity: status === "critical" || status === "broken" ? "critical" : "warning",
          title: "Gebäude-Zustand kritisch",
          description: `${team.shortCode}: ${wornFacility.facility.label} ist bei ${wornFacility.conditionPct}% und verliert Leistung.`,
          targetView: "trainingV2",
          targetParams: { team: team.teamId, panel: "facilities" },
          ctaLabel: "Gebäude prüfen",
          source: "facility_condition_forecast",
          createdAt,
        }),
      );
    }
    const upkeep = calculateFacilityUpkeep(facilities);
    const income = calculateFacilityIncome(facilities, {
      arenaPopularityFactor: computeTeamBeliebtheit(team.teamId, beliebtheitContext).value,
    });
    if (upkeep > 0 && team.cash + income - upkeep < 0) {
      items.push(
        createItem({
          itemId: `facility_upkeep_risk:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          category: "facility",
          severity: "critical",
          title: "Facility-Unterhalt gefährdet",
          description: `${team.shortCode}: Cash reicht nach Facility-Netto voraussichtlich nicht.`,
          targetView: "trainingV2",
          targetParams: { team: team.teamId, panel: "facilities" },
          ctaLabel: "Gebäude prüfen",
          source: "facility_finance_forecast",
          createdAt,
        }),
      );
    }

    const hasAffordableUpgrade = FACILITY_CATALOG.some((facility) => {
      const current = facilities.facilities[facility.facilityId]?.level ?? 0;
      const next = facility.levels.find((level) => level.level === current + 1);
      return next != null && team.cash >= next.upgradeCost;
    });
    if (hasAffordableUpgrade) {
      items.push(
        createItem({
          itemId: `facility_upgrade_possible:${input.saveId}:${input.gameState.season.id}:${team.teamId}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId: team.teamId,
          category: "facility",
          severity: "info",
          title: "Facility Upgrade möglich",
          description: `${team.shortCode}: Mindestens ein Gebäude kann geprüft werden.`,
          targetView: "trainingV2",
          targetParams: { team: team.teamId, panel: "facilities" },
          ctaLabel: "Gebäude upgraden",
          source: "facility_catalog_cash_check",
          createdAt,
        }),
      );
    }

    items.push(
      ...buildPlayerHealthInboxTasks({
        saveId: input.saveId,
        gameState: input.gameState,
        team,
        roster,
        playerById,
        controlMode,
        createdAt,
      }),
    );
  }

  const objectiveOverview = buildTeamObjectiveOverview(input.gameState);
  for (const objective of objectiveOverview.objectives) {
    if (!visibleTeamIds.has(objective.teamId)) continue;
    if (objective.status !== "at_risk" && objective.status !== "failed") continue;
    items.push(
      createItem({
        itemId: `board_objective_${objective.status}:${input.saveId}:${objective.seasonId}:${objective.teamId}:${objective.objectiveId}`,
        saveId: input.saveId,
        seasonId: objective.seasonId,
        teamId: objective.teamId,
        category: "task",
        severity: objective.status === "failed" ? "critical" : "warning",
        title: objective.status === "failed" ? "Board-Ziel verfehlt" : "Board-Ziel gefährdet",
        description: `${objective.label}: ${objective.currentValue ?? "—"} / Ziel ${objective.targetValue ?? "—"}`,
        targetView: "teams",
        targetParams: { team: objective.teamId, panel: "board-objectives" },
        source: "team_season_objectives",
        createdAt,
      }),
    );
  }

  for (const teamId of visibleTeamIds) {
    const intelEntries = (input.gameState.seasonState.scoutIntelByTeamId?.[teamId] ?? []).filter(
      (entry) => entry.seasonId === input.gameState.season.id,
    );
    for (const entry of intelEntries) {
      const milestone = entry.certainty >= 75 ? 75 : entry.certainty >= 50 ? 50 : entry.certainty >= 25 ? 25 : null;
      if (milestone == null) continue;
      items.push(
        createItem({
          itemId: `scout_milestone:${input.saveId}:${input.gameState.season.id}:${teamId}:${entry.playerId}:${milestone}`,
          saveId: input.saveId,
          seasonId: input.gameState.season.id,
          teamId,
          playerId: entry.playerId,
          category: "transfer",
          severity: "info",
          title: "Scouting-Fortschritt",
          description: `${resolvePlayerDisplayName(input.gameState, entry.playerId)}: Certainty ${entry.certainty}% — Intel wird schärfer.`,
          targetView: "market",
          targetParams: { team: teamId, player: entry.playerId },
          source: "scout_intel_pipeline",
          createdAt,
        }),
      );
    }
  }

  return items;
}

function buildGlobalTasks(input: BuildGameInboxInput, createdAt: string) {
  const items: GameInboxItem[] = [];
  const seasonId = input.gameState.season.id;
  const matchdayId = input.gameState.matchdayState.matchdayId;
  const matchdayResult = (input.gameState.seasonState.matchdayResults ?? []).find(
    (result) => result.seasonId === seasonId && result.matchdayId === matchdayId,
  );

  if (matchdayResult) {
    items.push(
      createItem({
        itemId: `matchday_result_available:${input.saveId}:${seasonId}:${matchdayId}`,
        saveId: input.saveId,
        seasonId,
        matchday: matchdayId,
        category: "result",
        severity: "info",
        title: "Spieltagsergebnis verfügbar",
        description: `${matchdayId}: Ergebnis kann angesehen werden.`,
        targetView: "matchdayArena",
        targetParams: { matchday: matchdayId, panel: "arena-result-summary" },
        source: "matchday_results",
        createdAt,
      }),
    );
  }

  if (input.gameState.gamePhase === "season_completed" || input.gameState.gamePhase === "season_review") {
    items.push(
      createItem({
        itemId: `season_review_available:${input.saveId}:${seasonId}`,
        saveId: input.saveId,
        seasonId,
        category: "result",
        severity: "critical",
        title: "Season Review verfügbar",
        description: `${seasonId} ist abgeschlossen. Saisonrückblick prüfen.`,
        targetView: "cockpit",
        targetParams: { panel: "season-review" },
        source: "game_phase",
        createdAt,
      }),
    );
  }

  if (input.gameState.gamePhase && input.gameState.gamePhase !== "season_active") {
    items.push(
      createItem({
        itemId: `preseason_step_open:${input.saveId}:${seasonId}:${input.gameState.gamePhase}`,
        saveId: input.saveId,
        seasonId,
        category: "task",
        severity: "warning",
        title: "Pre-Season Schritt offen",
        description: `Aktuelle Phase: ${input.gameState.gamePhase}.`,
        targetView: "cockpit",
        targetParams: { phase: input.gameState.gamePhase },
        source: "game_phase",
        createdAt,
      }),
    );
  }

  const flow = (input.gameFlowState as (GameFlowState & { roomFlowState?: OptionalRoomFlowState }) | null | undefined)?.roomFlowState;
  const requiredParticipantIds = flow?.requiredParticipantIds ?? [];
  const completedParticipantIds = flow?.completedParticipantIds ?? [];
  if (flow && requiredParticipantIds.length > completedParticipantIds.length) {
    const missing = requiredParticipantIds.filter((id) => !completedParticipantIds.includes(id));
    items.push(
      createItem({
        itemId: `room_waiting:${input.saveId}:${seasonId}:${flow.step ?? "unknown"}:${missing.join("-")}`,
        saveId: input.saveId,
        seasonId,
        matchday: matchdayId,
        category: "task",
        severity: "warning",
        title: "Mitspieler wartet / Ready fehlt",
        description: `${missing.length} Participant(s) fehlen im Step ${flow.step ?? "unknown"}.`,
        targetView: "cockpit",
        targetParams: { step: flow.step ?? "unknown" },
        source: "room_flow_state",
        createdAt,
      }),
    );
  }

	  for (const log of input.gameState.seasonState.preSeasonWorkflowLogs ?? []) {
	    const workflowText = [...log.errors, ...log.warnings, ...log.affectedEntities].join(" ");
	    if (/blocked|timeout|failed|error/i.test(log.status ?? "") || /blocked|timeout|failed|error/i.test(workflowText)) {
	      items.push(
	        createItem({
	          itemId: `ai_blocker:${input.saveId}:${log.logId}`,
	          saveId: input.saveId,
	          seasonId: log.toSeasonId ?? seasonId,
	          category: "warning",
	          severity: "critical",
	          title: "AI/Workflow Blocker",
	          description: `${log.stepId}: ${log.errors[0] ?? log.warnings[0] ?? log.status}`,
	          targetView: "cockpit",
	          targetParams: { step: log.stepId },
	          source: "preseason_workflow_logs",
	          createdAt: log.timestamp ?? createdAt,
	        }),
	      );
	    }
  }

  return items;
}

function buildNews(input: BuildGameInboxInput, visibleTeamIds: Set<string>, createdAt: string) {
  const items: GameInboxItem[] = [];
  const seasonId = input.gameState.season.id;
  const teamVisible = (teamId: string | null | undefined) => !teamId || visibleTeamIds.has(teamId) || input.hostMode;

  for (const transfer of input.gameState.transferHistory.slice(-12)) {
    const teamId = transfer.toTeamId ?? transfer.fromTeamId ?? null;
    if (!teamVisible(teamId)) continue;
    items.push(
      createItem({
        itemId: `transfer_news:${input.saveId}:${transfer.id}`,
        saveId: input.saveId,
        seasonId: transfer.seasonId ?? seasonId,
        matchday: transfer.matchdayId ?? null,
        teamId,
        playerId: transfer.playerId,
        category: "transfer",
        severity: "info",
        title: transfer.transferType === "buy" ? "Transfer gekauft" : "Transfer verkauft",
        description: `${transfer.playerId}: ${transfer.fee} Fee, ${transfer.salary} Gehalt.`,
        targetView: "history",
        targetParams: { team: teamId, player: transfer.playerId },
        source: "transfer_history",
        createdAt: transfer.happenedAt ?? createdAt,
      }),
    );
  }

  for (const event of input.gameState.seasonState.facilityEvents ?? []) {
    if (!teamVisible(event.teamId)) continue;
    items.push(
      createItem({
        itemId: `facility_news:${input.saveId}:${event.eventId}`,
        saveId: input.saveId,
        seasonId: event.seasonId ?? seasonId,
        teamId: event.teamId,
        category: "facility",
        severity: "info",
        title: "Facility Event",
        description: `${event.facilityId}: Level ${event.previousLevel} → ${event.nextLevel}.`,
        targetView: "trainingV2",
        targetParams: { team: event.teamId, panel: "facilities" },
        source: "facility_events",
        createdAt: event.timestamp ?? createdAt,
      }),
    );
  }

  for (const event of input.gameState.playerProgressionEvents ?? []) {
    if (!teamVisible(event.teamId)) continue;
    items.push(
      createItem({
        itemId: `progression_news:${input.saveId}:${event.eventId}`,
        saveId: input.saveId,
        seasonId: event.seasonId ?? seasonId,
        teamId: event.teamId,
        playerId: event.playerId,
        category: "training",
        severity: "info",
        title: "XP-Upgrade durchgeführt",
        description: `${event.upgrades.length} Upgrade(s), ${event.xpSpent} XP ausgegeben.`,
        targetView: "trainingV2",
        targetParams: { team: event.teamId, player: event.playerId, panel: "season-end-development" },
        source: "player_progression_events",
        createdAt: event.timestamp ?? createdAt,
      }),
    );
  }

  const latestCompletedSnapshot = [...(input.gameState.seasonState.seasonSnapshots ?? [])]
    .reverse()
    .find((snapshot) => snapshot.status === "completed");
  const champion = latestCompletedSnapshot?.finalStandings?.find((row) => row.rank === 1);
  if (latestCompletedSnapshot && champion) {
    items.push(
      createItem({
        itemId: `champion_news:${input.saveId}:${latestCompletedSnapshot.seasonId}`,
        saveId: input.saveId,
        seasonId: latestCompletedSnapshot.seasonId,
        teamId: champion.teamId,
        category: "news",
        severity: "info",
        title: "Champion gekürt",
        description: `${champion.teamName ?? champion.teamId} gewinnt ${latestCompletedSnapshot.seasonName}.`,
        targetView: "cockpit",
        targetParams: { season: latestCompletedSnapshot.seasonId, panel: "season-review" },
        source: "season_snapshots",
        createdAt: latestCompletedSnapshot.archivedAt ?? createdAt,
      }),
    );
  }

  for (const log of input.gameState.seasonState.cashPrizeApplyLogs ?? []) {
    items.push(
      createItem({
        itemId: `prize_news:${input.saveId}:${log.id}`,
        saveId: input.saveId,
        seasonId: log.seasonId ?? seasonId,
        matchday: log.matchdayId ?? null,
        category: "finance",
        severity: "info",
        title: "Preisgeld angewendet",
        description: `${log.payload?.appliedTeams ?? "—"} Teams, ${log.payload?.totalPrizeMoney ?? "—"} Preisgeld.`,
        targetView: "prize",
        targetParams: { season: log.seasonId },
        source: "cash_prize_apply_logs",
        createdAt: log.createdAt ?? createdAt,
      }),
    );
  }

  const latestResult = [...(input.gameState.seasonState.matchdayResults ?? [])]
    .reverse()
    .find((result) => result.status === "preview_applied" && result.seasonId === seasonId);
  if (latestResult) {
    const summary = buildMatchdaySummary(input.gameState, { seasonId, matchdayId: latestResult.matchdayId });
    const injuryEvents = (input.gameState.seasonState.injuryEvents ?? []).filter(
      (event) => event.seasonId === seasonId && event.matchdayId === latestResult.matchdayId && event.result === "injured",
    );

    for (const teamRow of summary.teamRows.filter((row) => teamVisible(row.teamId))) {
      const topPlayer = summary.topPlayers.find((player) => player.teamId === teamRow.teamId && player.rankInDiscipline === 1);
      const teamInjuries = injuryEvents.filter((event) => event.teamId === teamRow.teamId);
      const rankDetail =
        teamRow.rankDelta != null && teamRow.rankDelta !== 0
          ? `${teamRow.rankDelta > 0 ? "+" : ""}${teamRow.rankDelta} Platz${Math.abs(teamRow.rankDelta) === 1 ? "" : "e"}`
          : "Rang unverändert";
      const mvpDetail = topPlayer ? `MVP: ${topPlayer.playerName} (${topPlayer.disciplineName})` : "Kein MVP-Signal";
      const injuryDetail =
        teamInjuries.length > 0
          ? `${teamInjuries.length} Verletzung(en) nach Belastung`
          : "Keine neuen Verletzungen";

      items.push(
        createItem({
          itemId: `matchday_recap:${input.saveId}:${latestResult.id}:${teamRow.teamId}`,
          saveId: input.saveId,
          seasonId,
          matchday: latestResult.matchdayId,
          teamId: teamRow.teamId,
          category: "result",
          severity: teamInjuries.length > 0 ? "warning" : "info",
          title: `Spieltag-Recap: ${teamRow.teamShortCode}`,
          description: `${latestResult.matchdayId}: ${rankDetail} · ${mvpDetail} · ${injuryDetail}.`,
          targetView: "matchdayArena",
          targetParams: { team: teamRow.teamId, matchday: latestResult.matchdayId, panel: "arena-result-summary" },
          source: "story:matchday_recap",
          createdAt: latestResult.updatedAt ?? createdAt,
        }),
      );
    }

    const mutatorBonusByTeam = new Map<string, number>();
    for (const perf of input.gameState.seasonState.playerDisciplinePerformances ?? []) {
      if (perf.matchdayResultId !== latestResult.id) continue;
      mutatorBonusByTeam.set(perf.teamId, (mutatorBonusByTeam.get(perf.teamId) ?? 0) + (perf.mutatorScoreBonus ?? 0));
    }
    const mutatorSwing = summary.teamRows
      .filter((row) => (row.rankDelta ?? 0) > 0 && (mutatorBonusByTeam.get(row.teamId) ?? 0) > 0 && teamVisible(row.teamId))
      .sort((left, right) => (right.rankDelta ?? 0) - (left.rankDelta ?? 0))[0];
    if (mutatorSwing) {
      items.push(
        createItem({
          itemId: `story_mutator_rank_swing:${input.saveId}:${latestResult.id}:${mutatorSwing.teamId}`,
          saveId: input.saveId,
          seasonId,
          matchday: latestResult.matchdayId,
          teamId: mutatorSwing.teamId,
          category: "news",
          severity: "info",
          title: "Story Card: Mutator kippt den Spieltag",
          description: `${mutatorSwing.teamShortCode} gewinnt dank Mutator-Bonus ${mutatorSwing.rankDelta} Platz/Plätze.`,
          targetView: "matchdayArena",
          targetParams: { team: mutatorSwing.teamId, matchday: latestResult.matchdayId, panel: "arena-result-summary" },
          source: "story:matchday_summary_mutator_bonus",
          createdAt: latestResult.updatedAt ?? createdAt,
        }),
      );
    }

    const fencingWinner = (input.gameState.seasonState.disciplineResults ?? []).find((row) => {
      const disciplineName = input.gameState.disciplines.find((discipline) => discipline.id === row.disciplineId)?.name ?? row.disciplineId;
      return row.matchdayResultId === latestResult.id && row.rank === 1 && row.teamId === "C-S" && /fecht|fenc/i.test(disciplineName);
    });
    if (fencingWinner && teamVisible("C-S")) {
      items.push(
        createItem({
          itemId: `story_cold_steel_fencing:${input.saveId}:${latestResult.id}`,
          saveId: input.saveId,
          seasonId,
          matchday: latestResult.matchdayId,
          teamId: "C-S",
          category: "news",
          severity: "info",
          title: "Story Card: Cold Steel Präzision",
          description: `C-S dominiert ${input.gameState.disciplines.find((discipline) => discipline.id === fencingWinner.disciplineId)?.name ?? fencingWinner.disciplineId} mit Rang 1.`,
          targetView: "matchdayArena",
          targetParams: { team: "C-S", matchday: latestResult.matchdayId, panel: "arena-result-summary" },
          source: "story:discipline_result_rank_1",
          createdAt: latestResult.updatedAt ?? createdAt,
        }),
      );
    }
  }

  const latestSnapshotRows = latestCompletedSnapshot?.finalStandings ?? [];
  const ccRow = latestSnapshotRows.find((row) => row.teamId === "C-C");
  if (latestCompletedSnapshot && ccRow && teamVisible("C-C")) {
    const sortedCash = [...latestSnapshotRows].map((row) => row.cashEnd ?? Number.NEGATIVE_INFINITY).sort((left, right) => right - left);
    const cashTopQuartile = sortedCash[Math.max(0, Math.floor(sortedCash.length / 4) - 1)] ?? Number.POSITIVE_INFINITY;
    if ((ccRow.cashEnd ?? 0) >= cashTopQuartile && (ccRow.rank ?? 99) <= 16) {
      items.push(
        createItem({
          itemId: `story_cash_creators_value:${input.saveId}:${latestCompletedSnapshot.seasonId}`,
          saveId: input.saveId,
          seasonId: latestCompletedSnapshot.seasonId,
          teamId: "C-C",
          category: "news",
          severity: "info",
          title: "Story Card: Cash Creators effizient",
          description: `C-C bleibt reich und sportlich stabil: Rang ${ccRow.rank ?? "—"}, Cash ${ccRow.cashEnd ?? "—"}.`,
          targetView: "season",
          targetParams: { team: "C-C", season: latestCompletedSnapshot.seasonId },
          source: "story:season_snapshot_cash_rank",
          createdAt: latestCompletedSnapshot.archivedAt ?? createdAt,
        }),
      );
    }
  }

  const aaRow = latestSnapshotRows.find((row) => row.teamId === "A-A");
  if (latestCompletedSnapshot && aaRow && teamVisible("A-A") && (aaRow.rank ?? 99) <= 27 && (aaRow.cashEnd ?? 0) >= 0) {
    items.push(
      createItem({
        itemId: `story_armageddon_survival:${input.saveId}:${latestCompletedSnapshot.seasonId}`,
        saveId: input.saveId,
        seasonId: latestCompletedSnapshot.seasonId,
        teamId: "A-A",
        category: "news",
        severity: "info",
        title: "Story Card: Survival geschafft",
        description: `A-A überlebt trotz engem Budget: Rang ${aaRow.rank ?? "—"}, Cash ${aaRow.cashEnd ?? "—"}.`,
        targetView: "season",
        targetParams: { team: "A-A", season: latestCompletedSnapshot.seasonId },
        source: "story:season_snapshot_survival",
        createdAt: latestCompletedSnapshot.archivedAt ?? createdAt,
      }),
    );
  }

  for (const event of (input.gameState.playerProgressionEvents ?? []).slice(-12)) {
    if (!teamVisible(event.teamId)) continue;
    const before = event.progressionSnapshotBefore?.disciplineRatings ?? {};
    const after = event.progressionSnapshotAfter?.disciplineRatings ?? {};
    const improvedCount = Object.entries(after).filter(([disciplineId, value]) => value > (before[disciplineId] ?? value)).length;
    if (improvedCount >= 3) {
      items.push(
        createItem({
          itemId: `story_xp_three_diszis:${input.saveId}:${event.eventId}`,
          saveId: input.saveId,
          seasonId: event.seasonId ?? seasonId,
          teamId: event.teamId,
          playerId: event.playerId,
          category: "news",
          severity: "info",
          title: "Story Card: XP zeigt Wirkung",
          description: `${getPlayerName(input.gameState, event.playerId)} verbessert ${improvedCount} Diszis durch XP.`,
          targetView: "trainingV2",
          targetParams: { team: event.teamId, player: event.playerId, panel: "season-end-development" },
          source: "story:player_progression_discipline_delta",
          createdAt: event.timestamp ?? createdAt,
        }),
      );
    }
  }

  return items;
}

export function buildGameInboxItems(input: BuildGameInboxInput) {
  const createdAt = input.now ?? new Date().toISOString();
  const settingsMap = buildTeamControlSettingsMap(input.gameState.teams, input.gameState.seasonState.teamControlSettings);
  const visibleTeamIds = getVisibleTeamIds(input, settingsMap);
  const storedStatusById = getStoredStatusMap(input.gameState);
  const flowItem = buildFlowItem(input, createdAt);
  const items = [
    ...(flowItem ? [flowItem] : []),
    ...buildTeamTasks(input, visibleTeamIds, createdAt),
    ...buildGlobalTasks(input, createdAt),
    ...buildNews(input, visibleTeamIds, createdAt),
  ].map((item) => withStoredStatus(item, storedStatusById));

  const deduped = Array.from(new Map(items.map((item) => [item.itemId, item])).values());
  return deduped.sort((left, right) => {
    const statusDelta = (left.status === "open" ? 0 : 1) - (right.status === "open" ? 0 : 1);
    if (statusDelta !== 0) return statusDelta;
    const severityDelta = severityRank(left.severity) - severityRank(right.severity);
    if (severityDelta !== 0) return severityDelta;
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}

export function filterGameInboxItems(items: GameInboxItem[], filter: GameInboxFilter) {
  return items.filter((item) => {
    const matchesTeam = !filter.teamId || filter.teamId === "ALL" || item.teamId === filter.teamId || item.teamId == null;
    const matchesCategory = !filter.category || filter.category === "ALL" || item.category === filter.category;
    const matchesDone = filter.includeDone || item.status !== "done";
    const matchesDismissed = filter.includeDismissed || item.status !== "dismissed";
    return matchesTeam && matchesCategory && matchesDone && matchesDismissed;
  });
}

export function getPrimaryInboxTask(items: GameInboxItem[], options?: { focusMatchdayLoop?: boolean }) {
  const severityRank: Record<GameInboxItem["severity"], number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  const sourcePriority: Record<string, number> = {
    player_health_injury: 0,
    player_health_fatigue_risk: 1,
    player_health_lineup_rest: 2,
    player_health_training_load: 3,
    lineup_drafts: 4,
    game_flow_controller: 5,
    team_season_objectives: 6,
    roster_value_contract_cash: 7,
    roster_cash_transfer_window: 8,
    facility_condition_forecast: 9,
    facility_finance_forecast: 10,
  };

  const candidates = items.filter(
    (item) =>
      item.status === "open" &&
      (item.category === "task" ||
        item.category === "warning" ||
        item.category === "sponsor" ||
        item.category === "training" ||
        (item.category === "transfer" && (item.severity === "warning" || item.severity === "critical")) ||
        (item.category === "facility" && (item.severity === "warning" || item.severity === "critical")) ||
        (!options?.focusMatchdayLoop && item.category === "contract") ||
        item.severity === "critical"),
  );

  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const severityDiff = severityRank[left.severity] - severityRank[right.severity];
    if (severityDiff !== 0) {
      return severityDiff;
    }
    const sourceDiff = (sourcePriority[left.source] ?? 50) - (sourcePriority[right.source] ?? 50);
    if (sourceDiff !== 0) {
      return sourceDiff;
    }
    return left.title.localeCompare(right.title, "de");
  })[0];
}

export function mapInboxItemToFlowStep(item: GameInboxItem): Pick<GameFlowStep, "label" | "cta" | "status" | "targetView" | "targetPanel" | "teamId" | "blockers" | "warnings"> {
  const isCritical = item.severity === "critical";
  return {
    label: item.title,
    cta: `Weiter: ${item.title}`,
    status: isCritical ? "warning" : "ready",
    targetView: item.targetView as GameFlowStep["targetView"],
    targetPanel: typeof item.targetParams.panel === "string" ? item.targetParams.panel : null,
    teamId: item.teamId ?? null,
    blockers: isCritical ? [item.description] : [],
    warnings: isCritical ? [] : [item.description],
  };
}

export const INBOX_DECISION_CATEGORIES = [
  "task",
  "warning",
  "transfer",
  "finance",
  "contract",
  "training",
  "facility",
  "sponsor",
] as const;

export const INBOX_CHRONICLE_CATEGORIES = ["news", "result"] as const;

export function isGameInboxDecisionItem(item: GameInboxItem) {
  if (isGameInboxChronicleOnlySource(item.source)) {
    return false;
  }
  if (item.source.startsWith("player_health_")) {
    return true;
  }
  if ((INBOX_DECISION_CATEGORIES as readonly string[]).includes(item.category)) {
    if (item.category === "transfer" && item.source === "transfer_history") {
      return false;
    }
    return true;
  }
  return false;
}

export function isGameInboxChronicleItem(item: GameInboxItem) {
  if ((INBOX_CHRONICLE_CATEGORIES as readonly string[]).includes(item.category)) {
    return true;
  }
  if (item.source.startsWith("story:")) {
    return true;
  }
  if (item.source === "story:matchday_recap") {
    return true;
  }
  if (item.source === "season_snapshots" || item.source === "transfer_history") {
    return true;
  }
  if (item.source === "facility_events" || item.source === "player_progression_events") {
    return true;
  }
  if (item.source === "cash_prize_apply_logs" || item.source === "matchday_results") {
    return true;
  }
  if (item.category === "finance" && item.source === "cash_prize_apply_logs") {
    return true;
  }
  if (item.category === "transfer" && item.source === "transfer_history") {
    return true;
  }
  if (item.category === "facility" && item.source === "facility_events") {
    return true;
  }
  if (item.category === "training" && item.source === "player_progression_events") {
    return true;
  }
  return false;
}

export function filterInboxItemsByMode(items: GameInboxItem[], mode: "decisions" | "chronicle") {
  return items.filter((item) => (mode === "decisions" ? isGameInboxDecisionItem(item) : isGameInboxChronicleItem(item)));
}
