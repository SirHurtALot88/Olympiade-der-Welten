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
 * Aus dem Ledger werden nur Werte > 0 aufgenommen: vor dem ersten gewerteten
 * Spieltag hat niemand PPs — dann bleibt die Liste leer und das Hover-Panel zeigt
 * ehrlich "noch keine PPs" statt einer erfundenen Rangfolge aus lauter Nullen.
 * Die TEILNAHME an einer Disziplin kommt dagegen aus den Einsatz-Zeilen
 * (`appearances`), nicht aus den Punkten — siehe dort, warum.
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
 * überhaupt dabei und was hat er geholt". Da wäre ein Top-3-Schnitt irreführend.
 * Die Kappung ist reiner Panel-Schutz für Disziplinen mit sehr vielen Startern.
 *
 * Hier stand: "es sind ohnehin nur die Spieler mit PPs > 0, also die tatsächlichen
 * Teilnehmer." Genau diese Gleichsetzung war der Fehler — wer angetreten ist und
 * nichts geholt hat, ist trotzdem angetreten. Siehe `SeasonStandingsAppearanceInput`.
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

/**
 * Die tatsaechlichen Antritte dieser Saison — eine Zeile je Spieler und Disziplin-Einsatz.
 *
 * GEMELDET VON CHRIS (Saisonstand, „Disziplinen nach Bereich"): „hier sind in klammern bei den
 * diszis teils 0 spieler ausgewiesen bitte pruefen und korrigieren".
 *
 * BEFUND, am Live-Spielstand nachgemessen (Save `…-0kalpx`, 352 Kombinationen aus Team ×
 * angetretener Disziplin): in 22 Faellen (6 %) stand eine ZU KLEINE Zahl. Bei Pirate Crew etwa
 * Wettessen „(4)" bei sechs Antritten und Football „(1)" bei zwei.
 *
 * Die Zahl kam aus `pointsByDiscipline` und zaehlte nur Spieler mit `points > 0`. Wer angetreten
 * ist und nichts geholt hat, fiel heraus — waehrend der Tooltip daneben behauptete, so viele
 * Spieler seien „hier im Einsatz" gewesen. Wieder zwei Groessen unter einem Namen: gezaehlt wurde
 * PUNKTE-GEHOLT, behauptet wurde ANGETRETEN.
 *
 * Deshalb kommen die Teilnehmer jetzt aus den Einsatz-Zeilen selbst. Die PPs bleiben der WERT
 * jedes Eintrags (dafuer ist der Ledger die Quelle) — er ist dann eben 0, und das ist die
 * Wahrheit ueber diesen Einsatz, keine Luecke.
 *
 * (Nicht Teil des Befunds: Disziplinen, die die Liga noch nicht gespielt hat, zeigen weiterhin
 * „(0) —". Gemessen gab es KEINEN Fall, in dem eine bereits bestrittene Disziplin auf 0 stand.)
 */
export type SeasonStandingsAppearanceInput = Array<{
  teamId: string;
  playerId: string;
  disciplineId: string;
}>;

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
  /** Tatsaechliche Antritte dieser Saison — ohne sie fehlen die Teilnehmer ohne PPs. */
  appearances?: SeasonStandingsAppearanceInput | null;
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

  /**
   * Die Antritte OHNE Punkte nachtragen — sie fehlten bisher ganz (siehe
   * `SeasonStandingsAppearanceInput`). Der Ledger bleibt die Quelle des WERTES, die Einsatz-Zeilen
   * sind die Quelle der TEILNAHME. Wer schon ueber den Ledger drin ist, wird nicht verdoppelt.
   */
  if (input.appearances) {
    const bereitsDrin = new Set<string>();
    for (const [teamId, columns] of result) {
      for (const [columnKey, entries] of Object.entries(columns)) {
        for (const entry of entries ?? []) bereitsDrin.add(`${teamId}|${columnKey}|${entry.playerId}`);
      }
    }
    for (const appearance of input.appearances) {
      const columnKey = normalizeLineupDisciplineFieldName(appearance.disciplineId);
      if (!isSeasonDisciplineKey(columnKey)) {
        continue;
      }
      const schluessel = `${appearance.teamId}|${columnKey}|${appearance.playerId}`;
      if (bereitsDrin.has(schluessel)) {
        continue;
      }
      const player = playersById.get(appearance.playerId);
      if (!player) {
        continue;
      }
      bereitsDrin.add(schluessel);
      // Wert 0: der Spieler war dabei und hat nichts geholt. Das IST die Auskunft.
      push(appearance.teamId, columnKey, { playerId: player.id, playerName: player.name, value: 0 });
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
