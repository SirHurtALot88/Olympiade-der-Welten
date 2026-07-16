import type {
  DisciplineResultRecord,
  GameState,
  Player,
  PlayerDisciplinePerformanceRecord,
  PlayerProgressionSpendEventRecord,
  RosterPromisedRole,
  Team,
  TransferHistoryEntry,
} from "@/lib/data/olyDataTypes";
import {
  buildTeamSeasonObjectiveSettlement,
  type TeamSeasonObjectiveSettlement,
} from "@/lib/board/team-season-objectives-service";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";
import { buildPlayerSeasonPerformanceMap } from "@/lib/foundation/player-season-performance";

export type SeasonReviewAward = {
  awardId: string;
  label: string;
  category: "team" | "player" | "transfer" | "discipline";
  winnerType: "team" | "player";
  winnerId: string;
  winnerName: string;
  value: number | string | null;
  reason: string;
  source: string;
};

export type SeasonReviewNamedValue = {
  id: string;
  name: string;
  playerId?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  value: number | string | null;
  label: string;
  source: string;
};

export type SeasonReviewTransferHighlight = {
  transferId: string;
  label: string;
  playerId: string;
  playerName: string;
  teamId: string | null;
  teamName: string | null;
  value: number | null;
  source: string;
};

export type SeasonReviewPromisedRoleSignal = {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  roleTag: string;
  promisedRole: RosterPromisedRole;
  appearances: number;
  expectedAppearances: number;
  source: string;
};

export type SeasonReviewXpDevelopmentRow = {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  seasonId: string;
  xpEarned: number;
  xpSpent: number;
  attributeDelta: number;
  marketValueDelta: number | null;
  salaryPreviewDelta: number | null;
  fairSnapshot: boolean;
  label: string;
  source: string;
};

export type SeasonReviewXpDevelopmentReport = {
  topImproved: SeasonReviewXpDevelopmentRow[];
  bottom20: SeasonReviewXpDevelopmentRow[];
  bottomLabel: "least_improved" | "declined";
  missingFairSnapshot: SeasonReviewXpDevelopmentRow[];
};

export type SeasonReview = {
  championTeam: SeasonReviewNamedValue | null;
  finalTable: SeasonReviewNamedValue[];
  topPlayers: SeasonReviewNamedValue[];
  topDisciplinePerformances: SeasonReviewNamedValue[];
  awards: SeasonReviewAward[];
  storylines: Array<{ storylineId: string; text: string; source: string }>;
  transferHighlights: SeasonReviewTransferHighlight[];
  teamHighlights: SeasonReviewNamedValue[];
  objectiveSettlement: TeamSeasonObjectiveSettlement;
  promisedRoleSignals: SeasonReviewPromisedRoleSignal[];
  xpDevelopmentRankings: SeasonReviewXpDevelopmentReport;
  warnings: string[];
};

function roundValue(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function teamLabel(team: Team | null | undefined) {
  return team?.name ?? team?.shortCode ?? "—";
}

function playerLabel(player: Player | null | undefined) {
  return player?.name ?? "—";
}

function getPromisedRoleExpectedAppearances(role: RosterPromisedRole) {
  if (role === "starter") return 7;
  if (role === "rotation") return 4;
  if (role === "bench") return 2;
  return 1;
}

function getSeasonMatchdayResultIds(gameState: GameState) {
  return new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((entry) => entry.seasonId === gameState.season.id && entry.status !== "voided")
      .map((entry) => entry.id),
  );
}

function buildFinalTable(gameState: GameState) {
  const teamsById = new Map(gameState.teams.map((team) => [team.teamId, team]));
  return Object.entries(gameState.seasonState.standings ?? {})
    .map(([teamId, standing]) => {
      const team = teamsById.get(teamId) ?? null;
      return {
        id: teamId,
        name: teamLabel(team),
        teamId,
        teamName: teamLabel(team),
        value: standing.points,
        rank: standing.rank ?? null,
        label: standing.rank != null ? `#${standing.rank} · ${standing.points} Punkte` : `${standing.points} Punkte`,
        source: "seasonState.standings",
      };
    })
    .sort((left, right) => {
      if (left.rank != null && right.rank != null && left.rank !== right.rank) return left.rank - right.rank;
      if (left.rank != null) return -1;
      if (right.rank != null) return 1;
      return (Number(right.value) || 0) - (Number(left.value) || 0);
    });
}

function buildTeamAxisHighlights(gameState: GameState) {
  const rosterByTeam = new Map<string, Player[]>();
  const playersById = new Map(gameState.players.map((player) => [player.id, player]));
  for (const roster of gameState.rosters) {
    const player = playersById.get(roster.playerId);
    if (!player) continue;
    const list = rosterByTeam.get(roster.teamId) ?? [];
    list.push(player);
    rosterByTeam.set(roster.teamId, list);
  }
  const axisLabels = [
    ["pow", "stärkstes Power-Team", "POW"] as const,
    ["spe", "stärkstes Speed-Team", "SPE"] as const,
    ["men", "stärkstes Mental-Team", "MEN"] as const,
    ["soc", "stärkstes Social-Team", "SOC"] as const,
  ];
  return axisLabels.flatMap(([axis, label, shortLabel]) => {
    const rows: SeasonReviewNamedValue[] = gameState.teams
      .map((team) => {
        const players = rosterByTeam.get(team.teamId) ?? [];
        if (players.length === 0) return null;
        const average = players.reduce((sum, player) => sum + (player.coreStats[axis] ?? 0), 0) / players.length;
        return {
          id: `team-axis-${axis}-${team.teamId}`,
          name: team.name,
          teamId: team.teamId,
          teamName: team.name,
          value: roundValue(average, 1),
          label: `${label}: ${roundValue(average, 1)} ${shortLabel}`,
          source: "rosters.players.coreStats",
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry != null)
      .sort((left, right) => (Number(right.value) || 0) - (Number(left.value) || 0));
    return rows[0] ? [rows[0]] : [];
  });
}

function buildTransferHighlights(gameState: GameState) {
  const teamsById = new Map(gameState.teams.map((team) => [team.teamId, team]));
  const playersById = new Map(gameState.players.map((player) => [player.id, player]));
  const transfers = (gameState.transferHistory ?? []).filter((entry) => entry.seasonId === gameState.season.id);
  const buys = transfers.filter((entry) => entry.transferType === "buy");
  const sells = transfers.filter((entry) => entry.transferType === "sell");
  const transferToHighlight = (entry: TransferHistoryEntry, label: string): SeasonReviewTransferHighlight => {
    const teamId = entry.transferType === "buy" ? entry.toTeamId : entry.fromTeamId;
    const team = teamId ? teamsById.get(teamId) : null;
    return {
      transferId: entry.id,
      label,
      playerId: entry.playerId,
      playerName: playerLabel(playersById.get(entry.playerId)),
      teamId,
      teamName: teamLabel(team),
      value: entry.fee,
      source: "transferHistory",
    };
  };
  const mostExpensiveBuy = [...buys].sort((left, right) => right.fee - left.fee)[0] ?? null;
  const bestValueBuy = [...buys]
    .filter((entry) => isFiniteNumber(entry.marketValue) && entry.fee > 0)
    .sort((left, right) => right.marketValue / Math.max(1, right.fee) - left.marketValue / Math.max(1, left.fee))[0] ?? null;
  const biggestGain = [...sells].sort((left, right) => (right.fee - right.marketValue) - (left.fee - left.marketValue))[0] ?? null;
  const biggestLoss = [...sells].sort((left, right) => (left.fee - left.marketValue) - (right.fee - right.marketValue))[0] ?? null;

  return [
    mostExpensiveBuy ? transferToHighlight(mostExpensiveBuy, "teuerster Kauf") : null,
    bestValueBuy ? transferToHighlight(bestValueBuy, "bester Value-Kauf") : null,
    biggestGain ? transferToHighlight(biggestGain, "größter Verkaufsgewinn") : null,
    biggestLoss ? transferToHighlight(biggestLoss, "größter Verkaufsverlust") : null,
  ].filter((entry): entry is SeasonReviewTransferHighlight => Boolean(entry));
}

function buildDisciplineHighlights(gameState: GameState, resultIds: Set<string>) {
  const playersById = new Map(gameState.players.map((player) => [player.id, player]));
  const teamsById = new Map(gameState.teams.map((team) => [team.teamId, team]));
  const disciplineById = new Map(gameState.disciplines.map((discipline) => [discipline.id, discipline]));
  return (gameState.seasonState.playerDisciplinePerformances ?? [])
    .filter((entry) => resultIds.has(entry.matchdayResultId))
    .map((entry) => {
      const player = playersById.get(entry.playerId);
      const team = teamsById.get(entry.teamId);
      const disciplineName = disciplineById.get(entry.disciplineId)?.name ?? entry.disciplineId;
      return {
        id: entry.id,
        name: playerLabel(player),
        playerId: entry.playerId,
        teamId: entry.teamId,
        teamName: teamLabel(team),
        value: roundValue(entry.finalPlayerScore, 1),
        label: `${disciplineName}: ${roundValue(entry.finalPlayerScore, 1)}`,
        source: "seasonState.playerDisciplinePerformances",
      };
    })
    .sort((left, right) => (Number(right.value) || 0) - (Number(left.value) || 0))
    .slice(0, 8);
}

function buildPromisedRoleSignals(gameState: GameState) {
  const playersById = new Map(gameState.players.map((player) => [player.id, player]));
  const teamsById = new Map(gameState.teams.map((team) => [team.teamId, team]));
  const performances = buildPlayerSeasonPerformanceMap(gameState);
  return gameState.rosters
    .map((roster): SeasonReviewPromisedRoleSignal | null => {
      const promisedRole = roster.promisedRole ?? null;
      if (!promisedRole) return null;
      const expectedAppearances = getPromisedRoleExpectedAppearances(promisedRole);
      const appearances = performances.get(roster.playerId)?.appearances ?? 0;
      if (appearances >= expectedAppearances) return null;
      const player = playersById.get(roster.playerId);
      const team = teamsById.get(roster.teamId);
      return {
        playerId: roster.playerId,
        playerName: playerLabel(player),
        teamId: roster.teamId,
        teamName: teamLabel(team),
        roleTag: roster.roleTag,
        promisedRole,
        appearances,
        expectedAppearances,
        source: "rosters.promisedRole + player-season-performance",
      };
    })
    .filter((entry): entry is SeasonReviewPromisedRoleSignal => Boolean(entry))
    .sort((left, right) => (right.expectedAppearances - right.appearances) - (left.expectedAppearances - left.appearances))
    .slice(0, 12);
}

function buildXpDevelopmentRow(
  gameState: GameState,
  event: PlayerProgressionSpendEventRecord,
): SeasonReviewXpDevelopmentRow {
  const player = gameState.players.find((entry) => entry.id === event.playerId) ?? null;
  const team = gameState.teams.find((entry) => entry.teamId === event.teamId) ?? null;
  const attributeDelta = event.upgrades.reduce((sum, upgrade) => sum + (upgrade.toValue - upgrade.fromValue), 0);
  const beforeMarket = event.progressionSnapshotBefore?.marketValue;
  const afterMarket = event.progressionSnapshotAfter?.marketValuePreview ?? event.progressionSnapshotAfter?.marketValue;
  const beforeSalary = event.progressionSnapshotBefore?.salary;
  const afterSalary = event.progressionSnapshotAfter?.salaryPreview ?? event.progressionSnapshotAfter?.salary;
  const fairSnapshot = event.progressionSnapshotBefore != null && event.progressionSnapshotAfter != null;
  return {
    playerId: event.playerId,
    playerName: playerLabel(player),
    teamId: event.teamId,
    teamName: teamLabel(team),
    seasonId: event.seasonId,
    xpEarned: Math.round(event.xpEarned ?? 0),
    xpSpent: Math.round(event.xpSpent ?? 0),
    attributeDelta,
    marketValueDelta:
      typeof beforeMarket === "number" && typeof afterMarket === "number" ? roundValue(afterMarket - beforeMarket, 2) : null,
    salaryPreviewDelta:
      typeof beforeSalary === "number" && typeof afterSalary === "number" ? roundValue(afterSalary - beforeSalary, 2) : null,
    fairSnapshot,
    label: `${attributeDelta} Attribute · ${Math.round(event.xpEarned ?? 0)} XP earned · ${Math.round(event.xpSpent ?? 0)} XP spent`,
    source: fairSnapshot ? "playerProgressionEvents.beforeAfterSnapshots" : "playerProgressionEvents.missingBeforeAfterSnapshot",
  };
}

function buildXpDevelopmentRankings(gameState: GameState): SeasonReviewXpDevelopmentReport {
  const seasonEvents = (gameState.playerProgressionEvents ?? [])
    .filter((event) => event.seasonId === gameState.season.id)
    .map((event) => buildXpDevelopmentRow(gameState, event));
  const fairRows = seasonEvents.filter((entry) => entry.fairSnapshot);
  const topImproved = [...fairRows]
    .sort((left, right) => (right.attributeDelta - left.attributeDelta) || (right.xpSpent - left.xpSpent) || (right.xpEarned - left.xpEarned))
    .slice(0, 20);
  const hasRegression = fairRows.some((entry) => entry.attributeDelta < 0);
  const bottom20 = [...fairRows]
    .sort((left, right) => (left.attributeDelta - right.attributeDelta) || (left.xpSpent - right.xpSpent) || (left.xpEarned - right.xpEarned))
    .slice(0, 20);
  return {
    topImproved,
    bottom20,
    bottomLabel: hasRegression ? "declined" : "least_improved",
    missingFairSnapshot: seasonEvents.filter((entry) => !entry.fairSnapshot).slice(0, 20),
  };
}

function findDominantDisciplineWin(gameState: GameState, resultIds: Set<string>) {
  const disciplineById = new Map(gameState.disciplines.map((discipline) => [discipline.id, discipline]));
  const teamsById = new Map(gameState.teams.map((team) => [team.teamId, team]));
  const groups = new Map<string, DisciplineResultRecord[]>();
  for (const result of gameState.seasonState.disciplineResults ?? []) {
    if (!resultIds.has(result.matchdayResultId)) continue;
    const key = `${result.matchdayResultId}:${result.disciplineId}:${result.disciplineSide}`;
    groups.set(key, [...(groups.get(key) ?? []), result]);
  }
  const rows: SeasonReviewNamedValue[] = [...groups.values()]
    .map((rows) => {
      const sorted = [...rows].sort((left, right) => right.totalScore - left.totalScore);
      const winner = sorted[0] ?? null;
      const runnerUp = sorted[1] ?? null;
      if (!winner || !runnerUp) return null;
      const disciplineName = disciplineById.get(winner.disciplineId)?.name ?? winner.disciplineId;
      const team = teamsById.get(winner.teamId);
      return {
        id: winner.id,
        name: teamLabel(team),
        teamId: winner.teamId,
        teamName: teamLabel(team),
        value: roundValue(winner.totalScore - runnerUp.totalScore, 1),
        label: `${disciplineName}: +${roundValue(winner.totalScore - runnerUp.totalScore, 1)} Vorsprung`,
        source: "seasonState.disciplineResults",
      } satisfies SeasonReviewNamedValue;
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
    .sort((left, right) => (Number(right.value) || 0) - (Number(left.value) || 0));
  return rows[0] ?? null;
}

function makeAward(input: Omit<SeasonReviewAward, "awardId"> & { awardId: string }): SeasonReviewAward {
  return input;
}

export function buildSeasonReview(gameState: GameState): SeasonReview {
  const warnings: string[] = [];
  const finalTable = buildFinalTable(gameState);
  const championTeam = finalTable[0] ?? null;
  if (!championTeam) warnings.push("standings_source_missing");

  const resultIds = getSeasonMatchdayResultIds(gameState);
  if (resultIds.size === 0) warnings.push("matchday_results_source_missing");

  const playerRatings = buildPlayerRatingContractMap(gameState);
  const playerPerformances = buildPlayerSeasonPerformanceMap(gameState);
  const playersById = new Map(gameState.players.map((player) => [player.id, player]));
  const rostersByPlayerId = new Map(gameState.rosters.map((entry) => [entry.playerId, entry]));
  const teamsById = new Map(gameState.teams.map((team) => [team.teamId, team]));

  const topPlayers = [...playerPerformances.entries()]
    .map(([playerId, performance]) => {
      const player = playersById.get(playerId);
      const roster = rostersByPlayerId.get(playerId);
      const team = roster ? teamsById.get(roster.teamId) : null;
      return {
        id: playerId,
        name: playerLabel(player),
        teamId: team?.teamId ?? null,
        teamName: teamLabel(team),
        value: performance.totalPoints,
        label: `${performance.totalPoints ?? "—"} PPs · ${performance.mvpCount} MVP`,
        source: "player-season-performance",
      };
    })
    .filter((entry) => isFiniteNumber(Number(entry.value)))
    .sort((left, right) => (Number(right.value) || 0) - (Number(left.value) || 0))
    .slice(0, 5);

  const mvsLeader = [...playerRatings.values()]
    .filter((entry) => entry.sourceStatus.mvs === "ready" && entry.mvs != null)
    .sort((left, right) => (right.mvs ?? 0) - (left.mvs ?? 0))[0] ?? null;
  const ppsLeader = [...playerRatings.values()]
    .filter((entry) => entry.sourceStatus.ppsSeason === "ready" && entry.ppsSeason != null)
    .sort((left, right) => (right.ppsSeason ?? 0) - (left.ppsSeason ?? 0))[0] ?? null;

  const topDisciplinePerformances = buildDisciplineHighlights(gameState, resultIds);
  const dominantDisciplineWin = findDominantDisciplineWin(gameState, resultIds);
  const transferHighlights = buildTransferHighlights(gameState);
  const promisedRoleSignals = buildPromisedRoleSignals(gameState);
  const xpDevelopmentRankings = buildXpDevelopmentRankings(gameState);
  const objectiveSettlement = buildTeamSeasonObjectiveSettlement(gameState);
  if (promisedRoleSignals.length > 0) warnings.push("promised_role_usage_gap");
  if (xpDevelopmentRankings.missingFairSnapshot.length > 0) warnings.push("xp_development_before_after_snapshot_missing");
  if (objectiveSettlement.rows.length === 0) warnings.push("board_objective_settlement_missing");
  const teamHighlights = [
    ...buildTeamAxisHighlights(gameState),
    ...(dominantDisciplineWin ? [dominantDisciplineWin] : []),
  ].slice(0, 8);

  const awards: SeasonReviewAward[] = [];
  if (championTeam) {
    awards.push(makeAward({
      awardId: "champion",
      label: "Champion",
      category: "team",
      winnerType: "team",
      winnerId: championTeam.id,
      winnerName: championTeam.name,
      value: championTeam.value,
      reason: championTeam.label,
      source: championTeam.source,
    }));
  }
  if (topPlayers[0]) {
    awards.push(makeAward({
      awardId: "player_of_the_season",
      label: "Player of the Season",
      category: "player",
      winnerType: "player",
      winnerId: topPlayers[0].id,
      winnerName: topPlayers[0].name,
      value: topPlayers[0].value,
      reason: topPlayers[0].label,
      source: topPlayers[0].source,
    }));
  }
  if (mvsLeader) {
    awards.push(makeAward({
      awardId: "mvs_king",
      label: "MVS King",
      category: "player",
      winnerType: "player",
      winnerId: mvsLeader.playerId,
      winnerName: playerLabel(playersById.get(mvsLeader.playerId)),
      value: mvsLeader.mvs,
      reason: `${mvsLeader.mvs} MVS`,
      source: "player-rating-contract.mvs",
    }));
  }
  if (ppsLeader) {
    awards.push(makeAward({
      awardId: "pps_king",
      label: "PPs King",
      category: "player",
      winnerType: "player",
      winnerId: ppsLeader.playerId,
      winnerName: playerLabel(playersById.get(ppsLeader.playerId)),
      value: ppsLeader.ppsSeason,
      reason: `${ppsLeader.ppsSeason} Season-PPs`,
      source: "player-rating-contract.ppsSeason",
    }));
  }
  const bestTransfer = transferHighlights.find((entry) => entry.label === "bester Value-Kauf") ?? null;
  if (bestTransfer) {
    awards.push(makeAward({
      awardId: "best_transfer",
      label: "Best Transfer",
      category: "transfer",
      winnerType: "player",
      winnerId: bestTransfer.playerId,
      winnerName: bestTransfer.playerName,
      value: bestTransfer.value,
      reason: `${bestTransfer.label} für ${bestTransfer.teamName ?? "—"}`,
      source: bestTransfer.source,
    }));
  }
  const disciplineMonster = topDisciplinePerformances[0] ?? null;
  if (disciplineMonster) {
    awards.push(makeAward({
      awardId: "discipline_monster",
      label: "Discipline Monster",
      category: "discipline",
      winnerType: "player",
      winnerId: disciplineMonster.playerId ?? disciplineMonster.id,
      winnerName: disciplineMonster.name,
      value: disciplineMonster.value,
      reason: disciplineMonster.label,
      source: disciplineMonster.source,
    }));
  }

  const storylines = [
    championTeam ? { storylineId: "champion-run", text: `${championTeam.name} beendet die Saison als Champion mit ${championTeam.value} Punkten.`, source: championTeam.source } : null,
    topPlayers[0] ? { storylineId: "player-season-leader", text: `${topPlayers[0].name} war der prägendste Spieler der Saison (${topPlayers[0].label}).`, source: topPlayers[0].source } : null,
    dominantDisciplineWin ? { storylineId: "dominant-discipline-win", text: `${dominantDisciplineWin.name} lieferte den dominantesten Diszi-Sieg: ${dominantDisciplineWin.label}.`, source: dominantDisciplineWin.source } : null,
    transferHighlights[0] ? { storylineId: "transfer-headline", text: `${transferHighlights[0].playerName} war der Transfer-Aufmacher: ${transferHighlights[0].label}.`, source: transferHighlights[0].source } : null,
    promisedRoleSignals[0] ? { storylineId: "promised-role-gap", text: `${promisedRoleSignals[0].playerName} bekam als ${promisedRoleSignals[0].promisedRole} nur ${promisedRoleSignals[0].appearances}/${promisedRoleSignals[0].expectedAppearances} Einsätze.`, source: promisedRoleSignals[0].source } : null,
    xpDevelopmentRankings.topImproved[0] ? { storylineId: "xp-development-leader", text: `${xpDevelopmentRankings.topImproved[0].playerName} führt die XP-Entwicklung an (${xpDevelopmentRankings.topImproved[0].label}).`, source: xpDevelopmentRankings.topImproved[0].source } : null,
  ].filter((entry): entry is { storylineId: string; text: string; source: string } => Boolean(entry));

  return {
    championTeam,
    finalTable,
    topPlayers,
    topDisciplinePerformances,
    awards,
    storylines,
    transferHighlights,
    teamHighlights,
    objectiveSettlement,
    promisedRoleSignals,
    xpDevelopmentRankings,
    warnings,
  };
}
