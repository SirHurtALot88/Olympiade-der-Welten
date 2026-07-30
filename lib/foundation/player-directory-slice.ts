import type { GameState, SeasonState } from "@/lib/data/olyDataTypes";
import { buildGameStateContentSignature, getSeasonDerivations } from "@/lib/foundation/get-season-derivations";
import { buildPlayerLeagueCareerStatsMap } from "@/lib/foundation/player-league-career-stats";
import type { PersistedSeasonDerivationsRecord } from "@/lib/foundation/materialize-season-derivations";
import { hydrateSeasonDerivations } from "@/lib/foundation/materialize-season-derivations";
import type { PlayerSeasonPerformanceSummary } from "@/lib/foundation/player-season-performance";
import { ratingsSliceRowsFromPersisted } from "@/lib/foundation/resolve-slice-save-context";
import {
  buildSeasonRatingsSlice,
  maskRatingsRowForVisibility,
  type SeasonRatingsSlicePlayerRow,
} from "@/lib/foundation/season-ratings-slice";
import { buildPlayerAttributeVisibilityResolver } from "@/lib/foundation/server-player-visibility";

export type PlayerDirectoryPerformanceRow = Pick<
  PlayerSeasonPerformanceSummary,
  | "appearances"
  | "totalPoints"
  | "bestDisciplineLabel"
  | "bestDisciplineScore"
  | "latestMatchdayId"
  | "latestFinalScore"
>;

export type PlayerDirectorySliceResponse = {
  scope: {
    saveId: string;
    seasonId: string;
    contentSignature: string;
  };
  ratingsByPlayerId: Record<string, SeasonRatingsSlicePlayerRow>;
  performanceByPlayerId: Record<string, PlayerDirectoryPerformanceRow>;
  careerStatsByPlayerId: Record<
    string,
    {
      appearances: number;
      totalPps: number;
      seasonsPlayed: number;
    }
  >;
  /**
   * In der laufenden Saison je Disziplin geholte PPs (Disziplin-ID → PPs) aus
   * dem Saison-Ledger — die aufklappbaren Achsen-Spalten der Spielerliste.
   *
   * Warum ueberhaupt im Slice und nicht clientseitig aus dem Ledger? Der
   * Foundation-Client haelt per Default den KOMPAKTEN Payload
   * (`compactFoundationInitialGameState`): dort sind `matchdayResults` /
   * `disciplineResults` auf den AKTIVEN Spieltag beschnitten und
   * `persistedSeasonDerivations` entfernt. Ein clientseitig gebauter
   * `buildSeasonPointsLedger` kennt damit nur den aktiven Spieltag — und ist,
   * solange dieser noch nicht ausgewertet ist, komplett leer. Genau dieselben
   * Werte, die hier als `ppsSeason`/`ppPow`… aus dem SERVER-Ledger kommen,
   * muessen deshalb auch pro Disziplin von hier kommen, sonst stehen in den
   * aufgeklappten Spalten Nullen neben einer gefuellten PPS-Spalte.
   *
   * Bewusst DUENN besetzt: nur Disziplinen mit Punkten stehen drin. Fehlt ein
   * Eintrag, sind es 0 PPs — dieselbe Lesart wie in
   * `buildRosterDisciplinePpsByAxis`. Ein Spieler ohne Punkte fehlt ganz.
   */
  disciplinePointsByPlayerId: Record<string, Record<string, number>>;
  count: number;
};

/** Nur Disziplinen mit tatsaechlichen Punkten — 0/NaN fliegen raus (siehe Feldkommentar). */
function toDisciplinePointsRow(pointsByDiscipline: Record<string, number>): Record<string, number> {
  const row: Record<string, number> = {};
  for (const [disciplineId, points] of Object.entries(pointsByDiscipline)) {
    if (typeof points === "number" && Number.isFinite(points) && points !== 0) {
      row[disciplineId] = points;
    }
  }
  return row;
}

/**
 * Disziplin-PPs aller Spieler aus den Ledger-Summaries. Spieler ohne Punkte
 * tauchen nicht auf (statt mit einem leeren Objekt) — das haelt den Payload
 * klein und aendert die Bedeutung nicht.
 */
function buildDisciplinePointsByPlayerId(
  playerSummariesByPlayerId: Map<string, { pointsByDiscipline: Record<string, number> }>,
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const [playerId, summary] of playerSummariesByPlayerId) {
    const row = toDisciplinePointsRow(summary.pointsByDiscipline ?? {});
    if (Object.keys(row).length > 0) {
      result[playerId] = row;
    }
  }
  return result;
}

function toPerformanceRow(summary: PlayerSeasonPerformanceSummary): PlayerDirectoryPerformanceRow {
  return {
    appearances: summary.appearances,
    totalPoints: summary.totalPoints,
    bestDisciplineLabel: summary.bestDisciplineLabel,
    bestDisciplineScore: summary.bestDisciplineScore,
    latestMatchdayId: summary.latestMatchdayId,
    latestFinalScore: summary.latestFinalScore,
  };
}

type PlayerDirectoryCareerStatsRow = PlayerDirectorySliceResponse["careerStatsByPlayerId"][string];

/** Fog-of-War-Maskierung (T-022): exakte Season-Performance eines nicht
 * gescouteten/fremden Spielers nullen — analog zu `maskAxisCardsForVisibility`
 * im Player-Detail-Drawer, das seasonPoints/allTimePoints bei `"scouted"`
 * ebenfalls entfernt. */
function maskPerformanceRow(): PlayerDirectoryPerformanceRow {
  return {
    appearances: 0,
    totalPoints: null,
    bestDisciplineLabel: null,
    bestDisciplineScore: null,
    latestMatchdayId: null,
    latestFinalScore: null,
  };
}

function maskCareerStatsRow(): PlayerDirectoryCareerStatsRow {
  return {
    appearances: 0,
    totalPps: 0,
    seasonsPlayed: 0,
  };
}

/**
 * Maskiert eine bereits gebaute Player-Directory-Slice-Antwort anhand des
 * anfragenden Teams (T-022). Läuft unabhängig davon, ob der Payload aus dem
 * Live-GameState- oder dem persisted-Projektions-Pfad stammt — beide liefern
 * denselben `PlayerDirectorySliceResponse`-Shape, und der Aufrufer hat in
 * beiden Fällen bereits einen `GameState` mit Roster-/Team-/Scouting-Kontext
 * zur Hand (siehe `resolveSliceSave`, das auch im projectionOnly-Zweig einen
 * materialisierten Slice-GameState zurückgibt).
 */
export function maskPlayerDirectorySliceForRequestingTeam(input: {
  payload: PlayerDirectorySliceResponse;
  gameState: GameState;
  requestingTeamId?: string | null;
}): PlayerDirectorySliceResponse {
  const resolveVisibility = buildPlayerAttributeVisibilityResolver({
    gameState: input.gameState,
    requestingTeamId: input.requestingTeamId,
  });

  const ratingsByPlayerId = Object.fromEntries(
    Object.entries(input.payload.ratingsByPlayerId).map(([playerId, row]) => [
      playerId,
      maskRatingsRowForVisibility(row, resolveVisibility(playerId)),
    ]),
  );
  const performanceByPlayerId = Object.fromEntries(
    Object.entries(input.payload.performanceByPlayerId).map(([playerId, row]) => [
      playerId,
      resolveVisibility(playerId) === "exact" ? row : maskPerformanceRow(),
    ]),
  );
  const careerStatsByPlayerId = Object.fromEntries(
    Object.entries(input.payload.careerStatsByPlayerId).map(([playerId, row]) => [
      playerId,
      resolveVisibility(playerId) === "exact" ? row : maskCareerStatsRow(),
    ]),
  );
  // Disziplin-PPs sind exakte Saison-Leistung — dieselbe Fog-Regel wie
  // `performanceByPlayerId`/`ppsSeason`: nicht sichtbar ⇒ Eintrag faellt weg
  // (die Zelle zeigt dann "—", statt eine Zahl zu verraten).
  const disciplinePointsByPlayerId = Object.fromEntries(
    Object.entries(input.payload.disciplinePointsByPlayerId).filter(
      ([playerId]) => resolveVisibility(playerId) === "exact",
    ),
  );

  return {
    ...input.payload,
    ratingsByPlayerId,
    performanceByPlayerId,
    careerStatsByPlayerId,
    disciplinePointsByPlayerId,
  };
}

export function buildPlayerDirectorySliceFromPersisted(input: {
  saveId: string;
  seasonId: string;
  contentSignature: string;
  persistedRecord: PersistedSeasonDerivationsRecord;
  seasonState: SeasonState;
}): PlayerDirectorySliceResponse {
  const derivations = hydrateSeasonDerivations(input.persistedRecord);
  const ratingsByPlayerId = ratingsSliceRowsFromPersisted(input.persistedRecord);
  const careerStatsByPlayerId = Object.fromEntries(
    buildPlayerLeagueCareerStatsMap(
      {
        season: { id: input.seasonId },
        seasonState: input.seasonState,
      } as GameState,
      {
        currentSeasonPerformanceByPlayerId: derivations.performanceByPlayerId,
        currentSeasonLedger: derivations.ledger,
      },
    ),
  );
  const performanceByPlayerId = Object.fromEntries(
    Array.from(derivations.performanceByPlayerId.entries()).map(
      ([playerId, summary]) => [playerId, toPerformanceRow(summary)] as const,
    ),
  );

  return {
    scope: {
      saveId: input.saveId,
      seasonId: input.seasonId,
      contentSignature: input.contentSignature,
    },
    ratingsByPlayerId,
    performanceByPlayerId,
    careerStatsByPlayerId,
    disciplinePointsByPlayerId: buildDisciplinePointsByPlayerId(derivations.ledger.playerSummariesByPlayerId),
    count: Object.keys(ratingsByPlayerId).length,
  };
}

export function buildPlayerDirectorySlice(input: {
  gameState: GameState;
  saveId: string;
  seasonId?: string;
  contentSignature?: string | null;
}): PlayerDirectorySliceResponse {
  const seasonId = input.seasonId ?? input.gameState.season.id;
  const contentSignature = input.contentSignature ?? buildGameStateContentSignature(input.gameState);
  const derivations = getSeasonDerivations({
    gameState: input.gameState,
    saveId: input.saveId,
    seasonId,
    contentSignature,
  });
  const ratingsSlice = buildSeasonRatingsSlice({
    gameState: input.gameState,
    saveId: input.saveId,
    seasonId,
    contentSignature,
  });
  const careerStatsByPlayerId = Object.fromEntries(
    buildPlayerLeagueCareerStatsMap(input.gameState, {
      currentSeasonPerformanceByPlayerId: derivations.performanceByPlayerId,
      currentSeasonLedger: derivations.ledger,
    }),
  );

  const performanceByPlayerId = Object.fromEntries(
    Array.from(derivations.performanceByPlayerId.entries()).map(
      ([playerId, summary]) => [playerId, toPerformanceRow(summary)] as const,
    ),
  );

  return {
    scope: {
      saveId: input.saveId,
      seasonId,
      contentSignature,
    },
    ratingsByPlayerId: ratingsSlice.ratingsByPlayerId,
    performanceByPlayerId,
    careerStatsByPlayerId,
    disciplinePointsByPlayerId: buildDisciplinePointsByPlayerId(derivations.ledger.playerSummariesByPlayerId),
    count: Object.keys(ratingsSlice.ratingsByPlayerId).length,
  };
}
