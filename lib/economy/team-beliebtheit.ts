import type { GameState, Player, RosterEntry, StandingRecord, TeamBeliebtheitRecord } from "@/lib/data/olyDataTypes";
import { computeTopSixAxisAverage } from "@/lib/market/transfermarkt-roster-impact";
import { computeCosmeticTraitPopularityBonus } from "@/lib/traits/cosmetic-trait-soft-effects";
import { computeTeamExpectation } from "@/lib/board/team-season-objectives-service";
import { buildTeamSeasonOverviewRows } from "@/lib/foundation/team-management-overview";
import { buildPlayerRatingContractMap } from "@/lib/foundation/player-rating-contract";

/**
 * Beliebtheitsfaktor (team popularity) — real game rule, not a cosmetic flag.
 *
 * Ein Team-KPI in [BELIEBTHEIT_MIN, BELIEBTHEIT_MAX] mit 1.0 = Liga-Durchschnitt.
 * Er skaliert die Arena-Einnahmen (siehe facility-season-end-service): ein
 * beliebtes/erfolgreiches Team verdient mehr an der Arena, ein schwaches
 * weniger. Der Fan-Shop bleibt bewusst flach (nicht multipliziert).
 *
 * Zusammensetzung aus drei Sub-Scores, jeweils auf [0,1] über die Liga
 * normalisiert und gewichtet:
 *  - ERFOLG        (Tabellenplatz / Rang-Perzentil, Fallback Punkte-Perzentil)
 *  - FAN_FAVORITES (Anteil Kader mit `FanFavorite`-Trait vs. Liga-Maximum)
 *  - STARPOWER     (Top-6-OVR-Schnitt des Teams, Perzentil über die Liga)
 *
 * raw          = w.erfolg*erfolg + w.fanFavorites*favShare + w.starpower*starpower
 * Beliebtheit  = clamp(BELIEBTHEIT_BASE_OFFSET + raw, MIN, MAX)
 *
 * Alle drei Sub-Scores neutral (0.5) => raw 0.5 => Beliebtheit 1.0 (Liga-Schnitt).
 * Fehlen Daten (kein Kader, keine Tabelle, keine Fan-Favoriten in der Liga),
 * fällt der jeweilige Sub-Score neutral auf 0.5 zurück — nie ein Crash, nie
 * ein erfundener Wert. Läuft identisch für Menschen- und KI-Teams.
 */

// ======================================================================
// Tunable balance constants (balancing run) — hier zentral justierbar.
// ======================================================================

/** Gewichtung der drei Sub-Scores. Summe muss nicht 1 sein, ist es hier aber. */
export const BELIEBTHEIT_WEIGHTS = {
  erfolg: 0.5,
  fanFavorites: 0.3,
  starpower: 0.2,
} as const;

/** Clamp-Grenzen des ausgegebenen Faktors (1.0 = Liga-Durchschnitt). */
export const BELIEBTHEIT_MIN = 0.5;
export const BELIEBTHEIT_MAX = 1.5;

/** Beliebtheit = clamp(BASE_OFFSET + raw). Mit raw in [0,1] ergibt das [0.5,1.5]. */
export const BELIEBTHEIT_BASE_OFFSET = 0.5;

/** Neutraler Sub-Score, wenn eine Komponente mangels Daten nicht normalisierbar ist. */
export const BELIEBTHEIT_NEUTRAL_SUBSCORE = 0.5;

/** Anzahl Top-Spieler für die STARPOWER-Komponente (Top-6-OVR-Schnitt). */
export const BELIEBTHEIT_STARPOWER_TOP_COUNT = 6;

/** Realer positiver Trait (siehe `Player.traitsPositive`), der Fan-Favoriten markiert. */
export const FAN_FAVORITE_TRAIT_ID = "FanFavorite";

// ======================================================================

export type BeliebtheitComponents = {
  /** Endwert, geclampt auf [BELIEBTHEIT_MIN, BELIEBTHEIT_MAX]. */
  value: number;
  /** ERFOLG-Sub-Score, [0,1]. */
  erfolg: number;
  /** FAN_FAVORITES-Sub-Score (normalisiert), [0,1]. */
  favShare: number;
  /** STARPOWER-Sub-Score (normalisiert), [0,1]. */
  starpower: number;
  /** Kleiner additiver Trait-Bonus/-Malus (siehe `TeamAggregate.cosmeticTraitBonus`). */
  cosmeticTraitBonus: number;
};

type TeamAggregate = {
  teamId: string;
  rank: number | null;
  points: number | null;
  /** Roh-Anteil Fan-Favoriten im Kader (0..1), unabhängig von der Liga. */
  favShareRaw: number;
  /** Top-6-OVR-Schnitt des Teams oder null, wenn keine Ratings vorliegen. */
  starRaw: number | null;
  /**
   * Kleiner additiver Bonus/Malus aus kosmetischen Charakter-Traits
   * (siehe lib/traits/cosmetic-trait-soft-effects.ts), bereits klein genug
   * um direkt in `raw` einzufließen, ohne die Sub-Score-Gewichtung zu
   * verzerren.
   */
  cosmeticTraitBonus: number;
};

export type BeliebtheitLeagueContext = {
  byTeamId: Map<string, BeliebtheitComponents>;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundValue(value: number, digits = 4) {
  return Number(value.toFixed(digits));
}

function readPlayerStrength(player: Player): number | null {
  const ovr = typeof player.ovr === "number" && Number.isFinite(player.ovr) ? player.ovr : null;
  if (ovr != null) {
    return ovr;
  }
  // Fallback auf `rating` (immer gesetzt), falls OVR fehlt — kein erfundener Wert.
  return typeof player.rating === "number" && Number.isFinite(player.rating) ? player.rating : null;
}

function buildTeamAggregate(input: {
  teamId: string;
  roster: RosterEntry[];
  playersById: Map<string, Player>;
  standing: StandingRecord | null;
}): TeamAggregate {
  const rosterPlayers = input.roster
    .map((entry) => input.playersById.get(entry.playerId))
    .filter((player): player is Player => Boolean(player));

  const favCount = rosterPlayers.filter((player) =>
    player.traitsPositive?.includes(FAN_FAVORITE_TRAIT_ID),
  ).length;
  const favShareRaw = rosterPlayers.length > 0 ? favCount / rosterPlayers.length : 0;

  const strengthValues = rosterPlayers
    .map((player) => readPlayerStrength(player))
    .filter((value): value is number => value != null);
  const starRaw = computeTopSixAxisAverage(strengthValues, BELIEBTHEIT_STARPOWER_TOP_COUNT);

  const cosmeticTraitBonus = computeCosmeticTraitPopularityBonus(rosterPlayers);

  const rank =
    typeof input.standing?.rank === "number" && Number.isFinite(input.standing.rank)
      ? input.standing.rank
      : null;
  const points =
    typeof input.standing?.points === "number" && Number.isFinite(input.standing.points)
      ? input.standing.points
      : null;

  return { teamId: input.teamId, rank, points, favShareRaw, starRaw, cosmeticTraitBonus };
}

/**
 * Baut den Liga-Kontext einmalig aus dem GameState (Teams, Rosters, Spieler,
 * Tabelle) und liefert für jedes Team die fertig normalisierten Komponenten +
 * den geclampten Beliebtheitsfaktor. Reine Funktion, keine Seiteneffekte.
 */
export function buildBeliebtheitLeagueContext(gameState: GameState): BeliebtheitLeagueContext {
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const rostersByTeamId = new Map<string, RosterEntry[]>();
  for (const entry of gameState.rosters ?? []) {
    const existing = rostersByTeamId.get(entry.teamId);
    if (existing) {
      existing.push(entry);
    } else {
      rostersByTeamId.set(entry.teamId, [entry]);
    }
  }
  const standings = (gameState.seasonState.standings ?? {}) as Record<string, StandingRecord>;

  const aggregates = gameState.teams.map((team) =>
    buildTeamAggregate({
      teamId: team.teamId,
      roster: rostersByTeamId.get(team.teamId) ?? [],
      playersById,
      standing: standings[team.teamId] ?? null,
    }),
  );

  const teamCount = aggregates.length;

  // ERFOLG: Rang-Perzentil (N - rank)/(N - 1); Fallback Punkte-Perzentil.
  const pointsValues = aggregates
    .map((entry) => entry.points)
    .filter((value): value is number => value != null);
  const minPoints = pointsValues.length > 0 ? Math.min(...pointsValues) : null;
  const maxPoints = pointsValues.length > 0 ? Math.max(...pointsValues) : null;

  // FAN_FAVORITES: gegen das Liga-Maximum ankern (0 = niemand hat Fan-Favoriten).
  const maxFavShare = aggregates.reduce((max, entry) => Math.max(max, entry.favShareRaw), 0);

  // STARPOWER: Min/Max-Perzentil über alle Teams mit Ratings.
  const starValues = aggregates
    .map((entry) => entry.starRaw)
    .filter((value): value is number => value != null);
  const minStar = starValues.length > 0 ? Math.min(...starValues) : null;
  const maxStar = starValues.length > 0 ? Math.max(...starValues) : null;

  const byTeamId = new Map<string, BeliebtheitComponents>();
  for (const aggregate of aggregates) {
    let erfolg = BELIEBTHEIT_NEUTRAL_SUBSCORE;
    if (aggregate.rank != null && teamCount > 1) {
      erfolg = clamp((teamCount - aggregate.rank) / (teamCount - 1), 0, 1);
    } else if (
      aggregate.points != null &&
      minPoints != null &&
      maxPoints != null &&
      maxPoints > minPoints
    ) {
      erfolg = clamp((aggregate.points - minPoints) / (maxPoints - minPoints), 0, 1);
    }

    const favShare = maxFavShare > 0 ? clamp(aggregate.favShareRaw / maxFavShare, 0, 1) : BELIEBTHEIT_NEUTRAL_SUBSCORE;

    let starpower = BELIEBTHEIT_NEUTRAL_SUBSCORE;
    if (aggregate.starRaw != null && minStar != null && maxStar != null && maxStar > minStar) {
      starpower = clamp((aggregate.starRaw - minStar) / (maxStar - minStar), 0, 1);
    }

    const raw =
      BELIEBTHEIT_WEIGHTS.erfolg * erfolg +
      BELIEBTHEIT_WEIGHTS.fanFavorites * favShare +
      BELIEBTHEIT_WEIGHTS.starpower * starpower +
      aggregate.cosmeticTraitBonus;
    const value = clamp(BELIEBTHEIT_BASE_OFFSET + raw, BELIEBTHEIT_MIN, BELIEBTHEIT_MAX);

    byTeamId.set(aggregate.teamId, {
      value: roundValue(value),
      erfolg: roundValue(erfolg),
      favShare: roundValue(favShare),
      starpower: roundValue(starpower),
      cosmeticTraitBonus: roundValue(aggregate.cosmeticTraitBonus),
    });
  }

  return { byTeamId };
}

/** Neutraler Faktor (Liga-Durchschnitt), wenn kein Kontext/kein Team-Eintrag vorliegt. */
export function neutralBeliebtheit(): BeliebtheitComponents {
  return {
    value: clamp(BELIEBTHEIT_BASE_OFFSET + BELIEBTHEIT_NEUTRAL_SUBSCORE, BELIEBTHEIT_MIN, BELIEBTHEIT_MAX),
    erfolg: BELIEBTHEIT_NEUTRAL_SUBSCORE,
    favShare: BELIEBTHEIT_NEUTRAL_SUBSCORE,
    starpower: BELIEBTHEIT_NEUTRAL_SUBSCORE,
    cosmeticTraitBonus: 0,
  };
}

/**
 * Beliebtheit eines Teams aus dem Liga-Kontext. Fehlt das Team (z. B. neu, ohne
 * Kader), liefert die Funktion einen neutralen Faktor 1.0 — nie undefined.
 */
export function computeTeamBeliebtheit(
  teamId: string,
  context: BeliebtheitLeagueContext,
): BeliebtheitComponents {
  return context.byTeamId.get(teamId) ?? neutralBeliebtheit();
}

/**
 * Bequemer One-Shot: liefert die Beliebtheit eines Teams für Aufrufer, die nur `.value` brauchen
 * (v.a. die Arena-Kopplung in facility-season-end-service).
 *
 * TEIL A: Sobald ein fortgeschriebener Wert in `seasonState.beliebtheitByTeamId` vorliegt, ist DIESER
 * die Quelle der Wahrheit — die Arena koppelt damit automatisch an den dynamischen KPI, OHNE dass die
 * Arena-Logik angefasst werden muss. Fehlt der persistierte Wert (Alt-Saves, Season 1 vor der ersten
 * Fortschreibung), fällt die Funktion auf die alte stateless Liga-Berechnung zurück — nie ein Crash,
 * immer ein Wert in [0.5, 1.5].
 */
export function computeTeamBeliebtheitFromGameState(
  gameState: GameState,
  teamId: string,
): BeliebtheitComponents {
  const persisted = gameState.seasonState.beliebtheitByTeamId?.[teamId];
  if (persisted && typeof persisted.value === "number" && Number.isFinite(persisted.value)) {
    return {
      ...neutralBeliebtheit(),
      value: roundValue(clamp(persisted.value, BELIEBTHEIT_MIN, BELIEBTHEIT_MAX)),
    };
  }
  return computeTeamBeliebtheit(teamId, buildBeliebtheitLeagueContext(gameState));
}

// ======================================================================
// TEIL A — Dynamischer, fortgeschriebener Beliebtheits-KPI.
//
// Statt jede Saison neu zu würfeln, wird der Wert FORTGESCHRIEBEN:
//   value[t] = clamp(REVERT*1.0 + (1-REVERT)*value[t-1] + GAIN*spotlightDelta[t], MIN, MAX)
// `spotlightDelta` ist LIGA-ZENTRIERT um 0 (Σ über die Liga ≈ 0), zusammengesetzt aus überwiegend
// GRÖSSEN-NEUTRALEN End-of-Season-Signalen. Jedes Signal wird über die Liga zentriert (Mittelwert
// abgezogen) und dann gewichtet — dadurch summiert sich der gewichtete Delta über die Liga zu ≈0.
//
// Alle Balance-Zahlen sind ENV-tunebar (OLY_BELIEBTHEIT_*), analog zu den übrigen OLY_*-Knöpfen.
// ======================================================================

function envNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : fallback;
}

/** Rückkehr zur Mitte (1.0): Anteil, mit dem der Wert jede Saison Richtung Liga-Durchschnitt zieht. */
export const BELIEBTHEIT_REVERT = envNumber("OLY_BELIEBTHEIT_REVERT", 0.35);
/** Impuls-Verstärkung: wie stark der (liga-zentrierte) spotlightDelta den Wert verschiebt. */
export const BELIEBTHEIT_GAIN = envNumber("OLY_BELIEBTHEIT_GAIN", 0.6);
/** Neutraler Vorwert 1.0, wenn kein persistierter Vorsaison-Wert existiert. */
export const BELIEBTHEIT_NEUTRAL_VALUE = 1.0;
/** Maximale Länge der gespeicherten value-Zeitreihe pro Team. */
export const BELIEBTHEIT_HISTORY_MAX = 25;

/** Gewichte der (liga-zentrierten) Spotlight-Signale. ENV-tunebar. Summe der Positiven ≈ 1. */
export const BELIEBTHEIT_SPOTLIGHT_WEIGHTS = {
  overperf: envNumber("OLY_BELIEBTHEIT_W_OVERPERF", 0.3),
  bracket: envNumber("OLY_BELIEBTHEIT_W_BRACKET", 0.25),
  upset: envNumber("OLY_BELIEBTHEIT_W_UPSET", 0.15),
  jump: envNumber("OLY_BELIEBTHEIT_W_JUMP", 0.15),
  discipline: envNumber("OLY_BELIEBTHEIT_W_DISCIPLINE", 0.1),
  fanFavorites: envNumber("OLY_BELIEBTHEIT_W_FANFAV", 0.05),
} as const;

/** bracketScore ab dem ein Spieler als "Bracket-Held" (Bester seiner Marktwert-Klasse) zählt. */
export const BELIEBTHEIT_BRACKET_HERO_THRESHOLD = envNumber("OLY_BELIEBTHEIT_BRACKET_HERO", 0.85);
/** Rang-Marge, ab der ein Matchday als "Upset" (deutlich besser platziert als erwartet) zählt. */
export const BELIEBTHEIT_UPSET_MARGIN = envNumber("OLY_BELIEBTHEIT_UPSET_MARGIN", 3);

/** Marktwert-Klassen-Grenzen (gespiegelt aus player-rating-contract, dort nicht exportiert). */
const BELIEBTHEIT_MARKET_VALUE_BRACKET_STARTS = [0, 12.5, 17.5, 22.5, 30, 37.5, 45, 55, 70];

function marketValueBracketId(marketValue: number | null | undefined): number {
  if (marketValue == null || !Number.isFinite(marketValue)) {
    return 0;
  }
  let bracket = 0;
  for (let index = 0; index < BELIEBTHEIT_MARKET_VALUE_BRACKET_STARTS.length; index += 1) {
    if (marketValue >= BELIEBTHEIT_MARKET_VALUE_BRACKET_STARTS[index]!) {
      bracket = index;
    }
  }
  return bracket;
}

/**
 * Größen-neutrale/liga-zentrierbare Roh-Signale eines Teams am Saison-Ende. Reine Datenstruktur, damit
 * die Delta-Berechnung als reine Funktion getestet werden kann (Verify-Harness) — unabhängig vom
 * schweren GameState-Extraktor.
 */
export type TeamSpotlightSignals = {
  teamId: string;
  rosterSize: number;
  /** Endplatzierung der abgeschlossenen Saison (1 = Meister). */
  finalRank: number | null;
  /** Erwarteter Rang aus reiner Kaderstärke (größen-neutral, ohne Ambition). */
  expectedRank: number | null;
  /** Anteil Kader mit bracketScore≈1 (0..1), größen-neutral. */
  bracketHeroShare: number;
  /** Anteil Matchdays mit deutlichem Score-Rang-Upset (0..1), größen-neutral. */
  upsetRate: number;
  /** Durchschnittlicher historischer Rang (Vorsaisons) oder null. */
  historicalAvgRank: number | null;
  /** Anteil Kader mit rankInDiscipline<=3 pro Kadergröße (0..1). */
  disciplineTop3Share: number;
  /** FanFavorites-Anteil + kleiner Kosmetik-Trait-Term. */
  fanFavoriteTerm: number;
};

export type TeamSpotlightResult = {
  teamId: string;
  spotlightDelta: number;
  components: TeamBeliebtheitRecord["components"];
};

const NEUTRAL_SPOTLIGHT_COMPONENTS: TeamBeliebtheitRecord["components"] = {
  overperf: 0,
  bracket: 0,
  upset: 0,
  jump: 0,
  discipline: 0,
  fanFavorites: 0,
};

function centerAroundLeagueMean(values: number[]): number[] {
  if (values.length === 0) {
    return values;
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.map((value) => value - mean);
}

/**
 * Reine Kernfunktion: aus den Roh-Signalen der Liga die LIGA-ZENTRIERTEN, gewichteten spotlightDeltas.
 * Jede Komponente wird über die Liga zentriert (Mittelwert abgezogen), sodass Σ(spotlightDelta) ≈ 0.
 */
export function computeLeagueSpotlightDeltas(
  signals: TeamSpotlightSignals[],
): Map<string, TeamSpotlightResult> {
  const teamCount = signals.length;
  const result = new Map<string, TeamSpotlightResult>();
  if (teamCount === 0) {
    return result;
  }
  const rankSpan = Math.max(1, teamCount - 1);

  // Roh-Signale (alle möglichst größen-neutral, auf grob vergleichbare Skala gebracht).
  const overperfRaw = signals.map((signal) =>
    signal.finalRank != null && signal.expectedRank != null
      ? (signal.expectedRank - signal.finalRank) / rankSpan
      : 0,
  );
  const bracketRaw = signals.map((signal) => signal.bracketHeroShare);
  const upsetRaw = signals.map((signal) => signal.upsetRate);
  const jumpRaw = signals.map((signal) =>
    signal.historicalAvgRank != null && signal.finalRank != null
      ? (signal.historicalAvgRank - signal.finalRank) / rankSpan
      : 0,
  );
  const disciplineRaw = signals.map((signal) => signal.disciplineTop3Share);
  const fanRaw = signals.map((signal) => signal.fanFavoriteTerm);

  const overperf = centerAroundLeagueMean(overperfRaw);
  const bracket = centerAroundLeagueMean(bracketRaw);
  const upset = centerAroundLeagueMean(upsetRaw);
  const jump = centerAroundLeagueMean(jumpRaw);
  const discipline = centerAroundLeagueMean(disciplineRaw);
  const fan = centerAroundLeagueMean(fanRaw);

  const weights = BELIEBTHEIT_SPOTLIGHT_WEIGHTS;
  signals.forEach((signal, index) => {
    const components: TeamBeliebtheitRecord["components"] = {
      overperf: roundValue(weights.overperf * overperf[index]!),
      bracket: roundValue(weights.bracket * bracket[index]!),
      upset: roundValue(weights.upset * upset[index]!),
      jump: roundValue(weights.jump * jump[index]!),
      discipline: roundValue(weights.discipline * discipline[index]!),
      fanFavorites: roundValue(weights.fanFavorites * fan[index]!),
    };
    const spotlightDelta = roundValue(
      components.overperf +
        components.bracket +
        components.upset +
        components.jump +
        components.discipline +
        components.fanFavorites,
    );
    result.set(signal.teamId, { teamId: signal.teamId, spotlightDelta, components });
  });

  return result;
}

/** Reine Fortschreibung eines einzelnen Team-Werts (Mean-Reversion + Spotlight-Impuls). */
export function advanceBeliebtheitValue(previousValue: number, spotlightDelta: number): number {
  const revert = BELIEBTHEIT_REVERT;
  const gain = BELIEBTHEIT_GAIN;
  const next = revert * BELIEBTHEIT_NEUTRAL_VALUE + (1 - revert) * previousValue + gain * spotlightDelta;
  return clamp(next, BELIEBTHEIT_MIN, BELIEBTHEIT_MAX);
}

/**
 * Extrahiert die größen-neutralen Spotlight-Signale aus einem ABGESCHLOSSENEN GameState (finale Tabelle,
 * Disziplin-Ergebnisse, Kader). Reine Ableitung, keine Seiteneffekte.
 */
export function buildTeamSpotlightSignalsFromGameState(gameState: GameState): TeamSpotlightSignals[] {
  const rows = buildTeamSeasonOverviewRows({ gameState });
  const rowsByTeamId = new Map(rows.map((row) => [row.teamId, row] as const));
  const standings = (gameState.seasonState.standings ?? {}) as Record<string, StandingRecord>;

  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const rostersByTeamId = new Map<string, RosterEntry[]>();
  for (const entry of gameState.rosters ?? []) {
    const existing = rostersByTeamId.get(entry.teamId);
    if (existing) {
      existing.push(entry);
    } else {
      rostersByTeamId.set(entry.teamId, [entry]);
    }
  }

  // Bracket-Helden: liga-weite bracketScore≈1 spiegeln (Bester MVS je Marktwert-Klasse).
  const ratingMap = buildPlayerRatingContractMap(gameState);
  const bracketMembers = new Map<number, Array<{ playerId: string; mvs: number }>>();
  for (const [playerId, row] of ratingMap) {
    const mvs = typeof row.mvs === "number" && Number.isFinite(row.mvs) ? row.mvs : 0;
    if (mvs <= 0) {
      continue;
    }
    const bracketId = marketValueBracketId(row.marketValue);
    const list = bracketMembers.get(bracketId) ?? [];
    list.push({ playerId, mvs });
    bracketMembers.set(bracketId, list);
  }
  const bracketScoreByPlayerId = new Map<string, number>();
  for (const members of bracketMembers.values()) {
    const sorted = members.sort((left, right) => right.mvs - left.mvs);
    const count = sorted.length;
    if (count <= 1) {
      for (const member of sorted) {
        bracketScoreByPlayerId.set(member.playerId, 1);
      }
      continue;
    }
    sorted.forEach((member, index) => {
      bracketScoreByPlayerId.set(member.playerId, 1 - index / (count - 1));
    });
  }

  // Disziplin-Spotlight: Spieler mit rankInDiscipline<=3 in dieser Saison.
  const seasonMatchdayResultIds = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((record) => record.seasonId === gameState.season.id)
      .map((record) => record.id),
  );
  const matchdayIdByResultId = new Map(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((record) => record.seasonId === gameState.season.id)
      .map((record) => [record.id, record.matchdayId] as const),
  );
  const disciplineTop3PlayerIds = new Set<string>();
  for (const perf of gameState.seasonState.playerDisciplinePerformances ?? []) {
    if (!seasonMatchdayResultIds.has(perf.matchdayResultId)) {
      continue;
    }
    if (typeof perf.rankInDiscipline === "number" && perf.rankInDiscipline <= 3) {
      disciplineTop3PlayerIds.add(perf.playerId);
    }
  }

  // Upsets: pro Matchday die Teams nach Gesamtscore ranken; ein Team, das deutlich besser platziert
  // ist als sein erwarteter Rang, hat ein schwächer erwartetes Team "geschlagen" (größen-neutral).
  const expectedRankByTeamId = new Map<string, number>();
  for (const row of rows) {
    expectedRankByTeamId.set(
      row.teamId,
      computeTeamExpectation({ row, rowsByTeamId, identity: null }).expectedRank,
    );
  }
  const scoresByMatchday = new Map<string, Map<string, number>>();
  for (const result of gameState.seasonState.disciplineResults ?? []) {
    const matchdayId = matchdayIdByResultId.get(result.matchdayResultId);
    if (!matchdayId) {
      continue;
    }
    const teamScores = scoresByMatchday.get(matchdayId) ?? new Map<string, number>();
    teamScores.set(result.teamId, (teamScores.get(result.teamId) ?? 0) + (result.totalScore ?? 0));
    scoresByMatchday.set(matchdayId, teamScores);
  }
  const upsetCountByTeamId = new Map<string, number>();
  let matchdaysPlayed = 0;
  for (const teamScores of scoresByMatchday.values()) {
    matchdaysPlayed += 1;
    const ranked = [...teamScores.entries()].sort((left, right) => right[1] - left[1]);
    ranked.forEach(([teamId], index) => {
      const scoreRank = index + 1;
      const expectedRank = expectedRankByTeamId.get(teamId);
      if (expectedRank != null && scoreRank <= expectedRank - BELIEBTHEIT_UPSET_MARGIN) {
        upsetCountByTeamId.set(teamId, (upsetCountByTeamId.get(teamId) ?? 0) + 1);
      }
    });
  }

  return gameState.teams.map((team) => {
    const teamId = team.teamId;
    const roster = rostersByTeamId.get(teamId) ?? [];
    const rosterPlayers = roster
      .map((entry) => playersById.get(entry.playerId))
      .filter((player): player is Player => Boolean(player));
    const rosterSize = rosterPlayers.length;

    const finalRank =
      typeof standings[teamId]?.rank === "number" && Number.isFinite(standings[teamId]!.rank)
        ? (standings[teamId]!.rank as number)
        : typeof standings[teamId]?.startplatz === "number"
          ? (standings[teamId]!.startplatz as number)
          : null;
    const expectedRank = expectedRankByTeamId.get(teamId) ?? null;

    const heroCount = roster.filter(
      (entry) => (bracketScoreByPlayerId.get(entry.playerId) ?? 0) >= BELIEBTHEIT_BRACKET_HERO_THRESHOLD,
    ).length;
    const bracketHeroShare = rosterSize > 0 ? heroCount / rosterSize : 0;

    const disciplineCount = roster.filter((entry) => disciplineTop3PlayerIds.has(entry.playerId)).length;
    const disciplineTop3Share = rosterSize > 0 ? disciplineCount / rosterSize : 0;

    const upsetRate = matchdaysPlayed > 0 ? (upsetCountByTeamId.get(teamId) ?? 0) / matchdaysPlayed : 0;

    const historicalRanks = (rowsByTeamId.get(teamId)?.historicalPointsBySeason ?? [])
      .map((entry) => entry.rank)
      .filter((rank): rank is number => typeof rank === "number" && Number.isFinite(rank));
    const historicalAvgRank =
      historicalRanks.length > 0
        ? historicalRanks.reduce((sum, rank) => sum + rank, 0) / historicalRanks.length
        : null;

    const favCount = rosterPlayers.filter((player) =>
      player.traitsPositive?.includes(FAN_FAVORITE_TRAIT_ID),
    ).length;
    const favShare = rosterSize > 0 ? favCount / rosterSize : 0;
    const cosmeticTraitBonus = computeCosmeticTraitPopularityBonus(rosterPlayers);
    const fanFavoriteTerm = favShare + cosmeticTraitBonus;

    return {
      teamId,
      rosterSize,
      finalRank,
      expectedRank,
      bracketHeroShare,
      upsetRate,
      historicalAvgRank,
      disciplineTop3Share,
      fanFavoriteTerm,
    } satisfies TeamSpotlightSignals;
  });
}

/**
 * Fortschreibung + Persistenz (1×/Saison). Liest die abgeschlossene Saison (`completedGameState`),
 * bildet die liga-zentrierten spotlightDeltas, schreibt den Beliebtheits-KPI je Team fort (Fallback
 * neutral 1.0 ohne Vorwert) und legt Ergebnis + value-Zeitreihe im `nextGameState` ab (der frisch
 * aktivierten Folge-Saison, VOR der Sponsor-Angebots-Generierung des nächsten Zyklus).
 */
export function advanceTeamBeliebtheitForSeasonTransition(input: {
  completedGameState: GameState;
  nextGameState: GameState;
}): GameState {
  const { completedGameState, nextGameState } = input;
  const signals = buildTeamSpotlightSignalsFromGameState(completedGameState);
  const deltas = computeLeagueSpotlightDeltas(signals);

  const previousRecords = completedGameState.seasonState.beliebtheitByTeamId ?? {};
  const previousHistory = completedGameState.seasonState.beliebtheitHistoryByTeamId ?? {};

  const nextRecords: Record<string, TeamBeliebtheitRecord> = {};
  const nextHistory: Record<string, number[]> = {};

  for (const team of completedGameState.teams) {
    const teamId = team.teamId;
    const delta = deltas.get(teamId);
    const spotlightDelta = delta?.spotlightDelta ?? 0;
    const components = delta?.components ?? NEUTRAL_SPOTLIGHT_COMPONENTS;
    const previousValue =
      typeof previousRecords[teamId]?.value === "number" && Number.isFinite(previousRecords[teamId]!.value)
        ? previousRecords[teamId]!.value
        : BELIEBTHEIT_NEUTRAL_VALUE;
    const value = roundValue(advanceBeliebtheitValue(previousValue, spotlightDelta));

    nextRecords[teamId] = { value, spotlightDelta, components };
    nextHistory[teamId] = [...(previousHistory[teamId] ?? []), value].slice(-BELIEBTHEIT_HISTORY_MAX);
  }

  return {
    ...nextGameState,
    seasonState: {
      ...nextGameState.seasonState,
      beliebtheitByTeamId: nextRecords,
      beliebtheitHistoryByTeamId: nextHistory,
    },
  };
}
