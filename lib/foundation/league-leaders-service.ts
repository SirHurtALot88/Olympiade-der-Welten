import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { formatLocalePoints } from "@/lib/foundation/tabs/home-v2-ui-helpers";
import { buildOrganicSeasonProgression } from "@/lib/training/organic-season-progression";

export type LeagueLeaderSourceRow = {
  playerId: string;
  name: string;
  teamId: string | null;
  teamCode: string | null;
  teamName: string;
  pps: number | null;
  ppPow: number | null;
  ppSpe: number | null;
  ppMen: number | null;
  ppSoc: number | null;
  ovr: number | null;
  /**
   * Ligaweiter OVR-Rang des Spielers (nicht der Rang IN dieser Kategorie) —
   * einzige Grundlage für den Star-Tier-Rahmen im Portrait, siehe
   * `lib/foundation/player-star-tier.ts`.
   */
  ovrRank: number | null;
  mvs: number | null;
};

export type LeagueTrainingLeaderSourceRow = {
  playerId: string;
  name: string;
  teamId: string | null;
  teamCode: string | null;
  teamName: string;
  trainingForecast: number;
  /** Ligaweiter OVR-Rang — siehe `LeagueLeaderSourceRow.ovrRank`. */
  ovrRank: number | null;
};

/**
 * Bereits fertig sortierte Most-Improved-Zeilen aus `most-improved-service`.
 *
 * Bewusst strukturell und ohne Import aus jenem Service — dieselbe Entkopplung wie bei
 * `ovrRankByPlayerId` weiter unten, und sie vermeidet einen Zyklus: der Most-Improved-Service
 * kennt den Kategorie-Typ von hier, hier ist von dort nichts noetig.
 */
export type LeagueMostImprovedSourceRow = {
  playerId: string;
  name: string;
  teamId: string | null;
  teamCode: string | null;
  teamName: string;
  delta: number;
  displayValue: string;
  /** Ligaweiter OVR-Rang — siehe `LeagueLeaderSourceRow.ovrRank`. */
  ovrRank: number | null;
  /**
   * DIE HERLEITUNG DER ZAHL — gewuenscht von Chris (`pxoa72`): „Wir brauchen noch eine erklärung
   * wie Most Improved Player sich zusammensetzt!"
   *
   * Sie wurde in `buildMostImprovedRows` laengst gerechnet und hier weggeworfen; uebrig blieb das
   * blosse Delta. Damit war die Zahl im Spiel nicht nachvollziehbar — genau Chris' Beanstandung.
   * Gereicht wird, was das Mass ausmacht: die mittlere Feldposition beider Saisonhaelften und wie
   * viele Auftritte dahinterstehen.
   */
  earlyFieldPosition?: number | null;
  lateFieldPosition?: number | null;
  earlyAppearances?: number | null;
  lateAppearances?: number | null;
};

export type LeagueLeaderTone = "total" | "pow" | "spe" | "men" | "soc" | "mvs" | "ovr" | "training" | "improved";

export type LeagueLeaderCategoryId =
  | "pps"
  | "pow"
  | "spe"
  | "men"
  | "soc"
  | "ovr"
  | "mvs"
  | "training"
  | "mostImproved";

export type LeagueLeaderEntry = {
  rank: number;
  playerId: string;
  name: string;
  teamId: string | null;
  teamCode: string | null;
  teamName: string;
  value: number;
  displayValue: string;
  /** Ligaweiter OVR-Rang — siehe `LeagueLeaderSourceRow.ovrRank`. */
  ovrRank: number | null;
  /** Nur bei „Most Improved" gesetzt — die Herleitung fuer das Hover (`pxoa72`). */
  mostImproved?: {
    earlyFieldPosition: number | null;
    lateFieldPosition: number | null;
    earlyAppearances: number | null;
    lateAppearances: number | null;
  } | null;
};

export type LeagueLeaderCategory = {
  id: string;
  label: string;
  tone: LeagueLeaderTone;
  /** Die Kachel-Ansicht: die ersten `limit` Plaetze (Standard 5). */
  entries: LeagueLeaderEntry[];
  /**
   * Dieselbe Rangliste, ungekappt — fuer das Aufklappen ("Ganze Rangliste").
   *
   * GEWUENSCHT: „dass man in jede top 5 rein klicken kann auf nen button und dann die tabelle
   * aufgeht wo man z.B. dann ne top 50 oder so sehen kann oder sogar alle."
   *
   * Bewusst ein zweites FELD und nicht ein zweiter Aufruf mit hoeherem Limit: sortiert und
   * bewertet wird genau einmal, `entries` ist woertlich `fullEntries.slice(0, limit)`. Damit
   * kann die lange Liste gar nicht in einer anderen Reihenfolge stehen als die kurze.
   *
   * Und bewusst NICHT `entries` selbst ungekappt: daran haengen Zaehlungen, die „Top 5"
   * woertlich meinen — der Leaderboard-Footprint („2× Top-5") und das Achievement „Top-5 der
   * Liga". Waere `entries` die volle Liste, zaehlten beide jeden Spieler der Liga mit.
   */
  fullEntries: LeagueLeaderEntry[];
};

export const LEAGUE_LEADER_DEFAULT_LIMIT = 5;

/**
 * Saisonstart-/Leerzustand einer Kategorie (Muster 3, Paket W2) — die EINE Quelle
 * für die Frage „trägt diese Wertung schon etwas Reihbares?".
 *
 * Eine Kategorie ist „pending", wenn sie keine echte Wertung trägt: entweder gar
 * keine Einträge (die Quelle liefert `null`, z. B. PPs vor dem ersten Ledger-
 * Eintrag) oder ausnahmslos 0-Werte — dann wäre jede „Rangfolge" nur das
 * Alphabet aus dem Tiebreaker von `buildCategory`. Ein einziger Wert ≠ 0 macht
 * die Wertung echt, ausdrücklich auch ein negativer (Training/Most Improved
 * können unter 0 liegen): das ist das Spieler-Pendant zur Ranks-Regel „0 PPs
 * UND 0 Formbonus" — ein Spieler mit 0,0 in einer Liste, in der andere echte
 * Werte tragen, hat einen echten (letzten) Rang und ist KEIN Leerzustand.
 *
 * Verbraucher: Leaders-Kachelgrid (kollabiert pending-Kategorien zu einem
 * VeloPendingRanking), Own-Team-Footprint und Saison-Bestwerte (beide dürfen
 * aus einer Alphabet-Liste keine Top-5-Slots/„Bestwerte" zählen — sonst
 * vergibt die Seite am Saisonstart Medaillen an Spieler mit 0 PPs).
 */
export function isLeagueLeaderCategoryPending(category: LeagueLeaderCategory): boolean {
  const entries = category.fullEntries ?? category.entries;
  return entries.length === 0 || entries.every((entry) => entry.value === 0);
}

type LeaderCandidateRow = {
  playerId: string;
  name: string;
  teamId: string | null;
  teamCode: string | null;
  teamName: string;
  value: number | null;
  ovrRank: number | null;
  /** Optionale Herleitung, die die Kategorie unveraendert bis zur Anzeige durchreicht. */
  mostImproved?: LeagueLeaderEntry["mostImproved"];
};

function formatLeaderValue(categoryId: string, value: number): string {
  if (categoryId === "training") {
    return `${value > 0 ? "+" : ""}${formatLocalePoints(value, 1)} SP`;
  }

  if (categoryId === "mvs" || categoryId === "ovr") {
    return formatLocalePoints(value, 0);
  }

  return formatLocalePoints(value, 1);
}

function buildCategory(
  id: string,
  label: string,
  tone: LeagueLeaderTone,
  rows: LeaderCandidateRow[],
  limit: number,
): LeagueLeaderCategory {
  const fullEntries = rows
    .filter((row) => row.value != null && Number.isFinite(row.value))
    .sort((left, right) => {
      const valueDelta = (right.value ?? Number.NEGATIVE_INFINITY) - (left.value ?? Number.NEGATIVE_INFINITY);
      if (valueDelta !== 0) {
        return valueDelta;
      }

      return left.name.localeCompare(right.name, "de");
    })
    .map((row, index) => ({
      rank: index + 1,
      playerId: row.playerId,
      name: row.name,
      teamId: row.teamId,
      teamCode: row.teamCode,
      teamName: row.teamName,
      value: row.value as number,
      displayValue: formatLeaderValue(id, row.value as number),
      ovrRank: row.ovrRank,
    }));

  return { id, label, tone, entries: fullEntries.slice(0, limit), fullEntries };
}

/**
 * Kategorie aus einer Liste, die ihre Reihenfolge SCHON mitbringt.
 *
 * `buildCategory` sortiert selbst (Wert, dann Name) — fuer Most Improved waere das falsch: dort
 * loest `compareMostImprovedRows` den Gleichstand feiner auf, und genau diese Reihenfolge muss
 * die Bestenliste uebernehmen, sonst kuert die Liste einen anderen Ersten als die
 * Saisonende-Auszeichnung.
 */
function buildPreSortedCategory(
  id: string,
  label: string,
  tone: LeagueLeaderTone,
  rows: Array<LeaderCandidateRow & { displayValue: string }>,
  limit: number,
): LeagueLeaderCategory {
  const fullEntries = rows
    .filter((row) => row.value != null && Number.isFinite(row.value))
    .map((row, index) => ({
      rank: index + 1,
      // Zusatzfelder unveraendert weiterreichen (heute: die Most-Improved-Herleitung). Ohne diese
      // Zeile faellt die Erklaerung genau hier wieder heraus.
      ...(row.mostImproved ? { mostImproved: row.mostImproved } : {}),
      playerId: row.playerId,
      name: row.name,
      teamId: row.teamId,
      teamCode: row.teamCode,
      teamName: row.teamName,
      value: row.value as number,
      displayValue: row.displayValue,
      ovrRank: row.ovrRank,
    }));

  return { id, label, tone, entries: fullEntries.slice(0, limit), fullEntries };
}

export function buildLeagueLeaderBoards(input: {
  seasonRows: LeagueLeaderSourceRow[];
  trainingRows?: LeagueTrainingLeaderSourceRow[];
  mostImprovedRows?: LeagueMostImprovedSourceRow[];
  limit?: number;
}): LeagueLeaderCategory[] {
  const limit = input.limit ?? LEAGUE_LEADER_DEFAULT_LIMIT;

  const mapSeasonRows = (picker: (row: LeagueLeaderSourceRow) => number | null): LeaderCandidateRow[] =>
    input.seasonRows.map((row) => ({
      playerId: row.playerId,
      name: row.name,
      teamId: row.teamId,
      teamCode: row.teamCode,
      teamName: row.teamName,
      value: picker(row),
      ovrRank: row.ovrRank,
    }));

  const categories: LeagueLeaderCategory[] = [
    buildCategory("pps", "PPs", "total", mapSeasonRows((row) => row.pps), limit),
    buildCategory("pow", "PP Pow", "pow", mapSeasonRows((row) => row.ppPow), limit),
    buildCategory("spe", "PP Spe", "spe", mapSeasonRows((row) => row.ppSpe), limit),
    buildCategory("men", "PP Men", "men", mapSeasonRows((row) => row.ppMen), limit),
    buildCategory("soc", "PP Soc", "soc", mapSeasonRows((row) => row.ppSoc), limit),
    buildCategory("mvs", "MVS", "mvs", mapSeasonRows((row) => row.mvs), limit),
    buildCategory("ovr", "OVR", "ovr", mapSeasonRows((row) => row.ovr), limit),
  ];

  if (input.trainingRows && input.trainingRows.length > 0) {
    categories.push(
      buildCategory(
        "training",
        "Training",
        "training",
        input.trainingRows.map((row) => ({
          playerId: row.playerId,
          name: row.name,
          teamId: row.teamId,
          teamCode: row.teamCode,
          teamName: row.teamName,
          value: row.trainingForecast,
          ovrRank: row.ovrRank,
        })),
        limit,
      ),
    );
  }

  if (input.mostImprovedRows && input.mostImprovedRows.length > 0) {
    categories.push(
      buildPreSortedCategory(
        "mostImproved",
        "Most Improved",
        "improved",
        input.mostImprovedRows.map((row) => ({
          playerId: row.playerId,
          name: row.name,
          teamId: row.teamId,
          teamCode: row.teamCode,
          teamName: row.teamName,
          value: row.delta,
          displayValue: row.displayValue,
          ovrRank: row.ovrRank,
          mostImproved: {
            earlyFieldPosition: row.earlyFieldPosition ?? null,
            lateFieldPosition: row.lateFieldPosition ?? null,
            earlyAppearances: row.earlyAppearances ?? null,
            lateAppearances: row.lateAppearances ?? null,
          },
        })),
        limit,
      ),
    );
  }

  return categories;
}

/**
 * `ovrRankByPlayerId` ist bewusst ein schmaler `{ ovrRank }`-Lookup statt des
 * vollen `PlayerRatingContractRow` — dieser Service bleibt so von der
 * Rating-Contract-Form entkoppelt (strukturelle Zuweisbarkeit reicht, siehe
 * `SeasonStandingsRatingsInput` für dasselbe Muster).
 */
export function buildLeagueTrainingLeaderRows(
  gameState: GameState,
  ovrRankByPlayerId?: ReadonlyMap<string, { ovrRank: number | null } | null | undefined>,
): LeagueTrainingLeaderSourceRow[] {
  const rosterByPlayerId = new Map(gameState.rosters.map((entry) => [entry.playerId, entry] as const));
  const teamById = new Map(gameState.teams.map((team) => [team.teamId, team] as const));

  return gameState.players
    .map((player) => {
      const roster = rosterByPlayerId.get(player.id);
      if (!roster) {
        return null;
      }

      const team = teamById.get(roster.teamId) ?? null;
      const facilities = getTeamFacilityState(gameState, roster.teamId);
      const progression = buildOrganicSeasonProgression({
        gameState,
        player,
        facilities,
      });

      return {
        playerId: player.id,
        name: player.name,
        teamId: team?.teamId ?? null,
        teamCode: team?.shortCode ?? null,
        teamName: team?.name ?? "—",
        trainingForecast: progression.netSetpoints,
        ovrRank: ovrRankByPlayerId?.get(player.id)?.ovrRank ?? null,
      };
    })
    .filter((row): row is LeagueTrainingLeaderSourceRow => Boolean(row));
}
