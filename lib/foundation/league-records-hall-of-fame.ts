import type { GameState, SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import { buildAllTimeTableFromSnapshots, resolveSeasonSnapshotTeamRecords } from "@/lib/season/season-snapshot-helpers";
import { buildPlayerLeagueCareerStatsMap } from "@/lib/foundation/player-league-career-stats";
import { getCanonicalSeasonLabel } from "@/lib/season/season-label";

/**
 * Rekorde & Hall of Fame — ligaweite Superlative über alle archivierten
 * Saisons (`gameState.seasonState.seasonSnapshots`).
 *
 * Grounding notes:
 * - Alles hier ist real aus Snapshot-Daten abgeleitet, nie erfunden. Fehlt
 *   ein Datenpunkt (z. B. keine Transfer-Snapshots), bleibt das jeweilige
 *   Feld `null` statt eines Platzhalter-Werts.
 * - Medaillen-Tabelle nutzt den bestehenden Selector
 *   `buildAllTimeTableFromSnapshots` (season-snapshot-helpers) statt einer
 *   eigenen Zweit-Implementierung.
 * - Karriere-Auftritte/PPs kommen aus `buildPlayerLeagueCareerStatsMap`
 *   (player-league-career-stats), ebenfalls bereits vorhandener Selector.
 * - MW = Marktwert (Geld). MVS = Market Value Score (Fame). Board-Confidence
 *   ist ein 0–100-Indexwert aus den GM-Snapshots je Saison.
 */

export type LeagueRecordChampionRow = {
  teamId: string;
  teamCode: string;
  teamName: string;
  gold: number;
  silver: number;
  bronze: number;
  seasonsPlayed: number;
};

export type PeakSquadMarketValueRecord = {
  teamId: string;
  teamCode: string;
  teamName: string;
  seasonLabel: string;
  value: number;
};

export type RecordTransferFeeEntry = {
  playerId: string;
  playerName: string;
  fromTeamName: string | null;
  toTeamName: string | null;
  seasonLabel: string;
  amount: number;
  type: "buy" | "sell";
};

export type HighestBoardConfidenceEntry = {
  teamId: string;
  teamCode: string;
  teamName: string;
  gmName: string;
  seasonLabel: string;
  value: number;
};

export type BiggestMwJumpEntry = {
  playerId: string;
  playerName: string;
  teamName: string | null;
  seasonLabel: string;
  fromValue: number;
  toValue: number;
  delta: number;
};

export type PlayerCareerLeaderRow = {
  playerId: string;
  playerName: string;
  teamName: string | null;
  /** Alle Teams, für die der Spieler über die Snapshot-Historie Auftritte hatte (chronologisch, dedupliziert). */
  teams: string[];
  appearances: number;
  totalPps: number;
  seasonsPlayed: number;
  mvpTotal: number;
};

/** Season-für-Season-Meister (Rang 1/2/3 aus `finalStandings`) — Trophäenschrank-Ansicht. */
export type SeasonChampionEntry = {
  seasonId: string;
  seasonLabel: string;
  goldTeamId: string;
  goldTeamCode: string;
  goldTeamName: string;
  silverTeamName: string | null;
  bronzeTeamName: string | null;
};

export type LeagueRecordsHallOfFame = {
  hasHistory: boolean;
  seasonCount: number;
  champions: LeagueRecordChampionRow[];
  /** Season-für-Season-Chronik (neueste zuerst) — für die Trophäenschrank-Ansicht. */
  seasonChampions: SeasonChampionEntry[];
  peakSquadMarketValue: PeakSquadMarketValueRecord | null;
  recordTransferFee: RecordTransferFeeEntry | null;
  highestBoardConfidence: HighestBoardConfidenceEntry | null;
  biggestMwJump: BiggestMwJumpEntry | null;
  careerAppearancesLeader: PlayerCareerLeaderRow | null;
  careerPpsLeader: PlayerCareerLeaderRow | null;
  careerMvpLeader: PlayerCareerLeaderRow | null;
  /** Kompakte Top-8-Liste (Rekorde-Tab, unverändert für Bestandskompatibilität). */
  careerLeaderboard: PlayerCareerLeaderRow[];
  /** Erweiterte Liste (Top 25) für die "Legendäre Spieler"-Sektion. */
  legendaryPlayers: PlayerCareerLeaderRow[];
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getSeasonSortValue(seasonId: string) {
  const numericMatch = seasonId.match(/(\d+)$/);
  return numericMatch ? Number(numericMatch[1]) : Number.NEGATIVE_INFINITY;
}

function sortSnapshotsAsc(snapshots: SeasonSnapshotRecord[]): SeasonSnapshotRecord[] {
  return [...snapshots].sort((left, right) => {
    const leftValue = getSeasonSortValue(left.seasonId);
    const rightValue = getSeasonSortValue(right.seasonId);
    if (Number.isFinite(leftValue) && Number.isFinite(rightValue) && leftValue !== rightValue) {
      return leftValue - rightValue;
    }
    return left.seasonId.localeCompare(right.seasonId, "de", { numeric: true });
  });
}

function seasonLabelOf(snapshot: SeasonSnapshotRecord): string {
  return getCanonicalSeasonLabel({ seasonId: snapshot.seasonId, seasonName: snapshot.seasonName });
}

export function buildLeagueRecordsHallOfFame(gameState: GameState): LeagueRecordsHallOfFame {
  const snapshots = sortSnapshotsAsc(
    (gameState.seasonState.seasonSnapshots ?? []).filter((snapshot) => (snapshot.finalStandings?.length ?? 0) > 0),
  );

  const champions: LeagueRecordChampionRow[] = buildAllTimeTableFromSnapshots(snapshots, gameState.teams)
    .filter((row) => row.hasHistory)
    .map((row) => ({
      teamId: row.teamId,
      teamCode: row.teamCode,
      teamName: row.teamName,
      gold: row.gold,
      silver: row.silver,
      bronze: row.bronze,
      seasonsPlayed: row.seasonsPlayed,
    }));

  // --- Season-für-Season-Meister (Trophäenschrank) ----------------------
  const seasonChampions: SeasonChampionEntry[] = [...snapshots]
    .reverse()
    .map((snapshot) => {
      const standings = [...(snapshot.finalStandings ?? [])].sort(
        (left, right) => (left.rank ?? Number.POSITIVE_INFINITY) - (right.rank ?? Number.POSITIVE_INFINITY),
      );
      const gold = standings.find((row) => row.rank === 1) ?? standings[0] ?? null;
      if (!gold) {
        return null;
      }
      const silver = standings.find((row) => row.rank === 2) ?? null;
      const bronze = standings.find((row) => row.rank === 3) ?? null;
      return {
        seasonId: snapshot.seasonId,
        seasonLabel: seasonLabelOf(snapshot),
        goldTeamId: gold.teamId,
        goldTeamCode: gold.teamCode,
        goldTeamName: gold.teamName,
        silverTeamName: silver?.teamName ?? null,
        bronzeTeamName: bronze?.teamName ?? null,
      } satisfies SeasonChampionEntry;
    })
    .filter((entry): entry is SeasonChampionEntry => entry != null);

  // --- Höchster Kaderwert (Team, Saisonende) --------------------------
  let peakSquadMarketValue: PeakSquadMarketValueRecord | null = null;
  for (const snapshot of snapshots) {
    for (const row of resolveSeasonSnapshotTeamRecords(snapshot)) {
      const value = row.marketValueTotalEnd ?? row.marketValueEnd ?? null;
      if (isFiniteNumber(value) && (peakSquadMarketValue == null || value > peakSquadMarketValue.value)) {
        peakSquadMarketValue = {
          teamId: row.teamId,
          teamCode: row.teamCode,
          teamName: row.teamName,
          seasonLabel: seasonLabelOf(snapshot),
          value,
        };
      }
    }
  }

  // --- Rekord-Transferablöse -------------------------------------------
  let recordTransferFee: RecordTransferFeeEntry | null = null;
  for (const snapshot of snapshots) {
    for (const transfer of snapshot.transferSnapshots ?? []) {
      if (transfer.type === "contract_exit") continue;
      if (!isFiniteNumber(transfer.amount) || transfer.amount <= 0) continue;
      if (recordTransferFee == null || transfer.amount > recordTransferFee.amount) {
        recordTransferFee = {
          playerId: transfer.playerId,
          playerName: transfer.playerName,
          fromTeamName: transfer.fromTeamName,
          toTeamName: transfer.toTeamName,
          seasonLabel: seasonLabelOf(snapshot),
          amount: transfer.amount,
          type: transfer.type,
        };
      }
    }
  }

  // --- Höchstes Board-Vertrauen -----------------------------------------
  let highestBoardConfidence: HighestBoardConfidenceEntry | null = null;
  for (const snapshot of snapshots) {
    for (const gm of snapshot.gmAssignments ?? []) {
      if (!isFiniteNumber(gm.boardConfidenceValue)) continue;
      if (highestBoardConfidence == null || gm.boardConfidenceValue > highestBoardConfidence.value) {
        highestBoardConfidence = {
          teamId: gm.teamId,
          teamCode: gm.teamCode,
          teamName: gm.teamName,
          gmName: gm.gmName,
          seasonLabel: seasonLabelOf(snapshot),
          value: gm.boardConfidenceValue,
        };
      }
    }
  }

  // --- Größter Marktwert-Sprung (Saison zu Saison, ligaweit) ------------
  const marketValueHistoryByPlayerId = new Map<
    string,
    Array<{ seasonLabel: string; marketValue: number; playerName: string; teamName: string | null }>
  >();
  for (const snapshot of snapshots) {
    for (const performance of snapshot.playerPerformances ?? []) {
      if (!isFiniteNumber(performance.marketValue)) continue;
      const history = marketValueHistoryByPlayerId.get(performance.playerId) ?? [];
      history.push({
        seasonLabel: seasonLabelOf(snapshot),
        marketValue: performance.marketValue,
        playerName: performance.playerName,
        teamName: performance.teamName,
      });
      marketValueHistoryByPlayerId.set(performance.playerId, history);
    }
  }

  let biggestMwJump: BiggestMwJumpEntry | null = null;
  for (const [playerId, history] of marketValueHistoryByPlayerId.entries()) {
    for (let index = 1; index < history.length; index += 1) {
      const previous = history[index - 1];
      const current = history[index];
      const delta = Number((current.marketValue - previous.marketValue).toFixed(2));
      if (delta > 0 && (biggestMwJump == null || delta > biggestMwJump.delta)) {
        biggestMwJump = {
          playerId,
          playerName: current.playerName,
          teamName: current.teamName,
          seasonLabel: current.seasonLabel,
          fromValue: previous.marketValue,
          toValue: current.marketValue,
          delta,
        };
      }
    }
  }

  // --- Karriere-Leaderboard (Auftritte / PPs / MVP) ----------------------
  const careerStatsMap = buildPlayerLeagueCareerStatsMap(gameState);
  const latestIdentityByPlayerId = new Map<string, { playerName: string; teamName: string | null }>();
  const mvpTotalByPlayerId = new Map<string, number>();
  const teamsByPlayerId = new Map<string, string[]>();
  for (const snapshot of snapshots) {
    for (const performance of snapshot.playerPerformances ?? []) {
      latestIdentityByPlayerId.set(performance.playerId, {
        playerName: performance.playerName,
        teamName: performance.teamName,
      });
      const mvpCount = isFiniteNumber(performance.mvpCount) ? performance.mvpCount : 0;
      mvpTotalByPlayerId.set(performance.playerId, (mvpTotalByPlayerId.get(performance.playerId) ?? 0) + mvpCount);
      if (performance.teamName) {
        const teams = teamsByPlayerId.get(performance.playerId) ?? [];
        if (!teams.includes(performance.teamName)) {
          teams.push(performance.teamName);
        }
        teamsByPlayerId.set(performance.playerId, teams);
      }
    }
  }

  const careerLeaderboard: PlayerCareerLeaderRow[] = [...careerStatsMap.entries()]
    .map(([playerId, stats]) => {
      const identity = latestIdentityByPlayerId.get(playerId) ?? null;
      return {
        playerId,
        playerName: identity?.playerName ?? playerId,
        teamName: identity?.teamName ?? null,
        teams: teamsByPlayerId.get(playerId) ?? (identity?.teamName ? [identity.teamName] : []),
        appearances: stats.appearances,
        totalPps: stats.totalPps,
        seasonsPlayed: stats.seasonsPlayed,
        mvpTotal: mvpTotalByPlayerId.get(playerId) ?? 0,
      } satisfies PlayerCareerLeaderRow;
    })
    .sort((left, right) => right.totalPps - left.totalPps);

  const careerAppearancesLeader =
    [...careerLeaderboard].sort((left, right) => right.appearances - left.appearances)[0] ?? null;
  const careerPpsLeader = careerLeaderboard[0] ?? null;
  const mvpLeaderCandidate =
    [...careerLeaderboard].sort((left, right) => right.mvpTotal - left.mvpTotal)[0] ?? null;
  const careerMvpLeader = mvpLeaderCandidate && mvpLeaderCandidate.mvpTotal > 0 ? mvpLeaderCandidate : null;

  return {
    hasHistory: snapshots.length > 0,
    seasonCount: snapshots.length,
    champions,
    seasonChampions,
    peakSquadMarketValue,
    recordTransferFee,
    highestBoardConfidence,
    biggestMwJump,
    careerAppearancesLeader: careerAppearancesLeader && careerAppearancesLeader.appearances > 0 ? careerAppearancesLeader : null,
    careerPpsLeader: careerPpsLeader && careerPpsLeader.totalPps > 0 ? careerPpsLeader : null,
    careerMvpLeader,
    careerLeaderboard: careerLeaderboard.slice(0, 8),
    legendaryPlayers: careerLeaderboard.slice(0, 25),
  };
}
