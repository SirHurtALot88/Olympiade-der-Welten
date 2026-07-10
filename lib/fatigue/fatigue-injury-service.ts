import type {
  GameState,
  InjuryEventRecord,
  LineupDraft,
  LineupDraftEntry,
  Player,
  PlayerAvailabilityStateRecord,
  PlayerInjuryHistoryRecord,
  PlayerInjuryRiskRollRecord,
} from "@/lib/data/olyDataTypes";
import { applyRecoveryFacilityModifiers, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import {
  appendPlayerInjuryHistory,
  injuryEventToPlayerHistoryRecord,
} from "@/lib/foundation/player-injury-history";
import {
  FATIGUE_INJURY_RISK_ANCHORS,
  getInjuryPerformanceMultiplier,
  getInjuryRiskBand,
  getInjuryRiskPercent,
  injuryRiskBands,
  type InjuryRiskBand,
} from "@/lib/fatigue/fatigue-calibration";
import { applyTrainingRecoveryImpact } from "@/lib/training/training-recovery-impact";
import type { PlayerTrainingMode } from "@/lib/training/training-plan-types";
import { getMatchdayIntensityConfig, type MatchdayIntensityStage } from "@/lib/lineups/matchday-slot-roles";

export const FATIGUE_INJURY_SOURCE = "fatigue_injury_risk_v1" as const;
export const FATIGUE_INJURY_REHEARSAL_SOURCE = "fatigue_injury_rehearsal_v1" as const;
/**
 * @deprecated Legacy flat matchday fatigue load, kept only for downstream consumers
 * (player-season-fatigue-stats.ts, ai-player-training-load-service.ts, historical audit
 * scripts) that still reconstruct/estimate fatigue with a flat assumption. The real
 * persisted/applied load inside this file is now intensity-scaled — see
 * `resolveIntensityScaledMatchdayFatigueLoad`.
 */
export const MATCHDAY_FATIGUE_LOAD = 11;
export const BASE_MATCHDAY_RECOVERY = 24;

export { getInjuryRiskBand, getInjuryRiskPercent, injuryRiskBands, type InjuryRiskBand };
export const FATIGUE_INJURY_RISK_CURVE = FATIGUE_INJURY_RISK_ANCHORS;

export type PlayerAvailabilityView = PlayerAvailabilityStateRecord & {
  isUnavailable: boolean;
  blocker: "player_injured_unavailable" | null;
};

export type InjuryRehearsalOptions = {
  enabled: boolean;
  seed?: string;
  maxInjuries?: number;
  riskPercentOverride?: number;
};

type MatchdayUse = {
  teamId: string;
  playerId: string;
  intensity: MatchdayIntensityStage;
};

/**
 * Relative "load rank" used only to pick a single intensity when a player somehow
 * appears in more than one lineup-draft entry for the same matchday (e.g. d1 + d2 with
 * different intensity choices). We conservatively use the more demanding intensity so a
 * player is never under-charged for the heaviest slot they actually played.
 */
const INTENSITY_LOAD_RANK: Record<MatchdayIntensityStage, number> = {
  conserve: 0,
  normal: 1,
  push: 2,
};

function resolveEntryIntensity(
  draft: Pick<LineupDraft, "modifiers">,
  entry: Pick<LineupDraftEntry, "disciplineSide">,
): MatchdayIntensityStage {
  const raw = draft.modifiers?.[entry.disciplineSide]?.intensity;
  return raw === "conserve" || raw === "normal" || raw === "push" ? raw : "normal";
}

/**
 * Intensity-scaled replacement for the old flat MATCHDAY_FATIGUE_LOAD.
 *
 * Uses the SAME intensity config (fatigueBase / additionalFatigueCap) that
 * `lib/lineups/matchday-slot-roles.ts` already exposes for the lineup-lab preview, so a
 * player's intensity choice (schonen/normal/push) now actually changes the fatigue that
 * gets persisted after the matchday instead of always applying the same flat amount.
 *
 * The load scales linearly between `fatigueBase` (a fresh player, fatigue 0) and
 * `additionalFatigueCap` (an already very fatigued player, fatigue 100) — fatigue
 * compounds, so playing on while already tired costs more than playing fresh, for any
 * given intensity. This is universal/derived: it only reads intensity + the player's own
 * current fatigue, never team or player identity.
 *
 * IMPORTANT: this must be called identically at the preview roll-map site
 * (`buildMatchdayInjuryRollMap`) and the apply site (`applyFatigueAndInjuryAfterMatchday`)
 * so both agree on the persisted fatigue value.
 */
function resolveIntensityScaledMatchdayFatigueLoad(
  intensity: MatchdayIntensityStage,
  currentFatigueBefore: number,
): number {
  const config = getMatchdayIntensityConfig(intensity);
  const fatigueFraction = clampFatigue(currentFatigueBefore) / 100;
  const scaledAdditional = Math.max(config.additionalFatigueCap - config.fatigueBase, 0) * fatigueFraction;
  return round(config.fatigueBase + scaledAdditional, 1);
}

export type MatchdayInjuryRollKey = `${string}::${string}`;

export type MatchdayInjuryPerformanceRef = {
  injuredThisMatchday: boolean;
  multiplier: number;
};

export type MatchdayInjuryRollMap = Map<MatchdayInjuryRollKey, PlayerInjuryRiskRollRecord>;

function clampFatigue(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function stableHash(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getMatchdayIndex(gameState: GameState, matchdayId: string) {
  return gameState.season.matchdayIds?.findIndex((entry) => entry === matchdayId) ?? -1;
}

function getNextMatchdayId(gameState: GameState, matchdayId: string) {
  const index = getMatchdayIndex(gameState, matchdayId);
  return index >= 0 ? gameState.season.matchdayIds[index + 1] ?? null : null;
}

function getRosterTeamForPlayer(gameState: GameState, playerId: string) {
  return gameState.rosters.find((entry) => entry.playerId === playerId)?.teamId ?? null;
}

function isActiveRosterPlayer(gameState: GameState, playerId: string, teamId: string) {
  return gameState.rosters.some((entry) => entry.playerId === playerId && entry.teamId === teamId);
}

export function isPlayerAvailabilityInjured(
  entry: Pick<PlayerAvailabilityStateRecord, "injuryStatus"> & { status?: string },
): boolean {
  return entry.injuryStatus === "injured" || entry.status === "injured";
}

export function countTeamInjuredPlayers(gameState: GameState, teamId: string) {
  return (gameState.seasonState.playerAvailabilityState ?? []).filter(
    (entry) => entry.teamId === teamId && isPlayerAvailabilityInjured(entry),
  ).length;
}

function getPlayerCurrentFatigue(gameState: GameState, player: Player, teamId: string) {
  if (!isActiveRosterPlayer(gameState, player.id, teamId)) {
    return 0;
  }
  const availability = gameState.seasonState.playerAvailabilityState?.find(
    (entry) => entry.playerId === player.id && entry.teamId === teamId,
  );
  return clampFatigue(availability?.fatigue ?? player.fatigue ?? 0);
}

export function rollInjuryRisk(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  playerId: string;
  fatigueBefore: number;
}): PlayerInjuryRiskRollRecord {
  const riskPercent = getInjuryRiskPercent(input.fatigueBefore);
  const seed = `${input.saveId}:${input.seasonId}:${input.matchdayId}:${input.playerId}:${FATIGUE_INJURY_SOURCE}`;
  const roll = round((stableHash(seed) % 10_000) / 100, 2);
  return {
    fatigueBefore: clampFatigue(input.fatigueBefore),
    riskPercent,
    roll,
    result: riskPercent > 0 && roll < riskPercent ? "injured" : "healthy",
    source: FATIGUE_INJURY_SOURCE,
  };
}

function rollInjuryRiskForRehearsal(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  playerId: string;
  fatigueBefore: number;
  options: InjuryRehearsalOptions;
}): PlayerInjuryRiskRollRecord {
  const riskPercent = Math.max(
    0,
    Math.min(100, input.options.riskPercentOverride ?? getInjuryRiskPercent(input.fatigueBefore)),
  );
  const seed = `${input.saveId}:${input.seasonId}:${input.matchdayId}:${input.playerId}:${FATIGUE_INJURY_REHEARSAL_SOURCE}:${input.options.seed ?? "default"}`;
  const roll = round((stableHash(seed) % 10_000) / 100, 2);
  return {
    fatigueBefore: clampFatigue(input.fatigueBefore),
    riskPercent,
    roll,
    result: riskPercent > 0 && roll < riskPercent ? "injured" : "healthy",
    source: FATIGUE_INJURY_REHEARSAL_SOURCE,
  };
}

export function calculateTeamRecovery(gameState: GameState, teamId: string) {
  const facilities = getTeamFacilityState(gameState, teamId);
  const normalRecovery = applyRecoveryFacilityModifiers(BASE_MATCHDAY_RECOVERY, facilities).after;
  return {
    normalRecovery,
    injuryRecovery: round(normalRecovery * 0.5, 2),
  };
}

export function calculatePlayerRecovery(
  gameState: GameState,
  teamId: string,
  trainingMode: PlayerTrainingMode | null | undefined,
) {
  const teamRecovery = calculateTeamRecovery(gameState, teamId);
  const modeRecovery = applyTrainingRecoveryImpact(teamRecovery.normalRecovery, trainingMode ?? "mittel");
  return {
    teamNormalRecovery: teamRecovery.normalRecovery,
    normalRecovery: modeRecovery.after,
    injuryRecovery: round(modeRecovery.after * 0.5, 2),
    trainingMode: trainingMode ?? "mittel",
    trainingRecoveryModifierPct: modeRecovery.modifierPct,
    trainingRecoveryLabel: modeRecovery.label,
  };
}

export function getPlayerAvailabilityView(
  gameState: GameState,
  playerId: string,
  teamId: string,
  matchdayId: string,
): PlayerAvailabilityView {
  const player = gameState.players.find((entry) => entry.id === playerId) ?? null;
  const activeTeamId = getRosterTeamForPlayer(gameState, playerId);
  const isActive = Boolean(teamId && activeTeamId === teamId);
  if (!isActive) {
    return {
      playerId,
      teamId,
      fatigue: 0,
      injuryStatus: "healthy",
      injuryUntilMatchday: undefined,
      injuredAtSeasonId: undefined,
      injuredAtMatchdayId: undefined,
      injuryReason: undefined,
      injuryRiskLastRoll: undefined,
      isUnavailable: false,
      blocker: null,
    };
  }
  const stored = gameState.seasonState.playerAvailabilityState?.find(
    (entry) => entry.playerId === playerId && entry.teamId === teamId,
  );
  const currentIndex = getMatchdayIndex(gameState, matchdayId);
  const injuredAtIndex = stored?.injuredAtMatchdayId ? getMatchdayIndex(gameState, stored.injuredAtMatchdayId) : -1;
  const untilIndex = stored?.injuryUntilMatchday ? getMatchdayIndex(gameState, stored.injuryUntilMatchday) : -1;
  const isUnavailable =
    stored?.injuryStatus === "injured" &&
    currentIndex >= 0 &&
    injuredAtIndex >= 0 &&
    untilIndex >= 0 &&
    currentIndex > injuredAtIndex &&
    currentIndex <= untilIndex;
  const recovered =
    stored?.injuryStatus === "injured" &&
    currentIndex >= 0 &&
    untilIndex >= 0 &&
    currentIndex > untilIndex;

  return {
    playerId,
    teamId,
    fatigue: clampFatigue(stored?.fatigue ?? player?.fatigue ?? 0),
    injuryStatus: recovered ? "recovering" : stored?.injuryStatus ?? "healthy",
    injuryUntilMatchday: stored?.injuryUntilMatchday,
    injuredAtSeasonId: stored?.injuredAtSeasonId,
    injuredAtMatchdayId: stored?.injuredAtMatchdayId,
    injuryReason: stored?.injuryReason,
    injuryRiskLastRoll: stored?.injuryRiskLastRoll,
    isUnavailable,
    blocker: isUnavailable ? "player_injured_unavailable" : null,
  };
}

export function buildPlayerAvailabilityMap(gameState: GameState, seasonId: string, matchdayId: string) {
  return new Map(
    gameState.rosters.map((roster) => [
      roster.playerId,
      getPlayerAvailabilityView(gameState, roster.playerId, roster.teamId, matchdayId),
    ] as const),
  );
}

function collectMatchdayUses(gameState: GameState, seasonId: string, matchdayId: string): MatchdayUse[] {
  const usesByKey = new Map<string, MatchdayUse>();
  const drafts = (gameState.seasonState.lineupDrafts ?? []).filter(
    (draft) => draft.seasonId === seasonId && draft.matchdayId === matchdayId,
  );
  for (const draft of drafts) {
    for (const entry of draft.entries) {
      if (!isActiveRosterPlayer(gameState, entry.playerId, draft.teamId)) continue;
      const key = `${draft.teamId}::${entry.playerId}`;
      const intensity = resolveEntryIntensity(draft, entry);
      const existing = usesByKey.get(key);
      if (!existing || INTENSITY_LOAD_RANK[intensity] > INTENSITY_LOAD_RANK[existing.intensity]) {
        usesByKey.set(key, { teamId: draft.teamId, playerId: entry.playerId, intensity });
      }
    }
  }
  return Array.from(usesByKey.values());
}

function updateAvailability(
  entries: PlayerAvailabilityStateRecord[],
  nextEntry: PlayerAvailabilityStateRecord,
) {
  return [
    ...entries.filter((entry) => !(entry.playerId === nextEntry.playerId && entry.teamId === nextEntry.teamId)),
    nextEntry,
  ];
}

function buildMatchdayUseKey(teamId: string, playerId: string): MatchdayInjuryRollKey {
  return `${teamId}::${playerId}`;
}

function resolveMatchdayInjuryRoll(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  playerId: string;
  fatigueBeforeRoll: number;
  injuryRehearsal?: InjuryRehearsalOptions | null;
  allowInjury?: boolean;
}): PlayerInjuryRiskRollRecord {
  const riskPercent = getInjuryRiskPercent(input.fatigueBeforeRoll);
  if (riskPercent <= 0) {
    return {
      fatigueBefore: clampFatigue(input.fatigueBeforeRoll),
      riskPercent: 0,
      roll: 0,
      result: "healthy",
      source: FATIGUE_INJURY_SOURCE,
    };
  }
  const initialRoll = input.injuryRehearsal?.enabled
    ? rollInjuryRiskForRehearsal({
        saveId: input.saveId,
        seasonId: input.seasonId,
        matchdayId: input.matchdayId,
        playerId: input.playerId,
        fatigueBefore: input.fatigueBeforeRoll,
        options: input.injuryRehearsal,
      })
    : rollInjuryRisk({
        saveId: input.saveId,
        seasonId: input.seasonId,
        matchdayId: input.matchdayId,
        playerId: input.playerId,
        fatigueBefore: input.fatigueBeforeRoll,
      });
  if (initialRoll.result === "injured" && input.allowInjury === false) {
    return { ...initialRoll, result: "healthy" as const };
  }
  return initialRoll;
}

export function buildMatchdayInjuryRollMap(input: {
  gameState: GameState;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  injuryRehearsal?: InjuryRehearsalOptions | null;
}): MatchdayInjuryRollMap {
  const injuryRehearsal = input.injuryRehearsal?.enabled ? input.injuryRehearsal : null;
  const maxRehearsalInjuries = injuryRehearsal ? Math.max(0, injuryRehearsal.maxInjuries ?? 3) : Number.POSITIVE_INFINITY;
  let rehearsalInjuriesCreated = 0;
  const rollMap: MatchdayInjuryRollMap = new Map();
  const usedPlayers = collectMatchdayUses(input.gameState, input.seasonId, input.matchdayId);

  for (const use of usedPlayers) {
    const availabilityView = getPlayerAvailabilityView(
      input.gameState,
      use.playerId,
      use.teamId,
      input.matchdayId,
    );
    if (availabilityView.isUnavailable) continue;

    const player = input.gameState.players.find((entry) => entry.id === use.playerId);
    if (!player) continue;

    const currentFatigue = getPlayerCurrentFatigue(input.gameState, player, use.teamId);
    const fatigueBeforeRoll = clampFatigue(
      currentFatigue + resolveIntensityScaledMatchdayFatigueLoad(use.intensity, currentFatigue),
    );
    const allowInjury = !injuryRehearsal || rehearsalInjuriesCreated < maxRehearsalInjuries;
    const roll = resolveMatchdayInjuryRoll({
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      playerId: use.playerId,
      fatigueBeforeRoll,
      injuryRehearsal,
      allowInjury,
    });
    if (roll.result === "injured" && injuryRehearsal) {
      rehearsalInjuriesCreated += 1;
    }
    rollMap.set(buildMatchdayUseKey(use.teamId, use.playerId), roll);
  }

  return rollMap;
}

export function buildInjuryPerformanceMapForTeam(
  teamId: string,
  rollMap: MatchdayInjuryRollMap,
): Record<string, MatchdayInjuryPerformanceRef> | null {
  const entries: Record<string, MatchdayInjuryPerformanceRef> = {};
  let hasAny = false;
  for (const [key, roll] of rollMap.entries()) {
    if (!key.startsWith(`${teamId}::`)) continue;
    hasAny = true;
    const playerId = key.slice(teamId.length + 2);
    const injuredThisMatchday = roll.result === "injured";
    entries[playerId] = {
      injuredThisMatchday,
      multiplier: getInjuryPerformanceMultiplier(injuredThisMatchday),
    };
  }
  return hasAny ? entries : null;
}

export function attachMatchdayInjuryPerformanceToContexts(
  contexts: Array<{ teamId: string; injuryByPlayerId?: Record<string, MatchdayInjuryPerformanceRef> | null; injurySourceStatus?: "mapped" | "not_applied" }>,
  rollMap: MatchdayInjuryRollMap,
) {
  for (const context of contexts) {
    context.injuryByPlayerId = buildInjuryPerformanceMapForTeam(context.teamId, rollMap);
    context.injurySourceStatus = context.injuryByPlayerId ? "mapped" : "not_applied";
  }
}

function buildInjuryEventId(input: {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  teamId: string;
  playerId: string;
}) {
  return `injury-event__${input.saveId}__${input.seasonId}__${input.matchdayId}__${input.teamId}__${input.playerId}`;
}

function buildInjuryHighlight(event: InjuryEventRecord, playerName: string, matchdayResultId: string) {
  return {
    id: `discipline-highlight__${matchdayResultId}__injury_event__${event.teamId}__${event.playerId}`,
    matchdayResultId,
    disciplineId: null,
    highlightType: "injury_event" as const,
    teamId: event.teamId,
    playerId: event.playerId,
    relatedTeamId: null,
    importanceScore: event.result === "injured" ? 72 : 18,
    shortSummary:
      event.result === "injured"
        ? `${playerName} verletzt sich nach Überlastung.`
        : `${playerName} übersteht den Injury-Risk-Roll.`,
    payload: {
      fatigueBefore: event.fatigueBefore,
      riskPercent: event.riskPercent,
      roll: event.roll,
      result: event.result,
      unavailableUntil: event.unavailableUntil,
      source: event.source,
    },
    createdAt: event.timestamp,
  };
}

export function applyFatigueAndInjuryAfterMatchday(input: {
  gameState: GameState;
  saveId: string;
  seasonId: string;
  matchdayId: string;
  matchdayResultId: string;
  timestamp: string;
  injuryRehearsal?: InjuryRehearsalOptions | null;
  precomputedInjuryRolls?: MatchdayInjuryRollMap | null;
}): { gameState: GameState; injuryEvents: InjuryEventRecord[] } {
  const usedPlayers = collectMatchdayUses(input.gameState, input.seasonId, input.matchdayId);
  const usedPlayerKeys = new Set(usedPlayers.map((use) => `${use.teamId}::${use.playerId}`));
  const nextMatchdayId = getNextMatchdayId(input.gameState, input.matchdayId);
  const injuryRollMap =
    input.precomputedInjuryRolls ??
    buildMatchdayInjuryRollMap({
      gameState: input.gameState,
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      injuryRehearsal: input.injuryRehearsal,
    });
  let nextAvailability = (input.gameState.seasonState.playerAvailabilityState ?? []).filter((entry) =>
    isActiveRosterPlayer(input.gameState, entry.playerId, entry.teamId),
  );
  const nextPlayers = input.gameState.players.map((player) => ({ ...player }));
  const playerIndexById = new Map(nextPlayers.map((player, index) => [player.id, index] as const));
  const playerNameById = new Map(input.gameState.players.map((player) => [player.id, player.name] as const));
  const newEvents: InjuryEventRecord[] = [];

  for (const roster of input.gameState.rosters) {
    const playerIndex = playerIndexById.get(roster.playerId);
    if (playerIndex == null) continue;
    const player = nextPlayers[playerIndex];
    const usedKey = `${roster.teamId}::${roster.playerId}`;
    const view = getPlayerAvailabilityView(
      { ...input.gameState, players: nextPlayers, seasonState: { ...input.gameState.seasonState, playerAvailabilityState: nextAvailability } },
      roster.playerId,
      roster.teamId,
      input.matchdayId,
    );
    if (usedPlayerKeys.has(usedKey) && !view.isUnavailable) continue;
    const recovery = calculatePlayerRecovery(input.gameState, roster.teamId, player.trainingMode);
    const currentFatigue = getPlayerCurrentFatigue(
      { ...input.gameState, players: nextPlayers, seasonState: { ...input.gameState.seasonState, playerAvailabilityState: nextAvailability } },
      player,
      roster.teamId,
    );
    const recoveryValue = view.isUnavailable ? recovery.injuryRecovery : recovery.normalRecovery;
    const fatigueAfterRecovery = clampFatigue(currentFatigue - recoveryValue);
    nextAvailability = updateAvailability(nextAvailability, {
      playerId: roster.playerId,
      teamId: roster.teamId,
      fatigue: fatigueAfterRecovery,
      injuryStatus: view.injuryUntilMatchday === input.matchdayId ? "recovering" : view.injuryStatus,
      injuryUntilMatchday: view.injuryUntilMatchday,
      injuredAtSeasonId: view.injuredAtSeasonId,
      injuredAtMatchdayId: view.injuredAtMatchdayId,
      injuryReason: view.injuryReason,
      injuryRiskLastRoll: view.injuryRiskLastRoll,
    });
    nextPlayers[playerIndex] = { ...player, fatigue: fatigueAfterRecovery };
  }

  for (const use of usedPlayers) {
    const playerIndex = playerIndexById.get(use.playerId);
    if (playerIndex == null) continue;
    const player = nextPlayers[playerIndex];
    const availabilityView = getPlayerAvailabilityView(
      { ...input.gameState, players: nextPlayers, seasonState: { ...input.gameState.seasonState, playerAvailabilityState: nextAvailability } },
      use.playerId,
      use.teamId,
      input.matchdayId,
    );
    if (availabilityView.isUnavailable) continue;

    const recovery = calculatePlayerRecovery(input.gameState, use.teamId, player.trainingMode);
    const currentFatigue = getPlayerCurrentFatigue(input.gameState, player, use.teamId);
    const fatigueBeforeRoll = clampFatigue(
      currentFatigue + resolveIntensityScaledMatchdayFatigueLoad(use.intensity, currentFatigue),
    );
    const roll =
      injuryRollMap.get(buildMatchdayUseKey(use.teamId, use.playerId)) ??
      resolveMatchdayInjuryRoll({
        saveId: input.saveId,
        seasonId: input.seasonId,
        matchdayId: input.matchdayId,
        playerId: use.playerId,
        fatigueBeforeRoll,
        injuryRehearsal: input.injuryRehearsal,
      });
    const event: InjuryEventRecord = {
      eventId: buildInjuryEventId({
        saveId: input.saveId,
        seasonId: input.seasonId,
        matchdayId: input.matchdayId,
        teamId: use.teamId,
        playerId: use.playerId,
      }),
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      teamId: use.teamId,
      playerId: use.playerId,
      fatigueBefore: roll.fatigueBefore,
      riskPercent: roll.riskPercent,
      roll: roll.roll,
      result: roll.result,
      unavailableForMatchdays: 1,
      unavailableUntil: roll.result === "injured" ? nextMatchdayId : null,
      normalRecovery: recovery.normalRecovery,
      injuryRecovery: roll.result === "injured" ? recovery.injuryRecovery : null,
      fatigueAfterRecovery: null,
      source: roll.source,
      timestamp: input.timestamp,
    };
    newEvents.push(event);
    if (roll.result === "injured") {
      const historyRecord = injuryEventToPlayerHistoryRecord(event, input.gameState);
      if (historyRecord) {
        nextPlayers[playerIndex] = appendPlayerInjuryHistory(nextPlayers[playerIndex], historyRecord);
      }
    }
    nextAvailability = updateAvailability(nextAvailability, {
      playerId: use.playerId,
      teamId: use.teamId,
      fatigue: fatigueBeforeRoll,
      injuryStatus: roll.result === "injured" ? "injured" : availabilityView.injuryStatus === "recovering" ? "recovering" : "healthy",
      injuryUntilMatchday: roll.result === "injured" ? nextMatchdayId ?? undefined : availabilityView.injuryUntilMatchday,
      injuredAtSeasonId: roll.result === "injured" ? input.seasonId : availabilityView.injuredAtSeasonId,
      injuredAtMatchdayId: roll.result === "injured" ? input.matchdayId : availabilityView.injuredAtMatchdayId,
      injuryReason: roll.result === "injured" ? "fatigue_over_30_after_matchday_use" : availabilityView.injuryReason,
      injuryRiskLastRoll: roll,
    });
    nextPlayers[playerIndex] = { ...nextPlayers[playerIndex], fatigue: fatigueBeforeRoll };
  }

  const injuryHighlights = newEvents
    .filter((event) => event.result === "injured")
    .map((event) => buildInjuryHighlight(event, playerNameById.get(event.playerId) ?? event.playerId, input.matchdayResultId));

  return {
    injuryEvents: newEvents,
    gameState: {
      ...input.gameState,
      players: nextPlayers,
      seasonState: {
        ...input.gameState.seasonState,
        playerAvailabilityState: nextAvailability,
        injuryEvents: [
          ...(input.gameState.seasonState.injuryEvents ?? []).filter(
            (event) => !(event.seasonId === input.seasonId && event.matchdayId === input.matchdayId),
          ),
          ...newEvents,
        ],
        disciplineHighlights: [
          ...(input.gameState.seasonState.disciplineHighlights ?? []),
          ...injuryHighlights,
        ],
      },
    },
  };
}

export function getLineupInjuryBlockers(gameState: GameState, draft: LineupDraft) {
  return draft.entries.flatMap((entry) => {
    const availability = getPlayerAvailabilityView(gameState, entry.playerId, draft.teamId, draft.matchdayId);
    return availability.isUnavailable
      ? [{
          teamId: draft.teamId,
          playerId: entry.playerId,
          matchdayId: draft.matchdayId,
          blocker: "player_injured_unavailable" as const,
          injuryUntilMatchday: availability.injuryUntilMatchday ?? null,
        }]
      : [];
  });
}
