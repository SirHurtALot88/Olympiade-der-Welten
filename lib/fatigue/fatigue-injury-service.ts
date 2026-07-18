import type {
  GameState,
  InjuryEventRecord,
  LineupDraft,
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
import { getPlayerFatigueLoadMultiplier } from "@/lib/traits/cosmetic-trait-soft-effects";

export const FATIGUE_INJURY_SOURCE = "fatigue_injury_risk_v1" as const;
export const FATIGUE_INJURY_REHEARSAL_SOURCE = "fatigue_injury_rehearsal_v1" as const;
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
};

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

/**
 * Per-matchday fatigue load for a specific player: the flat
 * `MATCHDAY_FATIGUE_LOAD` nudged by a small trait-driven multiplier (see
 * lib/traits/cosmetic-trait-soft-effects.ts). This is the single choke
 * point where cosmetic traits touch fatigue accrual.
 */
function getPlayerMatchdayFatigueLoad(player: Player) {
  return round(MATCHDAY_FATIGUE_LOAD * getPlayerFatigueLoadMultiplier(player));
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
  const unique = new Set<string>();
  const uses: MatchdayUse[] = [];
  const drafts = (gameState.seasonState.lineupDrafts ?? []).filter(
    (draft) => draft.seasonId === seasonId && draft.matchdayId === matchdayId,
  );
  for (const draft of drafts) {
    for (const entry of draft.entries) {
      if (!isActiveRosterPlayer(gameState, entry.playerId, draft.teamId)) continue;
      const key = `${draft.teamId}::${entry.playerId}`;
      if (unique.has(key)) continue;
      unique.add(key);
      uses.push({ teamId: draft.teamId, playerId: entry.playerId });
    }
  }
  return uses;
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
  /**
   * forceReplace-Re-Apply desselben Spieltags: der übergebene `gameState` trägt in
   * `playerAvailabilityState` bereits die NACH-Spieltags-Fatigue aus dem ersten Apply.
   * Ist das Flag gesetzt, wird der Vor-Spieltags-Stand rekonstruiert, damit
   * `fatigueBeforeRoll` (und damit riskPercent/roll) identisch zum ersten Apply bleibt.
   */
  isMatchdayReplay?: boolean;
}): MatchdayInjuryRollMap {
  const gameState = restorePreMatchdayAvailability({
    gameState: input.gameState,
    seasonId: input.seasonId,
    matchdayId: input.matchdayId,
    isMatchdayReplay: Boolean(input.isMatchdayReplay),
  });
  const injuryRehearsal = input.injuryRehearsal?.enabled ? input.injuryRehearsal : null;
  const maxRehearsalInjuries = injuryRehearsal ? Math.max(0, injuryRehearsal.maxInjuries ?? 3) : Number.POSITIVE_INFINITY;
  let rehearsalInjuriesCreated = 0;
  const rollMap: MatchdayInjuryRollMap = new Map();
  const usedPlayers = collectMatchdayUses(gameState, input.seasonId, input.matchdayId);

  for (const use of usedPlayers) {
    const availabilityView = getPlayerAvailabilityView(
      gameState,
      use.playerId,
      use.teamId,
      input.matchdayId,
    );
    if (availabilityView.isUnavailable) continue;

    const player = gameState.players.find((entry) => entry.id === use.playerId);
    if (!player) continue;

    const fatigueBeforeRoll = clampFatigue(getPlayerCurrentFatigue(gameState, player, use.teamId) + getPlayerMatchdayFatigueLoad(player));
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

/**
 * Rekonstruiert den VOR-Spieltags-Stand der Fatigue (Ausdauer) je Spieler für einen
 * forceReplace-Re-Apply desselben Spieltags.
 *
 * Hintergrund (Idempotenz): Der erste Apply von Spieltag N schreibt den NACH-Spieltags-Wert
 * in `playerAvailabilityState` — Einsatz-Spieler: +Load, Bank/verletzt: -Recovery. Ein
 * `forceReplace`-Re-Apply bekommt genau diesen bereits fortgeschriebenen Stand herein.
 * Ohne Korrektur käme der Load/die Recovery ein zweites Mal drauf (F + 2*Load bzw. doppelte
 * Erholung). Diese Funktion macht den Delta von Spieltag N rückgängig, sodass Roll,
 * event.fatigueBefore und availability.fatigue exakt wie beim ersten Apply herauskommen.
 *
 * Beim NORMALEN Vorrücken (distinct matchdays, isMatchdayReplay=false) wird der State
 * unverändert (identische Referenz) zurückgegeben -> byte-identisches Verhalten des
 * Standard-Sim-Pfades.
 */
function restorePreMatchdayAvailability(input: {
  gameState: GameState;
  seasonId: string;
  matchdayId: string;
  isMatchdayReplay: boolean;
}): GameState {
  if (!input.isMatchdayReplay) {
    return input.gameState;
  }
  const { gameState, seasonId, matchdayId } = input;
  const currentAvailability = gameState.seasonState.playerAvailabilityState ?? [];
  if (currentAvailability.length === 0) {
    return gameState;
  }
  const usedKeys = new Set(
    collectMatchdayUses(gameState, seasonId, matchdayId).map((use) => `${use.teamId}::${use.playerId}`),
  );

  // Pass 1: Den einzigen Verletzungs-Status-Wechsel, den der Recovery-Loop an Spieltag N
  // vornimmt ("injured" -> "recovering", wenn `injuryUntilMatchday === matchdayId`),
  // zurücksetzen. Nur so entspricht die Unavailable-Klassifikation exakt dem ersten Apply
  // und die Fatigue-Inversion trifft denselben Zweig (Load vs. Recovery). Spieler, die AN
  // Spieltag N verletzt wurden (injuredAtMatchdayId === matchdayId, until = nächster
  // Spieltag), bleiben unangetastet: sie waren an N nicht unavailable und werden vom
  // Einsatz-Loop identisch neu erzeugt.
  const restoredInjuryRecords = currentAvailability.map((entry) => {
    if (
      entry.injuryStatus === "recovering" &&
      entry.injuryUntilMatchday === matchdayId &&
      entry.injuredAtMatchdayId &&
      entry.injuredAtMatchdayId !== matchdayId
    ) {
      return { ...entry, injuryStatus: "injured" as const };
    }
    return entry;
  });
  const restoredGameState: GameState = {
    ...gameState,
    seasonState: { ...gameState.seasonState, playerAvailabilityState: restoredInjuryRecords },
  };

  // Pass 2: Fatigue-Delta je Spieler invertieren, basierend auf der (rekonstruierten)
  // Klassifikation des ersten Apply. Die Klemmung auf [0,100] ist unter der Inversion
  // idempotent: clamp(clamp(F + Load) - Load) == clamp(F + Load) und
  // clamp(clamp(F - Rec) + Rec) == clamp(F - Rec).
  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const nextAvailability = restoredInjuryRecords.map((entry) => {
    if (!isActiveRosterPlayer(gameState, entry.playerId, entry.teamId)) {
      return entry;
    }
    const player = playerById.get(entry.playerId);
    if (!player) {
      return entry;
    }
    const view = getPlayerAvailabilityView(restoredGameState, entry.playerId, entry.teamId, matchdayId);
    const wasUsedLoop = usedKeys.has(`${entry.teamId}::${entry.playerId}`) && !view.isUnavailable;
    if (wasUsedLoop) {
      // Einsatz-Spieler: erster Apply hat +Load gerechnet -> zurücknehmen.
      return { ...entry, fatigue: clampFatigue(entry.fatigue - getPlayerMatchdayFatigueLoad(player)) };
    }
    // Bank oder verletzt/unavailable: erster Apply hat Recovery abgezogen -> wieder aufaddieren.
    const recovery = calculatePlayerRecovery(gameState, entry.teamId, player.trainingMode);
    const recoveryValue = view.isUnavailable ? recovery.injuryRecovery : recovery.normalRecovery;
    return { ...entry, fatigue: clampFatigue(entry.fatigue + recoveryValue) };
  });

  return {
    ...gameState,
    seasonState: { ...gameState.seasonState, playerAvailabilityState: nextAvailability },
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
  /**
   * forceReplace-Re-Apply desselben Spieltags: macht den bereits persistierten Fatigue-Delta
   * von Spieltag N rückgängig, bevor Load/Recovery neu angewandt werden. Standard-Vorrücken
   * (distinct matchdays) lässt dieses Flag weg -> unverändertes Verhalten.
   */
  isMatchdayReplay?: boolean;
}): { gameState: GameState; injuryEvents: InjuryEventRecord[] } {
  const gameState = restorePreMatchdayAvailability({
    gameState: input.gameState,
    seasonId: input.seasonId,
    matchdayId: input.matchdayId,
    isMatchdayReplay: Boolean(input.isMatchdayReplay),
  });
  const usedPlayers = collectMatchdayUses(gameState, input.seasonId, input.matchdayId);
  const usedPlayerKeys = new Set(usedPlayers.map((use) => `${use.teamId}::${use.playerId}`));
  const nextMatchdayId = getNextMatchdayId(gameState, input.matchdayId);
  const injuryRollMap =
    input.precomputedInjuryRolls ??
    buildMatchdayInjuryRollMap({
      gameState,
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      injuryRehearsal: input.injuryRehearsal,
    });
  let nextAvailability = (gameState.seasonState.playerAvailabilityState ?? []).filter((entry) =>
    isActiveRosterPlayer(gameState, entry.playerId, entry.teamId),
  );
  const nextPlayers = gameState.players.map((player) => ({ ...player }));
  const playerIndexById = new Map(nextPlayers.map((player, index) => [player.id, index] as const));
  const playerNameById = new Map(gameState.players.map((player) => [player.id, player.name] as const));
  const newEvents: InjuryEventRecord[] = [];

  for (const roster of gameState.rosters) {
    const playerIndex = playerIndexById.get(roster.playerId);
    if (playerIndex == null) continue;
    const player = nextPlayers[playerIndex];
    const usedKey = `${roster.teamId}::${roster.playerId}`;
    const view = getPlayerAvailabilityView(
      { ...gameState, players: nextPlayers, seasonState: { ...gameState.seasonState, playerAvailabilityState: nextAvailability } },
      roster.playerId,
      roster.teamId,
      input.matchdayId,
    );
    if (usedPlayerKeys.has(usedKey) && !view.isUnavailable) continue;
    const recovery = calculatePlayerRecovery(gameState, roster.teamId, player.trainingMode);
    const currentFatigue = getPlayerCurrentFatigue(
      { ...gameState, players: nextPlayers, seasonState: { ...gameState.seasonState, playerAvailabilityState: nextAvailability } },
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
      { ...gameState, players: nextPlayers, seasonState: { ...gameState.seasonState, playerAvailabilityState: nextAvailability } },
      use.playerId,
      use.teamId,
      input.matchdayId,
    );
    if (availabilityView.isUnavailable) continue;

    const recovery = calculatePlayerRecovery(gameState, use.teamId, player.trainingMode);
    const fatigueBeforeRoll = clampFatigue(getPlayerCurrentFatigue(gameState, player, use.teamId) + getPlayerMatchdayFatigueLoad(player));
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
      const historyRecord = injuryEventToPlayerHistoryRecord(event, gameState);
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
      ...gameState,
      players: nextPlayers,
      seasonState: {
        ...gameState.seasonState,
        playerAvailabilityState: nextAvailability,
        injuryEvents: [
          ...(gameState.seasonState.injuryEvents ?? []).filter(
            (event) => !(event.seasonId === input.seasonId && event.matchdayId === input.matchdayId),
          ),
          ...newEvents,
        ],
        disciplineHighlights: [
          ...(gameState.seasonState.disciplineHighlights ?? []),
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
