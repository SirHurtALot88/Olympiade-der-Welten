import type {
  DisciplineCategory,
  DisciplineResultRecord,
  GameState,
  MatchdayResultRecord,
  PlayerDisciplinePerformanceRecord,
} from "@/lib/data/olyDataTypes";
import { istDuellWertung, ppAusSpielerScore, resolveSpielerPpReferenz } from "@/lib/resolve/battle-mode-pps-duell";
import { resolveAwardedPlayerPoints } from "@/lib/foundation/player-points-total";
import { isFiniteNumber, roundValue } from "@/lib/foundation/foundation-number-utils";
import { distributeRankPointsToPlayers, resolveDisciplinePlayerCount } from "@/lib/resolve/rank-to-points";

type LedgerPointSource =
  | "rank_to_points_final_score_share"
  | "rank_to_points_base_share_fallback"
  | "rank_to_points_score_share_fallback"
  | "final_player_score"
  | "score_contribution"
  | "share_times_team_total"
  | "final_player_score_without_team_total"
  | "score_contribution_without_team_total"
  // PP-BUDGET, REIN LEISTUNGSBASIERT (Teil A, Chris 19.10.): Spieler-PP einer Duell-Zeile
  // (`resolutionSource` `"arena"`/`"pps_duell"`) folgen NICHT mehr dem 2/1/0-Team-Budget, sondern
  // `ppAusSpielerScore()` -- s. Kommentar an `derivePlayerPointsForDuellGroup()` unten.
  | "battle_mode_arena_boxscore_impact"
  | "battle_mode_pps_duell_player_score";

export type SeasonPlayerPointLedgerEntry = {
  performanceId: string;
  matchdayResultId: string;
  matchdayId: string | null;
  seasonId: string;
  teamId: string;
  playerId: string;
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  basePoints: number;
  mutatorPpsBonus: number;
  points: number;
  pointSource: LedgerPointSource;
  baseValue: number;
  finalPlayerScore: number;
  rawScoreContribution: number;
  rankInTeam: number;
  rankInDiscipline: number;
  isTop10: boolean;
  isMvpCandidate: boolean;
  warnings: string[];
};

export type SeasonTeamPointsSummary = {
  teamId: string;
  totalPoints: number;
  mutatorPpsBonus: number;
  pointsByArea: Record<DisciplineCategory, number>;
  pointsByDiscipline: Record<string, number>;
  playerDerivedTotal: number;
  reconciliationStatus: "reconciled" | "reconciliation_failed" | "missing_player_points";
  warnings: string[];
};

export type SeasonPlayerPointsSummary = {
  playerId: string;
  totalPoints: number;
  appearances: number;
  pointsByArea: Record<DisciplineCategory, number>;
  pointsByDiscipline: Record<string, number>;
  pointsByTeamId: Record<string, number>;
  warnings: string[];
};

/**
 * Der Tabellen-Beitrag EINER Gruppe (Team + Disziplin + Seite an einem Spieltag) -- fuer eine
 * Duell-Zeile `teamResult.teamPoints` (2/1/0), fuer eine Manager-Mode-Zeile Σ Spieler-`points`
 * dieser Gruppe (bit-identisch zur bisherigen Summe). GENAU DIESELBE Groesse, die auch in
 * `teamSummary.totalPoints` einfliesst -- hier zusaetzlich mit `matchdayId` markiert, damit
 * `season-matchday-points.ts` (Spieltagsrang/"Tagespunkte") dieselbe Waehrung verwendet wie die
 * Saisontabelle, statt (seit dem PP-Budget, Teil A, 19.10.) ueber `pointEntries` die jetzt
 * leistungsbasierten Spieler-PP direkt zu summieren -- das wuerde fuer Battle-Saves denselben
 * Fehlerklasse reproduzieren, die diese Datei fuer den Mutator-Bonus schon einmal behoben hat
 * ("Platz 1 im Spieltag, aber nur 2. in der Saison").
 */
export type SeasonTableGroupContribution = {
  matchdayId: string | null;
  teamId: string;
  disciplineId: string;
  points: number;
};

export type SeasonPointsLedger = {
  hasResultSource: boolean;
  pointEntries: SeasonPlayerPointLedgerEntry[];
  pointEntriesByPerformanceId: Map<string, SeasonPlayerPointLedgerEntry>;
  teamSummariesByTeamId: Map<string, SeasonTeamPointsSummary>;
  playerSummariesByPlayerId: Map<string, SeasonPlayerPointsSummary>;
  tableGroupContributions: SeasonTableGroupContribution[];
  warnings: string[];
};

function isWithinTolerance(left: number, right: number, tolerance = 0.2) {
  return Math.abs(left - right) <= tolerance;
}

function toDisciplineResultKey(result: Pick<DisciplineResultRecord, "matchdayResultId" | "teamId" | "disciplineId" | "disciplineSide">) {
  return `${result.matchdayResultId}::${result.teamId}::${result.disciplineId}::${result.disciplineSide}`;
}

function toPerformanceGroupKey(
  performance: Pick<PlayerDisciplinePerformanceRecord, "matchdayResultId" | "teamId" | "disciplineId" | "disciplineSide">,
) {
  return `${performance.matchdayResultId}::${performance.teamId}::${performance.disciplineId}::${performance.disciplineSide}`;
}

function choosePointSource(
  performances: PlayerDisciplinePerformanceRecord[],
  teamTotal: number | null,
) {
  const summedFinalPlayerScore = roundValue(
    performances.reduce((sum, performance) => sum + (isFiniteNumber(performance.finalPlayerScore) ? performance.finalPlayerScore : 0), 0),
    4,
  );
  const summedScoreContribution = roundValue(
    performances.reduce((sum, performance) => sum + (isFiniteNumber(performance.scoreContribution) ? performance.scoreContribution : 0), 0),
    4,
  );
  const scoreContributionLooksLikeShare =
    teamTotal != null &&
    performances.length > 0 &&
    performances.every(
      (performance) =>
        isFiniteNumber(performance.scoreContribution) &&
        performance.scoreContribution >= 0 &&
        performance.scoreContribution <= 1.0001,
    ) &&
    isWithinTolerance(summedScoreContribution, 1, 0.05);

  if (teamTotal != null && isWithinTolerance(summedFinalPlayerScore, teamTotal)) {
    return "final_player_score" as const;
  }

  if (teamTotal != null && isWithinTolerance(summedScoreContribution, teamTotal)) {
    return "score_contribution" as const;
  }

  if (scoreContributionLooksLikeShare) {
    return "share_times_team_total" as const;
  }

  if (
    teamTotal == null &&
    performances.some(
      (performance) =>
        isFiniteNumber(performance.scoreContribution) &&
        (performance.scoreContribution > 1.0001 || performance.scoreContribution < 0),
    )
  ) {
    return "score_contribution_without_team_total" as const;
  }

  if (teamTotal == null && summedScoreContribution > 1.05) {
    return "score_contribution_without_team_total" as const;
  }

  if (teamTotal == null && performances.some((performance) => isFiniteNumber(performance.finalPlayerScore))) {
    return "final_player_score_without_team_total" as const;
  }

  return "score_contribution_without_team_total" as const;
}

function derivePointsFromPerformance(
  performance: PlayerDisciplinePerformanceRecord,
  pointSource: LedgerPointSource,
  teamTotal: number | null,
) {
  switch (pointSource) {
    case "final_player_score":
    case "final_player_score_without_team_total":
      return roundValue(performance.finalPlayerScore, 4);
    case "score_contribution":
    case "score_contribution_without_team_total":
      return roundValue(performance.scoreContribution, 4);
    case "share_times_team_total":
      return roundValue((teamTotal ?? 0) * performance.scoreContribution, 4);
  }
}

function deriveRankPointsFromPerformances(
  gameState: GameState,
  matchdayId: string | null,
  performances: PlayerDisciplinePerformanceRecord[],
  teamResult: DisciplineResultRecord | null,
) {
  const reference = performances[0];
  if (!reference || !teamResult) {
    return null;
  }

  const playerCount = resolveDisciplinePlayerCount(gameState, {
    matchdayId,
    disciplineId: reference.disciplineId,
    disciplineSide: reference.disciplineSide,
  });
  const distributed = distributeRankPointsToPlayers({
    playerCount,
    rank: teamResult.rank,
    entries: performances,
    // PP-BUDGET (Teil A, 19.10.): dieser Pfad ist jetzt NUR noch fuer Manager-Mode-Zeilen
    // (`resolutionSource: "pps"`) in Benutzung -- `buildSeasonPointsLedger()` ruft ihn fuer jede
    // Duell-Zeile (`istDuellWertung(teamResult)`) gar nicht mehr auf, s.
    // `derivePlayerPointsForDuellGroup()`. `teamPointsOverride` bleibt deshalb immer `null`
    // (bis 19.10.: `istDuellWertung(teamResult) ? teamResult.teamPoints : null`, der 2/1/0-Anteil,
    // den `ppAusSpielerScore()` ersetzt hat).
    teamPointsOverride: null,
  });

  if (distributed.teamPoints == null) {
    return null;
  }

  return distributed;
}

/**
 * PP-BUDGET, REIN LEISTUNGSBASIERT (Teil A, Chris 19.10., "bei PP waere ich bei Fable, die PPs
 * haengen vom Impact Rating der Spieler ab! Ein guter Spieler im schlechten Verlierer-Team kann
 * also trotzdem viele Punkte sammeln!"). ERSETZT `deriveRankPointsFromPerformances()` fuer
 * Duell-Zeilen (`istDuellWertung(teamResult)`) -- der Rang-/Team-Budget-Pfad bleibt dafuer komplett
 * unberuehrt (Manager-Mode, `resolutionSource: "pps"`, bit-identisch).
 *
 * ARENA ("arena"): der persistierte `performance.scoreContribution` -- seit der Engine-Aenderung
 * derselbe Wert, den die Live-Buehne zeigt (`ppsAusArenaImpact()`-Boxscore-Wert, falls vorhanden,
 * sonst der bisherige PPS-Rang-Nachschlag) -- wird VERTRAUT, nicht neu gerechnet. "Gezeigt == gebucht".
 *
 * PPS-DUELL ("pps_duell"): deterministisch aus dem persistierten `performance.finalPlayerScore` +
 * der gezogenen Referenz NEU gerechnet, nicht aus dem persistierten Wert gelesen -- das heilt
 * bestehende Battle-Saves (die noch den alten 2/1/0-Anteil persistiert haben) beim blossen Lesen,
 * ohne Migration.
 */
function derivePlayerPointsForDuellGroup(
  gameState: GameState,
  matchdayId: string | null,
  performances: PlayerDisciplinePerformanceRecord[],
  teamResult: DisciplineResultRecord,
): { pointSource: LedgerPointSource; pointsByPerformanceId: Map<string, number> } | null {
  if (!istDuellWertung(teamResult)) {
    return null;
  }

  if (teamResult.resolutionSource === "arena") {
    const pointsByPerformanceId = new Map(
      performances.map((performance) => [performance.id, roundValue(performance.scoreContribution ?? 0, 4)] as const),
    );
    return { pointSource: "battle_mode_arena_boxscore_impact", pointsByPerformanceId };
  }

  const reference = performances[0];
  if (!reference) {
    return null;
  }
  const playerCount = resolveDisciplinePlayerCount(gameState, {
    matchdayId,
    disciplineId: reference.disciplineId,
    disciplineSide: reference.disciplineSide,
  });
  const referenz = resolveSpielerPpReferenz(reference.disciplineId, playerCount);
  const pointsByPerformanceId = new Map(
    performances.map((performance) => [performance.id, ppAusSpielerScore(performance.finalPlayerScore, referenz)] as const),
  );
  return { pointSource: "battle_mode_pps_duell_player_score", pointsByPerformanceId };
}

function buildSeasonResultLookup(
  gameState: GameState,
  seasonId: string,
) {
  const seasonMatchdayResults = (gameState.seasonState.matchdayResults ?? []).filter(
    (result) => result.seasonId === seasonId && result.status === "preview_applied",
  );
  const matchdayResultById = new Map<string, MatchdayResultRecord>(
    seasonMatchdayResults.map((result) => [result.id, result] as const),
  );
  const seasonResultIds = new Set(matchdayResultById.keys());

  return {
    seasonMatchdayResults,
    matchdayResultById,
    seasonResultIds,
  };
}

export function buildSeasonPointsLedger(
  gameState: GameState,
  seasonId: string = gameState.season.id,
): SeasonPointsLedger {
  const { seasonMatchdayResults, matchdayResultById, seasonResultIds } = buildSeasonResultLookup(gameState, seasonId);
  const disciplineCategoryById = new Map(
    gameState.disciplines.map((discipline) => [discipline.id, discipline.category] as const),
  );
  const disciplineIds = gameState.disciplines.map((discipline) => discipline.id);
  const warnings: string[] = [];

  const seasonDisciplineResults = (gameState.seasonState.disciplineResults ?? []).filter((result) =>
    seasonResultIds.has(result.matchdayResultId),
  );

  /**
   * EIN SPIELTAG OHNE DISZIPLIN-ERGEBNISSE WIRD NICHT GEBUCHT.
   *
   * Ohne diese Grenze rechnet der Ledger im Browser plausible falsche Zahlen. Der kompakte
   * Payload beschneidet `disciplineResults` auf den aktiven Spieltag (zu Recht, sie sind die
   * schwere Fracht), waehrend `playerDisciplinePerformances` und — seit dem Saisonziel-Fix —
   * auch `matchdayResults` vollstaendig mitfahren. Die Leistungszeilen kamen damit alle durch,
   * ihr Disziplin-Ergebnis fehlte aber: `teamTotal` blieb null, und die Punkte fielen auf eine
   * Ersatzquelle zurueck — den ROHBEITRAG statt der gewerteten Punkte. Nachgemessen am
   * Testfall: 33,3 PP, wo der volle Save 4,9 sagt.
   *
   * Ein sichtbar leeres Feld ist reparierbar, eine falsche Zahl wird geglaubt
   * (docs/TRAINING_PERFORMANCE_ANTEIL_BEFUND.md). Ein Spieltag, zu dem kein einziges
   * Disziplin-Ergebnis vorliegt, ist nicht gewertet — fuer den gibt es keine Punkte zu buchen,
   * weder hier noch anderswo. Auf dem vollen Save aendert die Regel nichts: dort traegt jeder
   * gewertete Spieltag seine Disziplin-Ergebnisse.
   */
  const resultIdsWithDisciplineCoverage = new Set(
    seasonDisciplineResults.map((result) => result.matchdayResultId),
  );
  const uncoveredResultIds = [...seasonResultIds].filter((id) => !resultIdsWithDisciplineCoverage.has(id));
  if (uncoveredResultIds.length > 0) {
    warnings.push(`skipped_matchdays_without_discipline_results:${uncoveredResultIds.length}`);
  }

  const seasonPlayerPerformances = (gameState.seasonState.playerDisciplinePerformances ?? []).filter((performance) =>
    resultIdsWithDisciplineCoverage.has(performance.matchdayResultId),
  );

  const disciplineResultByKey = new Map(
    seasonDisciplineResults.map((result) => [toDisciplineResultKey(result), result] as const),
  );
  const groupedPerformances = new Map<string, PlayerDisciplinePerformanceRecord[]>();

  for (const performance of seasonPlayerPerformances) {
    const key = toPerformanceGroupKey(performance);
    const currentGroup = groupedPerformances.get(key) ?? [];
    currentGroup.push(performance);
    groupedPerformances.set(key, currentGroup);
  }

  const pointEntries: SeasonPlayerPointLedgerEntry[] = [];
  // PP-BUDGET, REIN LEISTUNGSBASIERT (Teil A): `teamSummary.totalPoints` einer Duell-Zeile darf NICHT
  // mehr Σ Spieler-PP sein (die folgen jetzt `ppAusSpielerScore()`, nicht dem Team-Budget) -- es
  // bleibt stattdessen Σ `teamResult.teamPoints` (2/1/0), GENAU EINMAL je Gruppe, nicht je Spieler.
  // Hier nur gesammelt (teamSummariesByTeamId existiert erst nach diesem Loop); angewendet gleich
  // danach, zusammen mit dem Null-Init aller Teams.
  const duellGruppenBeitraege: Array<{ teamId: string; disciplineId: string; category: DisciplineCategory | null; beitrag: number }> = [];
  // TAGESPUNKTE/SPIELTAGSRANG (`lib/foundation/season-matchday-points.ts`): dieselbe
  // Tabellen-Waehrung wie `totalPoints` oben, nur zusaetzlich je Spieltag aufgeschluesselt -- s.
  // `SeasonTableGroupContribution`-Kommentar.
  const tableGroupContributions: SeasonTableGroupContribution[] = [];

  for (const performances of groupedPerformances.values()) {
    const reference = performances[0];
    if (!reference) {
      continue;
    }

    const teamResult = disciplineResultByKey.get(toPerformanceGroupKey(reference)) ?? null;
    const teamTotal = teamResult?.totalScore ?? null;
    const entryWarnings: string[] = [];
    const matchdayResult = matchdayResultById.get(reference.matchdayResultId) ?? null;
    const duellPoints = teamResult
      ? derivePlayerPointsForDuellGroup(gameState, matchdayResult?.matchdayId ?? null, performances, teamResult)
      : null;
    const rankPointDistribution = duellPoints
      ? null
      : deriveRankPointsFromPerformances(gameState, matchdayResult?.matchdayId ?? null, performances, teamResult);
    const pointSource =
      duellPoints?.pointSource ??
      (rankPointDistribution?.pointSource as LedgerPointSource | undefined) ??
      choosePointSource(performances, teamTotal);

    if (teamTotal == null) {
      entryWarnings.push("missing_team_discipline_total");
    }
    if (rankPointDistribution?.warnings.length) {
      entryWarnings.push(...rankPointDistribution.warnings);
    }

    const normalizedEntries = performances.map((performance) => {
      const derivedPoints =
        duellPoints?.pointsByPerformanceId.get(performance.id) ??
        rankPointDistribution?.entries.find((entry) => entry.item === performance)?.points ??
        derivePointsFromPerformance(performance, pointSource, teamTotal);
      if (!isFiniteNumber(derivedPoints)) {
        throw new Error(
          `Could not derive season points for ${performance.id} (${performance.teamId}/${performance.disciplineId}/${performance.disciplineSide}).`,
        );
      }
      const mutatorPpsBonus = isFiniteNumber(performance.mutatorPpsBonus) ? performance.mutatorPpsBonus : 0;
      // Gebuchte PP = Anteil + Mutator-Aufschlag. Ueber den geteilten Helfer, damit
      // die Buehne exakt dieselbe Zahl zeigen kann, die hier gutgeschrieben wird —
      // vorher rechnete die Arena eigenstaendig nur mit dem Anteil.
      const awardedPoints = resolveAwardedPlayerPoints({ pointsAwarded: derivedPoints, mutatorPpsBonus }) ?? 0;
      return {
        performanceId: performance.id,
        matchdayResultId: performance.matchdayResultId,
        matchdayId: matchdayResult?.matchdayId ?? null,
        seasonId,
        teamId: performance.teamId,
        playerId: performance.playerId,
        disciplineId: performance.disciplineId,
        disciplineSide: performance.disciplineSide,
        basePoints: derivedPoints,
        mutatorPpsBonus,
        points: roundValue(awardedPoints, 4),
        pointSource,
        baseValue: performance.baseValue,
        finalPlayerScore: performance.finalPlayerScore,
        rawScoreContribution: performance.scoreContribution,
        rankInTeam: performance.rankInTeam,
        rankInDiscipline: performance.rankInDiscipline,
        isTop10: performance.isTop10,
        isMvpCandidate: performance.isMvpCandidate,
        warnings: [...entryWarnings],
      } satisfies SeasonPlayerPointLedgerEntry;
    });

    // Die Gruppen-Summen-Reconciliation (Σ Spieler-Anteil == Team-Budget) gilt NUR noch fuer
    // Manager-Mode-Zeilen -- eine Duell-Zeile ist per Konstruktion entkoppelt (`totalPoints` kommt
    // unten direkt aus `teamResult.teamPoints`, nicht aus der Spieler-Summe), ein Vergleich gegen den
    // PPS-Totalscore waere hier immer eine falsche Warnung.
    let gruppenTabellenBeitrag: number | null = null;
    if (!duellPoints) {
      const reconciliationTarget = rankPointDistribution?.teamPoints ?? teamTotal;
      const derivedGroupTotal = roundValue(
        normalizedEntries.reduce((sum, entry) => sum + entry.basePoints, 0),
        4,
      );
      // TAGESPUNKTE/SPIELTAGSRANG (s. `tableGroupContributions` unten): fuer Manager-Mode-Zeilen
      // bit-identisch die Σ Spieler-`points` (nicht `basePoints`) dieser Gruppe -- derselbe Wert,
      // der vorher direkt aus `pointEntries` aufsummiert wurde.
      gruppenTabellenBeitrag = roundValue(normalizedEntries.reduce((sum, entry) => sum + entry.points, 0), 4);
      if (reconciliationTarget != null && !isWithinTolerance(derivedGroupTotal, reconciliationTarget)) {
        const warning = `reconciliation_failed:${reference.teamId}:${reference.disciplineId}:${reference.disciplineSide}`;
        warnings.push(warning);
        for (const entry of normalizedEntries) {
          entry.warnings.push(warning);
        }
      }
    } else if (teamResult) {
      duellGruppenBeitraege.push({
        teamId: reference.teamId,
        disciplineId: reference.disciplineId,
        category: disciplineCategoryById.get(reference.disciplineId) ?? null,
        beitrag: teamResult.teamPoints ?? 0,
      });
      gruppenTabellenBeitrag = teamResult.teamPoints ?? 0;
    }

    if (gruppenTabellenBeitrag != null) {
      tableGroupContributions.push({
        matchdayId: matchdayResult?.matchdayId ?? null,
        teamId: reference.teamId,
        disciplineId: reference.disciplineId,
        points: gruppenTabellenBeitrag,
      });
    }

    pointEntries.push(...normalizedEntries);
  }

  const pointEntriesByPerformanceId = new Map(
    pointEntries.map((entry) => [entry.performanceId, entry] as const),
  );

  const teamSummariesByTeamId = new Map<string, SeasonTeamPointsSummary>();
  const expectedRankPointsByTeamId = new Map<string, number>();
  // Non-Duell-Anteil von `playerDerivedTotal` je Team -- die EINZIGE Groesse, gegen die
  // `expectedRankPointsByTeamId` unten noch verglichen wird (s. Reconciliation-Loop ganz unten).
  // Ein Team mit Duell- UND Manager-Mode-Zeilen in derselben Saison (selten, z.B. eine arena-faehige
  // Disziplin ohne Fixture faellt auf den Rangpfad zurueck) darf durch die jetzt leistungsbasierten
  // Duell-PP nicht faelschlich als `reconciliation_failed` markiert werden.
  const managerBasePlayerDerivedByTeamId = new Map<string, number>();
  for (const team of gameState.teams) {
    teamSummariesByTeamId.set(team.teamId, {
      teamId: team.teamId,
      totalPoints: 0,
      mutatorPpsBonus: 0,
      pointsByArea: { power: 0, speed: 0, mental: 0, social: 0 },
      pointsByDiscipline: Object.fromEntries(disciplineIds.map((disciplineId) => [disciplineId, 0] as const)),
      playerDerivedTotal: 0,
      reconciliationStatus: "missing_player_points",
      warnings: [],
    });
  }

  // PP-BUDGET (Teil A): `totalPoints`/`pointsByDiscipline`/`pointsByArea` einer Duell-Gruppe kommen
  // ab hier direkt aus `teamResult.teamPoints` (2/1/0), GENAU EINMAL je Gruppe -- s. Kommentar an
  // `duellGruppenBeitraege` oben. Die Spieler-Summe (`playerDerivedTotal`) bleibt unten unveraendert
  // Σ `entry.points` ueber ALLE Zeilen (Duell UND Manager-Mode).
  for (const beitrag of duellGruppenBeitraege) {
    const summary = teamSummariesByTeamId.get(beitrag.teamId);
    if (!summary) continue;
    summary.totalPoints = roundValue(summary.totalPoints + beitrag.beitrag, 4);
    summary.pointsByDiscipline[beitrag.disciplineId] = roundValue(
      (summary.pointsByDiscipline[beitrag.disciplineId] ?? 0) + beitrag.beitrag,
      4,
    );
    if (beitrag.category) {
      summary.pointsByArea[beitrag.category] = roundValue(summary.pointsByArea[beitrag.category] + beitrag.beitrag, 4);
    }
  }

  for (const result of seasonDisciplineResults) {
    const summary = teamSummariesByTeamId.get(result.teamId);
    const performances = groupedPerformances.get(toDisciplineResultKey(result)) ?? [];
    if (!summary || performances.length > 0) {
      continue;
    }

    // Eine Duell-Zeile OHNE Performances (keine Spieler erfasst) bucht ihr 2/1/0-Team-Budget, nie
    // den rohen PPS-Totalscore -- sonst wuerde ausgerechnet der leere Rand-Fall die 2/1/0-Oekonomie
    // verlassen, die der Rest dieser Datei fuer Duell-Zeilen gerade erst durchsetzt.
    const beitrag = istDuellWertung(result) ? result.teamPoints ?? 0 : result.totalScore;
    summary.totalPoints = roundValue(summary.totalPoints + beitrag, 4);
    summary.pointsByDiscipline[result.disciplineId] = roundValue(
      (summary.pointsByDiscipline[result.disciplineId] ?? 0) + beitrag,
      4,
    );
    const category = disciplineCategoryById.get(result.disciplineId);
    if (category) {
      summary.pointsByArea[category] = roundValue(summary.pointsByArea[category] + beitrag, 4);
    }
  }

  const playerSummariesByPlayerId = new Map<string, SeasonPlayerPointsSummary>();
  for (const entry of pointEntries) {
    const istDuellEntry = entry.pointSource === "battle_mode_arena_boxscore_impact" || entry.pointSource === "battle_mode_pps_duell_player_score";
    const category = disciplineCategoryById.get(entry.disciplineId) ?? null;
    const playerSummary = playerSummariesByPlayerId.get(entry.playerId) ?? {
      playerId: entry.playerId,
      totalPoints: 0,
      appearances: 0,
      pointsByArea: { power: 0, speed: 0, mental: 0, social: 0 },
      pointsByDiscipline: Object.fromEntries(disciplineIds.map((disciplineId) => [disciplineId, 0] as const)),
      pointsByTeamId: {},
      warnings: [],
    };

    playerSummary.totalPoints = roundValue(playerSummary.totalPoints + entry.points, 1);
    playerSummary.appearances += 1;
    playerSummary.pointsByDiscipline[entry.disciplineId] = roundValue(
      (playerSummary.pointsByDiscipline[entry.disciplineId] ?? 0) + entry.points,
      1,
    );
    if (category) {
      playerSummary.pointsByArea[category] = roundValue(playerSummary.pointsByArea[category] + entry.points, 1);
    }
    playerSummary.pointsByTeamId[entry.teamId] = roundValue(
      (playerSummary.pointsByTeamId[entry.teamId] ?? 0) + entry.points,
      1,
    );
    playerSummary.warnings = Array.from(new Set([...playerSummary.warnings, ...entry.warnings]));
    playerSummariesByPlayerId.set(entry.playerId, playerSummary);

    const teamSummary = teamSummariesByTeamId.get(entry.teamId);
    if (teamSummary) {
      // PP-BUDGET (Teil A): `totalPoints`/`pointsByDiscipline`/`pointsByArea` einer Duell-Zeile
      // kommen ausschliesslich aus `duellGruppenBeitraege` oben (einmal je Gruppe, Σ teamPoints) --
      // hier NICHT nochmal aus der (jetzt leistungsbasierten) Spieler-Summe addieren, sonst zaehlte
      // die Duell-PP doppelt und in der falschen Waehrung.
      if (!istDuellEntry) {
        teamSummary.totalPoints = roundValue(teamSummary.totalPoints + entry.points, 4);
        teamSummary.pointsByDiscipline[entry.disciplineId] = roundValue(
          (teamSummary.pointsByDiscipline[entry.disciplineId] ?? 0) + entry.points,
          4,
        );
        if (category) {
          teamSummary.pointsByArea[category] = roundValue(teamSummary.pointsByArea[category] + entry.points, 4);
        }
        managerBasePlayerDerivedByTeamId.set(
          entry.teamId,
          roundValue((managerBasePlayerDerivedByTeamId.get(entry.teamId) ?? 0) + entry.basePoints, 4),
        );
      }
      teamSummary.mutatorPpsBonus = roundValue(teamSummary.mutatorPpsBonus + entry.mutatorPpsBonus, 4);
      // `playerDerivedTotal` bleibt Σ Spieler-PP ueber ALLE Zeilen (Duell UND Manager-Mode) -- das
      // ist jetzt die "Leistungs-PP"-Spalte fuer Kader-/Liga-Leaders-Ansichten, bewusst entkoppelt
      // von `totalPoints` (der Tabellenpunktzahl) fuer Duell-Saves.
      teamSummary.playerDerivedTotal = roundValue(teamSummary.playerDerivedTotal + entry.points, 4);
      teamSummary.warnings = Array.from(new Set([...teamSummary.warnings, ...entry.warnings]));
    }
  }

  for (const result of seasonDisciplineResults) {
    // Duell-Ergebnisse sind per Konstruktion reconciled (s. `duellGruppenBeitraege` oben) -- dieser
    // Vergleich gilt nur noch fuer Manager-Mode-Zeilen.
    if (istDuellWertung(result)) {
      continue;
    }
    const rankPoints = deriveRankPointsFromPerformances(
      gameState,
      matchdayResultById.get(result.matchdayResultId)?.matchdayId ?? null,
      groupedPerformances.get(toDisciplineResultKey(result)) ?? [],
      result,
    )?.teamPoints;

    if (!isFiniteNumber(rankPoints)) {
      continue;
    }

    expectedRankPointsByTeamId.set(
      result.teamId,
      roundValue((expectedRankPointsByTeamId.get(result.teamId) ?? 0) + rankPoints, 4),
    );
  }

  for (const teamSummary of teamSummariesByTeamId.values()) {
    teamSummary.totalPoints = roundValue(teamSummary.totalPoints, 1);
    teamSummary.mutatorPpsBonus = roundValue(teamSummary.mutatorPpsBonus, 1);
    teamSummary.pointsByArea = {
      power: roundValue(teamSummary.pointsByArea.power, 1),
      speed: roundValue(teamSummary.pointsByArea.speed, 1),
      mental: roundValue(teamSummary.pointsByArea.mental, 1),
      social: roundValue(teamSummary.pointsByArea.social, 1),
    };
    teamSummary.pointsByDiscipline = Object.fromEntries(
      Object.entries(teamSummary.pointsByDiscipline).map(([disciplineId, value]) => [disciplineId, roundValue(value, 1)] as const),
    );

    const expectedRankPoints = expectedRankPointsByTeamId.get(teamSummary.teamId) ?? 0;

    // NUR der Manager-Mode-Anteil (s. `managerBasePlayerDerivedByTeamId` oben) -- fuer ein reines
    // Battle-Save ist das 0/0 (kein Manager-Mode-Anteil vorhanden), was unten `"reconciled"` ergibt:
    // eine Duell-Zeile ist per Konstruktion reconciled, s. `duellGruppenBeitraege`.
    const basePlayerDerivedTotal = roundValue(managerBasePlayerDerivedByTeamId.get(teamSummary.teamId) ?? 0, 4);

    if (basePlayerDerivedTotal === 0 && expectedRankPoints === 0) {
      teamSummary.reconciliationStatus = "reconciled";
      continue;
    }

    if (basePlayerDerivedTotal === 0 && expectedRankPoints > 0) {
      teamSummary.reconciliationStatus = "missing_player_points";
      continue;
    }

    teamSummary.reconciliationStatus =
      expectedRankPoints === 0 || isWithinTolerance(basePlayerDerivedTotal, expectedRankPoints)
        ? "reconciled"
        : "reconciliation_failed";

    if (teamSummary.reconciliationStatus === "reconciliation_failed") {
      const warning = `team_reconciliation_failed:${teamSummary.teamId}`;
      teamSummary.warnings = Array.from(new Set([...teamSummary.warnings, warning]));
      warnings.push(warning);
    }
  }

  return {
    // Eine Quelle ist nur dann eine Quelle, wenn auch Disziplin-Ergebnisse dazu vorliegen —
    // sonst meldete der Ledger im Browser „ich habe Daten" und lieferte trotzdem nichts.
    hasResultSource: resultIdsWithDisciplineCoverage.size > 0,
    pointEntries,
    pointEntriesByPerformanceId,
    teamSummariesByTeamId,
    playerSummariesByPlayerId,
    tableGroupContributions,
    warnings: Array.from(new Set(warnings)),
  };
}
