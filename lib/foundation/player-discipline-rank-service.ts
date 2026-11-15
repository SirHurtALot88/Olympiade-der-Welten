import type { GameState } from "@/lib/data/olyDataTypes";
import { getSeasonDerivations } from "@/lib/foundation/get-season-derivations";
/**
 * Bewusst der LEANE Kern (`player-discipline-rank-core.ts`), nicht `player-detail-drawer.ts`
 * selbst — siehe dessen Kopfkommentar. Diese Route braucht Raenge/Punkte fuer GENAU einen
 * Spieler, nicht das komplette Spielerprofil (Scouting/Training/Wirtschaft/Moral/…), das
 * `buildPlayerDrawerDataFromGameState` sonst IMMER mitbaut. Frueher zog der Import von
 * `player-detail-drawer.ts` dessen vollen ~20-Subsysteme-Abhaengigkeitsgraphen (385 Module /
 * 16,45 MB) in diese Route — Ursache eines `next dev`-OOM (dmesg bestaetigt echte >13-GB-Kills
 * in diesem Container). Der Kern liefert dieselben Funktionen (keine Logikaenderung), nur ohne
 * den Ballast.
 */
import {
  buildDisciplineGlobalRankMaps,
  buildDisciplineValuesFromPlayer,
  findLatestArchivedPlayerPerformance,
  resolveAttributeVisibility,
  resolveRosterEntry,
  resolveTeam,
  type PlayerDisciplineRankOverride,
} from "@/lib/foundation/player-discipline-rank-core";

export type { PlayerDisciplineRankOverride } from "@/lib/foundation/player-discipline-rank-core";

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
  // EINE Quelle fuer Ledger UND Saison-Performance (statt zwei getrennten Berechnungen) — dieselbe
  // Rechenstelle, die `buildPlayerDrawerDataFromGameState` intern auch nutzt.
  const seasonDerivations = getSeasonDerivations({ gameState: input.gameState, saveId: input.saveId });
  const globalRankMaps = buildDisciplineGlobalRankMaps(
    input.gameState,
    input.gameState.disciplines,
    seasonDerivations.ledger,
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

  /**
   * DIE ZAHL FAEHRT MIT, NICHT NUR IHR RANG (`l4835p`).
   *
   * Der Rang-Teil oben entstand, weil der kompakte Browser-Payload die Vergleichsgrundlage
   * beschneidet. Fuer die ALL-TIME-PUNKTE gilt dasselbe eine Stufe frueher: die Aufschluesselung je
   * Disziplin faellt beim Zusammenfalten der Archiv-Saisons ganz weg
   * (`foundation-season-history-projection.ts`, bewusst — 647 KiB gegen 88 KiB je Saison). Gemessen
   * am Abbild `hwz8fk`: der Ersatz-Schnappschuss traegt alle 339 Spielerzeilen, aber keine einzige
   * Disziplin-Zeile; Madrots All-Time steht auf dem vollen Save bei TDM 1,8 / Mini DM 1,3 /
   * Wettessen 0,7 und im Browser bei nichts.
   *
   * KEINE ZWEITE RECHENWEISE, und das ist hier woertlich zu nehmen: die Summe kommt aus DERSELBEN
   * Funktion, die die Ansicht aufruft — nur auf dem vollen Save statt auf dem beschnittenen.
   *
   * Eine erste Fassung summierte hier von Hand ueber die Schnappschuesse. Sie war falsch, und der
   * Test hat es sofort gezeigt (50 gegen 53,7): die Ansicht zaehlt zusaetzlich die LAUFENDE Saison
   * mit, solange fuer sie noch kein Schnappschuss existiert (`if (!hasCurrentSeasonSnapshot)` in
   * `buildDisciplineValuesFromPlayer`). Genau so entsteht der Widerspruch, gegen den dieses
   * Override antritt — nur eine Ebene tiefer.
   */
  /**
   * DIESELBE BRANCH-LOGIK WIE `buildPlayerDrawerDataFromGameState`, nur ohne dessen restliche
   * ~20 Teilsysteme aufzurufen: `buildDisciplineValuesFromPlayer` ist exakt dieselbe Funktion,
   * nur direkt statt ueber den vollen Drawer-Aufbau erreicht. Fuer die "scouted"-Sichtbarkeit
   * liefert der Drawer hier ohnehin IMMER leere allTimePoints/-Appearances/-Ranks
   * (`buildScoutedDisciplineValuesFromPlayer` setzt sie hart auf null) — die leeren Maps unten
   * sind also dasselbe Ergebnis, nur ohne die (nutzlose) Rechnung dafuer.
   */
  const player = input.gameState.players.find((entry) => entry.id === input.playerId) ?? null;
  const team = resolveTeam(input.gameState.teams, rosterEntry);
  const attributeVisibility = resolveAttributeVisibility({
    teamId: rosterEntry?.teamId ?? team?.teamId ?? null,
    teamHumanControlled: team ? team.humanControlled !== false : null,
    manageableTeamIds: null,
    scoutingLevel: 0,
    isOnViewingTeamRoster: Boolean(rosterEntry && team?.teamId && rosterEntry.teamId === team.teamId),
  });

  const allTimePointsByDisciplineId: Record<string, number> = {};
  const allTimeAppearancesByDisciplineId: Record<string, number> = {};
  if (attributeVisibility === "exact") {
    const seasonPerformance = seasonDerivations.performanceByPlayerId.get(input.playerId) ?? null;
    const latestArchivedPerformance = findLatestArchivedPlayerPerformance(input.gameState, input.playerId);
    const disciplineValues = buildDisciplineValuesFromPlayer(
      player,
      input.gameState.disciplines,
      seasonPerformance,
      latestArchivedPerformance,
      input.gameState,
      globalRankMaps,
      null,
    );
    for (const zeile of disciplineValues) {
      if (zeile.allTimePoints != null) {
        allTimePointsByDisciplineId[zeile.id] = zeile.allTimePoints;
      }
      if (zeile.allTimeAppearances != null) {
        allTimeAppearancesByDisciplineId[zeile.id] = zeile.allTimeAppearances;
      }
    }
  }

  return {
    seasonPointsRankByDisciplineId,
    allTimePointsRankByDisciplineId,
    allTimePointsByDisciplineId,
    allTimeAppearancesByDisciplineId,
  };
}
