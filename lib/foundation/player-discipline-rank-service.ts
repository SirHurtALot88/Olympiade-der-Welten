import type { GameState } from "@/lib/data/olyDataTypes";
import { getSeasonPointsLedger } from "@/lib/foundation/get-season-derivations";
import {
  buildDisciplineGlobalRankMaps,
  resolveRosterEntry,
  type PlayerDisciplineRankOverride,
} from "@/lib/foundation/player-detail-drawer";

export type { PlayerDisciplineRankOverride } from "@/lib/foundation/player-detail-drawer";

/**
 * Saison-/All-Time-Rang je Disziplin für GENAU einen Spieler, gerechnet auf dem
 * VOLLSTÄNDIGEN Save (bug-2026-08-04T13-23-39-256Z-uzetn6 — "Top Disziplinen …
 * da fehlt jeweils auch der Rank das hatten wir früher drin").
 *
 * GEMELDET: Chris sieht in der Top-Disziplinen-Tabelle des Spielerprofils
 * korrekte PPs-Zahlen, aber keinen Rang — weder Saison- noch All-Time-Spalte.
 *
 * DIE URSACHE. `buildDisciplineGlobalRankMaps` (player-detail-drawer.ts) rankt
 * über den Saison-Punkte-Ledger (braucht `matchdayResults`/`disciplineResults`
 * ALLER Spieltage) und die `seasonSnapshots` (All-Time). Der Foundation-Client
 * hält den kompakten Payload (`compactFoundationInitialGameState`), der genau
 * diese beiden Quellen auf den aktiven Spieltag beschneidet bzw. ganz entfernt.
 * Die PPs-ZAHL kommt aus der Spieler-Performance (bleibt im Payload), der RANG
 * braucht dagegen den Vergleich über ALLE Spieler — und der läuft ins Leere.
 *
 * GEMESSEN am gemeldeten Spielstand (new-game-1785823388048-1hf25q, Saison 1,
 * Spieler Gronn): voller Save 6 Disziplin-Zeilen mit Saison-Rang und 6 mit
 * All-Time-Rang, kompakter Payload 0 und 0 — bei identischen PP-Zahlen.
 *
 * DER WEG (wie #397 beim Verkaufsfaktor): serverseitig auf dem vollständigen
 * Save rechnen und NUR für den angezeigten Spieler durchreichen — nicht die
 * Ränge aller Spieler aller Disziplinen (das wäre der Player-Directory-Slice-
 * Ansatz, aber für eine Detailansicht mit einem sichtbaren Spieler unnötig
 * groß). Bewusst DÜNN besetzt: eine fehlende Disziplin-ID heißt "kein Rang"
 * (Spieler ohne Punkte in dieser Disziplin, typischerweise Saisonstart oder
 * eine Disziplin außerhalb seines Portfolios) — nicht "Rang unbekannt". Der
 * Consumer (`buildDisciplineValuesFromPlayer`) darf das NICHT mit der
 * clientseitigen Berechnung auffüllen, sonst kommt exakt der Fehler zurück,
 * den `docs/CLIENT_PAYLOAD_LEERE_ABLEITUNGEN.md` als "was NICHT hilft"
 * dokumentiert: eine falsche Zahl statt eines ehrlich leeren Felds.
 */
export function buildPlayerDisciplineRankOverride(input: {
  gameState: GameState;
  playerId: string;
  saveId: string;
}): PlayerDisciplineRankOverride {
  const rosterEntry = resolveRosterEntry(input.gameState.rosters, input.playerId, null);
  // Dieselbe Rang-Pool-Regel wie im Live-Browser-Pfad (player-detail-drawer.ts):
  // ein gerosterter Spieler rankt nur gegen andere geroaterte Spieler, ein Free
  // Agent gegen den gesamten Spielerpool.
  const activePlayerIds = Array.from(
    new Set((input.gameState.rosters ?? []).map((entry) => entry.playerId).filter(Boolean)),
  );
  const ledger = getSeasonPointsLedger({ gameState: input.gameState, saveId: input.saveId });
  const globalRankMaps = buildDisciplineGlobalRankMaps(
    input.gameState,
    input.gameState.disciplines,
    ledger,
    rosterEntry ? activePlayerIds : null,
  );

  const seasonPointsRankByDisciplineId: Record<string, number> = {};
  const allTimePointsRankByDisciplineId: Record<string, number> = {};
  for (const discipline of input.gameState.disciplines) {
    const seasonRank = globalRankMaps.seasonPointsRanksByDiscipline.get(discipline.id)?.get(input.playerId) ?? null;
    if (seasonRank != null) {
      seasonPointsRankByDisciplineId[discipline.id] = seasonRank;
    }
    const allTimeRank = globalRankMaps.allTimePointsRanksByDiscipline.get(discipline.id)?.get(input.playerId) ?? null;
    if (allTimeRank != null) {
      allTimePointsRankByDisciplineId[discipline.id] = allTimeRank;
    }
  }

  return { seasonPointsRankByDisciplineId, allTimePointsRankByDisciplineId };
}
