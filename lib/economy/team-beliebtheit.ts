import type { GameState, Player, RosterEntry, StandingRecord } from "@/lib/data/olyDataTypes";
import { computeTopSixAxisAverage } from "@/lib/market/transfermarkt-roster-impact";
import { computeCosmeticTraitPopularityBonus } from "@/lib/traits/cosmetic-trait-soft-effects";

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
 * Bequemer One-Shot: baut den Liga-Kontext und liefert direkt die Beliebtheit
 * eines Teams. Für Aufrufer, die nur ein einzelnes Team brauchen.
 */
export function computeTeamBeliebtheitFromGameState(
  gameState: GameState,
  teamId: string,
): BeliebtheitComponents {
  return computeTeamBeliebtheit(teamId, buildBeliebtheitLeagueContext(gameState));
}
