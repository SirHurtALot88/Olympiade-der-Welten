import type { GameState, TeamRelationshipEventRecord } from "@/lib/data/olyDataTypes";
import { getTeamRelationship, getTeamRelationshipRecords } from "@/lib/rivalries/team-rivalries";

export type TeamRelationshipCard = {
  teamId: string;
  teamName: string;
  shortCode: string;
  baseValue: number;
  delta: number;
  value: number;
  type: "ally" | "rival";
  changed: boolean;
  changeLabel: string | null;
  reasons: string[];
};

export type TeamRelationshipEventApplyResult = {
  gameState: GameState;
  seasonId: string;
  generatedEvents: TeamRelationshipEventRecord[];
  insertedEvents: number;
  replacedPreviewEvents: number;
  totalEvents: number;
  warnings: string[];
};

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function teamPairKey(fromTeamId: string, toTeamId: string) {
  return `${fromTeamId}->${toTeamId}`;
}

function buildTeamTotalScoresByMatchdayResult(gameState: GameState) {
  const resultById = new Map((gameState.seasonState.matchdayResults ?? []).map((result) => [result.id, result] as const));
  const scores = new Map<string, Map<string, number>>();
  for (const row of gameState.seasonState.disciplineResults ?? []) {
    const result = resultById.get(row.matchdayResultId);
    if (!result || result.seasonId !== gameState.season.id || result.status !== "preview_applied") continue;
    const teamScores = scores.get(result.id) ?? new Map<string, number>();
    teamScores.set(row.teamId, (teamScores.get(row.teamId) ?? 0) + (row.totalScore ?? 0));
    scores.set(result.id, teamScores);
  }
  return scores;
}

export function buildDerivedTeamRelationshipEvents(gameState: GameState): TeamRelationshipEventRecord[] {
  const teams = gameState.teams;
  const teamIds = new Set(teams.map((team) => team.teamId));
  const matchdayResults = (gameState.seasonState.matchdayResults ?? []).filter(
    (result) => result.seasonId === gameState.season.id && result.status === "preview_applied",
  );
  const scoresByResultId = buildTeamTotalScoresByMatchdayResult(gameState);
  const events: TeamRelationshipEventRecord[] = [];

  for (const result of matchdayResults) {
    const scores = scoresByResultId.get(result.id);
    if (!scores || scores.size < 2) continue;

    for (const relation of getTeamRelationshipRecords()) {
      if (!teamIds.has(relation.fromTeamId) || !teamIds.has(relation.toTeamId)) continue;
      if (Math.abs(relation.value) < 4) continue;
      const ownScore = scores.get(relation.fromTeamId);
      const targetScore = scores.get(relation.toTeamId);
      if (ownScore == null || targetScore == null) continue;
      const scoreGap = ownScore - targetScore;
      if (Math.abs(scoreGap) < 0.01) continue;

      let delta = 0;
      let reason: TeamRelationshipEventRecord["reason"] | null = null;
      if (relation.value <= -4) {
        delta = scoreGap > 0 ? 0.3 : -0.6;
        reason = scoreGap > 0 ? "rivalry_win" : "rivalry_loss";
        if (Math.abs(scoreGap) <= 5) {
          delta -= 0.2;
          reason = "rivalry_close_finish";
        }
      } else if (relation.value >= 4) {
        const bothStrong = ownScore >= 1 && targetScore >= 1;
        delta = bothStrong ? 0.25 : scoreGap < -20 ? -0.25 : 0;
        reason = delta >= 0 ? "ally_shared_success" : "rivalry_loss";
      }
      if (delta === 0 || !reason) continue;

      events.push({
        eventId: `relationship__${gameState.season.id}__${result.matchdayId}__${relation.fromTeamId}__${relation.toTeamId}`,
        seasonId: gameState.season.id,
        matchdayId: result.matchdayId,
        fromTeamId: relation.fromTeamId,
        toTeamId: relation.toTeamId,
        delta,
        reason,
        source: "system_preview",
        createdAt: result.updatedAt ?? result.createdAt,
      });
    }
  }

  return events;
}

export function buildPersistableTeamRelationshipEvents(gameState: GameState): TeamRelationshipEventRecord[] {
  return buildDerivedTeamRelationshipEvents(gameState).map((event) => ({
    ...event,
    source: "matchday_result",
  }));
}

export function upsertTeamRelationshipEvents(gameState: GameState): TeamRelationshipEventApplyResult {
  const generatedEvents = buildPersistableTeamRelationshipEvents(gameState);
  const generatedIds = new Set(generatedEvents.map((event) => event.eventId));
  const existingEvents = gameState.seasonState.teamRelationshipEvents ?? [];
  const keptEvents = existingEvents.filter((event) => !generatedIds.has(event.eventId));
  const replacedPreviewEvents = existingEvents.filter(
    (event) => generatedIds.has(event.eventId) && event.source === "system_preview",
  ).length;
  const existingPersistedIds = new Set(
    existingEvents.filter((event) => generatedIds.has(event.eventId) && event.source !== "system_preview").map((event) => event.eventId),
  );

  const nextEvents = [...keptEvents, ...generatedEvents].sort((left, right) => {
    if (left.seasonId !== right.seasonId) return left.seasonId.localeCompare(right.seasonId, "de");
    if ((left.matchdayId ?? "") !== (right.matchdayId ?? "")) return (left.matchdayId ?? "").localeCompare(right.matchdayId ?? "", "de");
    return left.eventId.localeCompare(right.eventId, "de");
  });

  const nextGameState: GameState = {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      teamRelationshipEvents: nextEvents,
    },
  };

  return {
    gameState: nextGameState,
    seasonId: gameState.season.id,
    generatedEvents,
    insertedEvents: generatedEvents.filter((event) => !existingPersistedIds.has(event.eventId)).length,
    replacedPreviewEvents,
    totalEvents: nextEvents.length,
    warnings: generatedEvents.length === 0 ? ["team_relationship_events_no_matchday_source"] : [],
  };
}

export function buildTeamRelationshipCards(gameState: GameState, teamId: string) {
  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));
  const storedEvents = gameState.seasonState.teamRelationshipEvents ?? [];
  const events = storedEvents.length ? storedEvents : buildDerivedTeamRelationshipEvents(gameState);
  const eventDeltas = new Map<string, { delta: number; reasons: string[] }>();
  for (const event of events) {
    if (event.seasonId !== gameState.season.id) continue;
    const key = teamPairKey(event.fromTeamId, event.toTeamId);
    const current = eventDeltas.get(key) ?? { delta: 0, reasons: [] };
    current.delta += event.delta;
    current.reasons.push(event.reason);
    eventDeltas.set(key, current);
  }

  const rows = gameState.teams
    .filter((team) => team.teamId !== teamId)
    .map((team): TeamRelationshipCard | null => {
      const relation = getTeamRelationship(teamId, team.teamId);
      const baseValue = relation?.value ?? 0;
      const eventDelta = eventDeltas.get(teamPairKey(teamId, team.teamId));
      const delta = roundValue(eventDelta?.delta ?? 0, 1);
      const value = roundValue(clamp(baseValue + delta, -5, 5), 1);
      const type = value >= 4 ? "ally" : value <= -4 ? "rival" : null;
      if (!type) return null;
      return {
        teamId: team.teamId,
        teamName: teamById.get(team.teamId)?.name ?? team.name,
        shortCode: team.shortCode,
        baseValue,
        delta,
        value,
        type,
        changed: Math.abs(delta) >= 0.1,
        changeLabel: Math.abs(delta) >= 0.1 ? `${delta > 0 ? "+" : ""}${delta}` : null,
        reasons: Array.from(new Set(eventDelta?.reasons ?? [])),
      };
    })
    .filter((entry): entry is TeamRelationshipCard => Boolean(entry));

  return {
    allies: rows.filter((entry) => entry.type === "ally").sort((left, right) => right.value - left.value || left.teamName.localeCompare(right.teamName, "de")),
    rivals: rows.filter((entry) => entry.type === "rival").sort((left, right) => left.value - right.value || left.teamName.localeCompare(right.teamName, "de")),
  };
}
