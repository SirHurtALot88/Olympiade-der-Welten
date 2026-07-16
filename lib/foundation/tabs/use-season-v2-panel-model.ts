import { useMemo } from "react";

import { getPlayerPortraitMediaModel, getTeamLogoModel } from "@/lib/data/mediaAssets";
import type { GameState } from "@/lib/data/olyDataTypes";
import type { buildTeamObjectiveOverview } from "@/lib/board/team-season-objectives-service";
import {
  getTeamGeneralManager,
  getTeamGeneralManagerProfile,
} from "@/lib/foundation/team-general-managers";
import type { TeamManagementSnapshotRow } from "@/lib/foundation/team-management-overview";
import { resolveSeasonDisciplineAreaTotal } from "@/lib/season/season-discipline-area-groups";

const SEASON_V2_TOP_PLAYER_LIMIT = 32;

type BoardConfidenceMap = ReturnType<typeof buildTeamObjectiveOverview>["boardConfidence"];
type SeasonSnapshotInput = NonNullable<GameState["seasonState"]["seasonSnapshots"]>[number];

/**
 * Player row shape consumed from the parent's `sortedSeasonTopPlayerRows`
 * derivation. Only the fields read by the Season V2 panel model are declared
 * so the (anonymous) source rows stay structurally assignable.
 */
export interface SeasonV2TopPlayerInputRow {
  playerId: string;
  name: string;
  teamId?: string | null;
  teamCode?: string | null;
  teamName?: string | null;
  className?: string | null;
  rank: number;
  pps?: number | null;
  ovr?: number | null;
  mvs?: number | null;
  ppPow?: number | null;
  ppSpe?: number | null;
  ppMen?: number | null;
  ppSoc?: number | null;
}

export interface SeasonV2DisciplineLeaderboardInput {
  disciplineId: string;
  disciplineName: string;
  players: Array<{
    playerId: string;
    playerName: string;
    teamCode?: string | null;
    appearances: number;
    totalContribution?: number | null;
  }>;
}

export interface UseSeasonV2PanelModelInput {
  gameState: GameState;
  selectedTeamId: string | null;
  sortedSeasonStandRows: TeamManagementSnapshotRow[];
  selectedStandingRow: TeamManagementSnapshotRow | null;
  sortedSeasonTopPlayerRows: SeasonV2TopPlayerInputRow[];
  seasonHistorySnapshots: SeasonSnapshotInput[];
  archivedSeasonDisciplineLeaderboards: SeasonV2DisciplineLeaderboardInput[];
  boardConfidence: BoardConfidenceMap;
}

function getPlayerPortraitModel(player: Parameters<typeof getPlayerPortraitMediaModel>[0]) {
  return getPlayerPortraitMediaModel(player);
}

/**
 * Season V2 presentation-derivations (Strangler Phase 4.1). Moved verbatim out
 * of `FoundationPageClient` so the giant orchestrator no longer runs this
 * ~300-line map/sort cluster. The host mounts this hook only while the Season
 * V2 tab is active, so the `seasonV2PanelActive` guards from the parent are no
 * longer needed here.
 */
export function useSeasonV2PanelModel({
  gameState,
  selectedTeamId,
  sortedSeasonStandRows,
  selectedStandingRow,
  sortedSeasonTopPlayerRows,
  seasonHistorySnapshots,
  archivedSeasonDisciplineLeaderboards,
  boardConfidence,
}: UseSeasonV2PanelModelInput) {
  const standingsRows = useMemo(
    () =>
      sortedSeasonStandRows.map((row) => {
        const logo = getTeamLogoModel(row.team, { variant: "thumb" });
        const generalManager = getTeamGeneralManager(gameState, row.teamId);
        return {
          teamId: row.teamId,
          teamName: row.teamName,
          teamCode: row.teamCode,
          gmName: generalManager?.profile.name ?? null,
          gmTitle: generalManager?.profile.title ?? null,
          gmArchetype: generalManager?.profile.archetype ?? null,
          logoUrl: logo.src,
          logoInitials: logo.initials,
          rank: row.rank ?? null,
          rankDiff: row.rankDiff ?? null,
          points: row.points ?? null,
          pps: row.ppsTotal ?? null,
          pow: resolveSeasonDisciplineAreaTotal(row.disciplineValues, "pow", row.ppsPow),
          spe: resolveSeasonDisciplineAreaTotal(row.disciplineValues, "spe", row.ppsSpe),
          men: resolveSeasonDisciplineAreaTotal(row.disciplineValues, "men", row.ppsMen),
          soc: resolveSeasonDisciplineAreaTotal(row.disciplineValues, "soc", row.ppsSoc),
          cash: row.cash ?? null,
          salaryTotal: row.salaryTotal ?? null,
          guv: row.guv ?? null,
          sponsorTotal: row.sponsorTotal ?? null,
          marketValueTotal: row.marketValueTotal ?? null,
          disciplineValues: {
            bonuspunkte: row.disciplineValues.bonuspunkte ?? null,
            tdm: row.disciplineValues.tdm ?? null,
            mini_dm: row.disciplineValues.mini_dm ?? null,
            gewichtheben: row.disciplineValues.gewichtheben ?? null,
            hockey: row.disciplineValues.hockey ?? null,
            breaking: row.disciplineValues.breaking ?? null,
            staffel: row.disciplineValues.staffel ?? null,
            time_trial: row.disciplineValues.time_trial ?? null,
            spurt: row.disciplineValues.spurt ?? null,
            climbing: row.disciplineValues.climbing ?? null,
            fechten: row.disciplineValues.fechten ?? null,
            schach: row.disciplineValues.schach ?? null,
            takeshi: row.disciplineValues.takeshi ?? null,
            tennis: row.disciplineValues.tennis ?? null,
            i_spy: row.disciplineValues.i_spy ?? null,
            wettessen: row.disciplineValues.wettessen ?? null,
            basketball: row.disciplineValues.basketball ?? null,
            football: row.disciplineValues.football ?? null,
            battlefield: row.disciplineValues.battlefield ?? null,
            eiskunst: row.disciplineValues.eiskunst ?? null,
            showcase: row.disciplineValues.showcase ?? null,
          },
          rosterCount: row.rosterCount ?? 0,
          avgContractLength: row.avgContractLength ?? null,
          isSelected: selectedTeamId === row.teamId,
          // Saisonübergreifende Rang-/Punkte-Historie (nur vom "Neuer
          // Look"-Saisonstand gelesen; der bestehende Render ignoriert sie).
          historicalPointsBySeason: row.historicalPointsBySeason ?? [],
        };
      }),
    [gameState, selectedTeamId, sortedSeasonStandRows],
  );

  const topPlayers = useMemo(() => {
    const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
    return sortedSeasonTopPlayerRows.slice(0, SEASON_V2_TOP_PLAYER_LIMIT).map((row) => {
      const player = playerById.get(row.playerId) ?? null;
      const portrait = player ? getPlayerPortraitModel(player) : { src: null, initials: row.name.slice(0, 2).toUpperCase() };
      return {
        playerId: row.playerId,
        name: row.name,
        teamId: row.teamId ?? null,
        teamCode: row.teamCode ?? null,
        teamName: row.teamName ?? null,
        className: row.className ?? null,
        portraitUrl: portrait.src,
        portraitInitials: portrait.initials,
        rank: row.rank,
        pps: row.pps ?? null,
        ovr: row.ovr ?? null,
        mvs: row.mvs ?? null,
        ppPow: row.ppPow ?? null,
        ppSpe: row.ppSpe ?? null,
        ppMen: row.ppMen ?? null,
        ppSoc: row.ppSoc ?? null,
      };
    });
  }, [gameState.players, sortedSeasonTopPlayerRows]);

  const playerRows = useMemo(() => {
    const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
    return sortedSeasonTopPlayerRows.map((row) => {
      const player = playerById.get(row.playerId) ?? null;
      const portrait = player ? getPlayerPortraitModel(player) : { src: null, initials: row.name.slice(0, 2).toUpperCase() };
      return {
        playerId: row.playerId,
        name: row.name,
        teamId: row.teamId ?? null,
        teamCode: row.teamCode ?? null,
        teamName: row.teamName ?? null,
        className: row.className ?? null,
        portraitUrl: portrait.src,
        portraitInitials: portrait.initials,
        rank: row.rank,
        pps: row.pps ?? null,
        ovr: row.ovr ?? null,
        mvs: row.mvs ?? null,
        ppPow: row.ppPow ?? null,
        ppSpe: row.ppSpe ?? null,
        ppMen: row.ppMen ?? null,
        ppSoc: row.ppSoc ?? null,
      };
    });
  }, [gameState.players, sortedSeasonTopPlayerRows]);

  const selectedTeamSummary = useMemo(() => {
    if (!selectedStandingRow) {
      return null;
    }
    return {
      teamId: selectedStandingRow.teamId,
      teamName: selectedStandingRow.teamName,
      teamCode: selectedStandingRow.teamCode,
      rank: selectedStandingRow.rank ?? null,
      points: selectedStandingRow.points ?? null,
      pps: selectedStandingRow.ppsTotal ?? null,
      cash: selectedStandingRow.cash ?? null,
      salaryTotal: selectedStandingRow.salaryTotal ?? null,
      guv: selectedStandingRow.guv ?? null,
      sponsorTotal: selectedStandingRow.sponsorTotal ?? null,
      marketValueTotal: selectedStandingRow.marketValueTotal ?? null,
    };
  }, [selectedStandingRow]);

  const leaderTeam = standingsRows[0] ?? null;

  const momentumTeam = useMemo(
    () =>
      [...standingsRows]
        .filter((row) => (row.rankDiff ?? 0) > 0)
        .sort(
          (left, right) =>
            (right.rankDiff ?? 0) - (left.rankDiff ?? 0) ||
            (left.rank ?? Number.POSITIVE_INFINITY) - (right.rank ?? Number.POSITIVE_INFINITY),
        )[0] ??
      standingsRows[1] ??
      null,
    [standingsRows],
  );

  const pressureTeam = useMemo(
    () =>
      [...standingsRows].sort((left, right) => {
        const leftPressure =
          (left.salaryTotal ?? 0) / Math.max(1, Math.abs(left.cash ?? 0) + Math.abs(left.salaryTotal ?? 0)) +
          ((left.guv ?? 0) < 0 ? Math.abs(left.guv ?? 0) / 1000 : 0);
        const rightPressure =
          (right.salaryTotal ?? 0) / Math.max(1, Math.abs(right.cash ?? 0) + Math.abs(right.salaryTotal ?? 0)) +
          ((right.guv ?? 0) < 0 ? Math.abs(right.guv ?? 0) / 1000 : 0);
        return rightPressure - leftPressure;
      })[0] ?? null,
    [standingsRows],
  );

  const archiveRows = useMemo(
    () =>
      seasonHistorySnapshots.map((snapshot) => ({
        seasonId: snapshot.seasonId,
        seasonName: snapshot.seasonName,
        archivedAt: snapshot.archivedAt ?? null,
        teamCount: snapshot.finalStandings.length,
        playerCount: snapshot.playerPerformances.length,
      })),
    [seasonHistorySnapshots],
  );

  const gmRows = useMemo(
    () =>
      gameState.teams
        .map((team) => {
          const logo = getTeamLogoModel(team, { variant: "thumb" });
          const generalManager = getTeamGeneralManager(gameState, team.teamId);
          const teamBoardConfidence = boardConfidence[team.teamId] ?? null;
          const snapshotHistory = seasonHistorySnapshots
            .map((snapshot) => {
              const snapshotGm = snapshot.gmAssignments?.find((entry) => entry.teamId === team.teamId) ?? null;
              if (!snapshotGm) return null;
              return {
                seasonId: snapshot.seasonId,
                seasonName: snapshot.seasonName,
                gmId: snapshotGm.gmId,
                gmName: snapshotGm.gmName,
                gmTitle: snapshotGm.gmTitle,
                source: snapshotGm.source,
                boardConfidenceValue: snapshotGm.boardConfidenceValue ?? null,
                boardPressure: snapshotGm.boardPressure ?? null,
                previousGmId: snapshotGm.previousGmId ?? null,
                dismissalReason: snapshotGm.dismissalReason ?? null,
              };
            })
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
          const currentHistory = generalManager
            ? [
                {
                  seasonId: gameState.season.id,
                  seasonName: gameState.season.name,
                  gmId: generalManager.profile.gmId,
                  gmName: generalManager.profile.name,
                  gmTitle: generalManager.profile.title,
                  source: generalManager.assignment.source,
                  boardConfidenceValue: teamBoardConfidence?.value ?? null,
                  boardPressure: teamBoardConfidence?.pressure ?? null,
                  previousGmId: generalManager.assignment.previousGmId ?? null,
                  dismissalReason: generalManager.assignment.dismissalReason ?? null,
                },
              ]
            : [];
          return {
            teamId: team.teamId,
            teamName: team.name,
            teamCode: team.shortCode,
            logoUrl: logo.src,
            logoInitials: logo.initials,
            gmId: generalManager?.profile.gmId ?? null,
            gmName: generalManager?.profile.name ?? null,
            gmTitle: generalManager?.profile.title ?? null,
            gmArchetype: generalManager?.profile.archetype ?? null,
            description: generalManager?.profile.description ?? null,
            marketDoctrine: generalManager?.profile.marketDoctrine ?? null,
            lineupDoctrine: generalManager?.profile.lineupDoctrine ?? null,
            facilityPriorities: generalManager?.profile.facilityPriorities ?? [],
            preferredTraits: generalManager?.profile.preferredTraits ?? [],
            influencePct: generalManager?.assignment.influencePct ?? null,
            source: generalManager?.assignment.source ?? null,
            assignedSeasonId: generalManager?.assignment.assignedSeasonId ?? null,
            boardConfidenceValue: teamBoardConfidence?.value ?? null,
            boardPressure: teamBoardConfidence?.pressure ?? null,
            previousGmId: generalManager?.assignment.previousGmId ?? null,
            dismissalReason: generalManager?.assignment.dismissalReason ?? null,
            history: [...currentHistory, ...snapshotHistory].map((entry) => {
              const profile = getTeamGeneralManagerProfile(entry.gmId);
              return {
                ...entry,
                gmTitle: entry.gmTitle || profile?.title || entry.gmId,
                gmName: entry.gmName || profile?.name || entry.gmId,
              };
            }),
          };
        })
        .sort(
          (left, right) =>
            (right.boardPressure ?? 0) - (left.boardPressure ?? 0) ||
            left.teamName.localeCompare(right.teamName, "de"),
        ),
    [boardConfidence, gameState, seasonHistorySnapshots],
  );

  const disciplineLeaders = useMemo(
    () =>
      archivedSeasonDisciplineLeaderboards
        .map((discipline) => {
          const leader = discipline.players[0] ?? null;
          if (!leader) {
            return null;
          }
          return {
            disciplineId: discipline.disciplineId,
            disciplineName: discipline.disciplineName,
            playerId: leader.playerId,
            playerName: leader.playerName,
            teamCode: leader.teamCode ?? null,
            appearances: leader.appearances,
            totalContribution: leader.totalContribution ?? null,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .slice(0, 8),
    [archivedSeasonDisciplineLeaderboards],
  );

  return {
    standingsRows,
    topPlayers,
    playerRows,
    selectedTeamSummary,
    leaderTeam,
    momentumTeam,
    pressureTeam,
    archiveRows,
    gmRows,
    disciplineLeaders,
  };
}
