import type {
  GameState,
  InjuryEventRecord,
  LineupDraft,
  Player,
  PlayerAvailabilityStateRecord,
  PlayerInjuryRiskRollRecord,
} from "@/lib/data/olyDataTypes";
import { applyRecoveryFacilityModifiers, getTeamFacilityState } from "@/lib/facilities/facility-effects";

export const FATIGUE_INJURY_SOURCE = "fatigue_injury_risk_v1" as const;
export const MATCHDAY_FATIGUE_LOAD = 12;
export const BASE_MATCHDAY_RECOVERY = 20;

export const injuryRiskBands = [
  { min: 0, max: 29, label: "none", riskPercent: 0, uiLabel: "kein Risiko" },
  { min: 30, max: 49, label: "minimal", riskPercent: 2, uiLabel: "minimales Verletzungsrisiko" },
  { min: 50, max: 69, label: "mittel", riskPercent: 6, uiLabel: "mittleres Verletzungsrisiko" },
  { min: 70, max: 84, label: "stark", riskPercent: 12, uiLabel: "starkes Verletzungsrisiko" },
  { min: 85, max: 100, label: "sehr_stark", riskPercent: 22, uiLabel: "sehr starkes Verletzungsrisiko" },
] as const;

export const FATIGUE_INJURY_RISK_CURVE = injuryRiskBands;

export type InjuryRiskBand = (typeof injuryRiskBands)[number];

export type PlayerAvailabilityView = PlayerAvailabilityStateRecord & {
  isUnavailable: boolean;
  blocker: "player_injured_unavailable" | null;
};

type MatchdayUse = {
  teamId: string;
  playerId: string;
};

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

function getPlayerCurrentFatigue(gameState: GameState, player: Player, teamId: string) {
  if (!isActiveRosterPlayer(gameState, player.id, teamId)) {
    return 0;
  }
  const availability = gameState.seasonState.playerAvailabilityState?.find(
    (entry) => entry.playerId === player.id && entry.teamId === teamId,
  );
  return clampFatigue(availability?.fatigue ?? player.fatigue ?? 0);
}

export function getInjuryRiskPercent(fatigue: number) {
  return getInjuryRiskBand(fatigue).riskPercent;
}

export function getInjuryRiskBand(fatigue: number): InjuryRiskBand {
  const normalized = clampFatigue(fatigue);
  return injuryRiskBands.find((entry) => normalized >= entry.min && normalized <= entry.max) ?? injuryRiskBands[0];
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

export function calculateTeamRecovery(gameState: GameState, teamId: string) {
  const facilities = getTeamFacilityState(gameState, teamId);
  const normalRecovery = applyRecoveryFacilityModifiers(BASE_MATCHDAY_RECOVERY, facilities).after;
  return {
    normalRecovery,
    injuryRecovery: round(normalRecovery * 0.5, 2),
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
}): { gameState: GameState; injuryEvents: InjuryEventRecord[] } {
  const usedPlayers = collectMatchdayUses(input.gameState, input.seasonId, input.matchdayId);
  const usedPlayerKeys = new Set(usedPlayers.map((use) => `${use.teamId}::${use.playerId}`));
  const nextMatchdayId = getNextMatchdayId(input.gameState, input.matchdayId);
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
    const recovery = calculateTeamRecovery(input.gameState, roster.teamId);
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

    const fatigueBeforeRoll = clampFatigue(getPlayerCurrentFatigue(input.gameState, player, use.teamId) + MATCHDAY_FATIGUE_LOAD);
    const riskPercent = getInjuryRiskPercent(fatigueBeforeRoll);
    if (riskPercent <= 0) {
      nextAvailability = updateAvailability(nextAvailability, {
        playerId: use.playerId,
        teamId: use.teamId,
        fatigue: fatigueBeforeRoll,
        injuryStatus: availabilityView.injuryStatus === "recovering" ? "recovering" : "healthy",
        injuryUntilMatchday: availabilityView.injuryUntilMatchday,
        injuredAtSeasonId: availabilityView.injuredAtSeasonId,
        injuredAtMatchdayId: availabilityView.injuredAtMatchdayId,
        injuryReason: availabilityView.injuryReason,
        injuryRiskLastRoll: availabilityView.injuryRiskLastRoll,
      });
      nextPlayers[playerIndex] = { ...player, fatigue: fatigueBeforeRoll };
      continue;
    }
    const roll = rollInjuryRisk({
      saveId: input.saveId,
      seasonId: input.seasonId,
      matchdayId: input.matchdayId,
      playerId: use.playerId,
      fatigueBefore: fatigueBeforeRoll,
    });
    const recovery = calculateTeamRecovery(input.gameState, use.teamId);
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
      source: FATIGUE_INJURY_SOURCE,
      timestamp: input.timestamp,
    };
    newEvents.push(event);
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
    nextPlayers[playerIndex] = { ...player, fatigue: fatigueBeforeRoll };
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
