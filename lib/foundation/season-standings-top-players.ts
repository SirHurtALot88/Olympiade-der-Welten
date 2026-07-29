import type { GameState } from "@/lib/data/olyDataTypes";
import { normalizeLineupDisciplineFieldName } from "@/lib/lineups/team-discipline-ranks";
import {
  isSeasonDisciplineKey,
  type SeasonDisciplineAreaId,
  type SeasonDisciplineKey,
} from "@/lib/season/season-discipline-area-groups";

/**
 * Saisonstand-Hover: Top-3-Spieler je Team für ALLE 24 Spalten (4 Achsen
 * POW/SPE/MEN/SOC + 20 Disziplinen), jeweils nach den PPs in genau diesem
 * Bereich bzw. dieser Disziplin.
 *
 * WARUM einmalig vorberechnet: 32 Teams × 24 Spalten — pro Hover zu rechnen
 * hieße bei jedem Mouse-Enter über Roster + Ledger zu iterieren. Stattdessen
 * EIN Durchlauf über die Kader, memoisiert beim Aufrufer (Season-V2-Host).
 *
 * Datenquellen — nichts erfunden:
 * - Achsen: `ppPow/ppSpe/ppMen/ppSoc` aus dem Player-Rating-Contract. Verifizierte
 *   Invariante: die vier Achsenwerte summieren sich exakt auf `ppsSeason` —
 *   es sind also echte Saison-PPs je Bereich, keine Kernwerte-Näherung.
 * - Disziplinen: `pointsByDiscipline` je Spieler aus dem Season-Points-Ledger
 *   (dieselbe Quelle, aus der auch die Team-Disziplinspalten des Saisonstands
 *   aufsummiert werden), Discipline-ID → Spaltenschlüssel über
 *   `normalizeLineupDisciplineFieldName` (z. B. "mini-dm" → "mini_dm").
 *
 * Nur Werte > 0 werden aufgenommen: vor dem ersten gewerteten Spieltag hat
 * niemand PPs — dann bleibt die Liste leer und das Hover-Panel zeigt ehrlich
 * "noch keine PPs" statt einer erfundenen Rangfolge aus lauter Nullen.
 */

export type SeasonStandingsTopPlayerEntry = {
  playerId: string;
  playerName: string;
  /** PPs des Spielers in genau dieser Achse bzw. Disziplin. */
  value: number;
};

export type SeasonStandingsTopPlayersColumnKey = SeasonDisciplineAreaId | SeasonDisciplineKey;

export type SeasonStandingsTopPlayersByTeam = Map<
  string,
  Partial<Record<SeasonStandingsTopPlayersColumnKey, SeasonStandingsTopPlayerEntry[]>>
>;

/**
 * Achsen-Spalten (POW/SPE/MEN/SOC) sammeln den ganzen Kader — dort ist nur die
 * Spitze interessant, deshalb Top 3.
 */
const TOP_PLAYERS_PER_AREA_COLUMN = 3;
/**
 * Disziplin-Spalten beantworten eine ANDERE Frage: "wer war in dieser Disziplin
 * überhaupt dabei und was hat er geholt". Da wäre ein Top-3-Schnitt irreführend —
 * es sind ohnehin nur die Spieler mit PPs > 0, also die tatsächlichen Teilnehmer.
 * Die Kappung ist reiner Panel-Schutz für Disziplinen mit sehr vielen Startern.
 */
const TOP_PLAYERS_PER_DISCIPLINE_COLUMN = 12;

/**
 * Bewusst strukturell-minimal statt `PlayerRatingContractRow`/`SeasonPointsLedger`:
 * Der Season-V2-Host führt beide Quellen nur mit schmalen Struktur-Typen
 * (`UseSeasonV2DataInput`) — die vollen Typen würden dort nicht zuweisbar sein,
 * obwohl die Laufzeitobjekte alle Felder tragen. `pointsByDiscipline` ist deshalb
 * optional; fehlt es, gibt es schlicht keine Disziplin-Hover (ehrlich leer).
 */
export type SeasonStandingsRatingsInput = Map<
  string,
  { ppPow?: number | null; ppSpe?: number | null; ppMen?: number | null; ppSoc?: number | null }
>;

export type SeasonStandingsLedgerInput = {
  playerSummariesByPlayerId: Map<string, { pointsByDiscipline?: Record<string, number> }>;
};

const AXIS_RATING_FIELDS: Array<{ key: SeasonDisciplineAreaId; field: "ppPow" | "ppSpe" | "ppMen" | "ppSoc" }> = [
  { key: "pow", field: "ppPow" },
  { key: "spe", field: "ppSpe" },
  { key: "men", field: "ppMen" },
  { key: "soc", field: "ppSoc" },
];

export function buildSeasonStandingsTopPlayersByTeam(input: {
  gameState: Pick<GameState, "players" | "rosters">;
  playerRatingsById: SeasonStandingsRatingsInput | null | undefined;
  seasonPointsLedger: SeasonStandingsLedgerInput | null | undefined;
}): SeasonStandingsTopPlayersByTeam {
  const result: SeasonStandingsTopPlayersByTeam = new Map();
  const playersById = new Map(input.gameState.players.map((player) => [player.id, player] as const));

  const push = (
    teamId: string,
    columnKey: SeasonStandingsTopPlayersColumnKey,
    entry: SeasonStandingsTopPlayerEntry,
  ) => {
    const columns = result.get(teamId) ?? {};
    const bucket = columns[columnKey] ?? [];
    bucket.push(entry);
    columns[columnKey] = bucket;
    result.set(teamId, columns);
  };

  for (const rosterEntry of input.gameState.rosters) {
    const player = playersById.get(rosterEntry.playerId);
    if (!player) {
      continue;
    }

    const rating = input.playerRatingsById?.get(player.id) ?? null;
    if (rating) {
      for (const { key, field } of AXIS_RATING_FIELDS) {
        const value = rating[field] ?? null;
        if (value != null && Number.isFinite(value) && value > 0) {
          push(rosterEntry.teamId, key, { playerId: player.id, playerName: player.name, value });
        }
      }
    }

    const summary = input.seasonPointsLedger?.playerSummariesByPlayerId.get(player.id) ?? null;
    if (summary) {
      for (const [disciplineId, points] of Object.entries(summary.pointsByDiscipline ?? {})) {
        if (!(points > 0)) {
          continue;
        }
        const columnKey = normalizeLineupDisciplineFieldName(disciplineId);
        if (!isSeasonDisciplineKey(columnKey)) {
          continue;
        }
        push(rosterEntry.teamId, columnKey, { playerId: player.id, playerName: player.name, value: points });
      }
    }
  }

  // Je Spalte absteigend sortieren und kappen (Achse: Top 3, Disziplin: alle
  // Teilnehmer bis zum Panel-Limit); Gleichstand stabil über den Namen auflösen,
  // damit das Panel nicht bei jedem Render flackert.
  for (const columns of result.values()) {
    for (const key of Object.keys(columns) as SeasonStandingsTopPlayersColumnKey[]) {
      const limit = isSeasonDisciplineKey(key) ? TOP_PLAYERS_PER_DISCIPLINE_COLUMN : TOP_PLAYERS_PER_AREA_COLUMN;
      columns[key] = [...(columns[key] ?? [])]
        .sort((left, right) => right.value - left.value || left.playerName.localeCompare(right.playerName, "de"))
        .slice(0, limit);
    }
  }

  return result;
}
