import type { DisciplineCategory, GameState, Player, RosterEntry, Team } from "@/lib/data/olyDataTypes";
import { roundValue } from "@/lib/foundation/foundation-number-utils";
import { buildSeasonPointsLedger } from "@/lib/foundation/season-points-ledger";
import { clampSeasonSnapshotsToCurrentSeason } from "@/lib/foundation/season-history-clamp";
import { leseSaisonSchnappschuesse } from "@/lib/persistence/foundation-season-history-projection";
import { resolveSnapshotPlayerPerformanceRow } from "@/lib/foundation/snapshot-player-performance";
import { buildPlayerDisciplineLaufbahn } from "@/lib/season/player-discipline-laufbahn";
import {
  buildSeasonDisciplinePlayerCountDisplayMap,
  buildSeasonDisciplinePlayerCountMap,
} from "@/lib/season/season-discipline-schedule";
import { DEBUG_FORCE_PLAYER_VISIBILITY } from "@/lib/foundation/debug-player-visibility";

/**
 * LEAN KERN fuer Disziplin-Raenge/-Punkte je Spieler — bewusst OHNE die ~20 schweren
 * Teilbaeume (Scouting, Training, Wirtschaft, Erschoepfung/Verletzung, Einrichtungen,
 * Moral, Saisonhistorie-Projektion-fuer-die-volle-UI), die `player-detail-drawer.ts`
 * sonst fuer sein großes UI-Dashboard mitzieht.
 *
 * URSACHE eines Dev-Server-OOM (`next dev`, V8 >13 GB RSS, OOM-kill — dmesg bestaetigt
 * mehrere echte Kills dieser Groessenordnung in diesem Container): die Route
 * `/api/singleplayer-state/player-discipline-ranks` brauchte fuer EINEN Spieler nur
 * Raenge/Punkte je Disziplin, zog dafuer aber ueber `player-detail-drawer.ts`
 * (3552 Zeilen, 20+ Top-Level-Imports: Scouting, Moral, Wirtschaft, Training,
 * Erschoepfung/Verletzung, Einrichtungen, Saisonhistorie …) den gesamten
 * Foundation-Abhaengigkeitsgraphen mit — `buildPlayerDrawerDataFromGameState` baut
 * IMMER das komplette Spielerprofil (Scouting-Snapshot, Boardtrust, Moral,
 * Economy-Compare, Trainings-/Progressions-Forecast, Verletzungshistorie,
 * Attribut-/Trainingshistorie, Verfuegbarkeit/Erholung …), auch wenn der Aufrufer
 * nur `disciplineValues` liest.
 *
 * Diese Datei haelt genau die Funktionen, die `buildDisciplineGlobalRankMaps`,
 * `buildDisciplineValuesFromPlayer`, `resolveRosterEntry`/`resolveTeam` und
 * `resolveAttributeVisibility` tatsaechlich brauchen — gemessen (madge) sind das
 * ~15 schlanke Module (Saison-Ledger, Saison-Schnappschuesse, Disziplin-Laufbahn,
 * Spieltplan-Kaderzahlen) statt der 385 Module / 16,45 MB, die der volle
 * Drawer-Import mitzieht. `player-detail-drawer.ts` re-exportiert von hier, damit
 * sich am oeffentlichen Interface fuer seine bestehenden Nutzer (Spielerprofil-
 * Panel, `server-player-visibility.ts`) nichts aendert.
 */

export type AttributeVisibility = "exact" | "scouted";

export type DisciplineGlobalRankMaps = {
  valueRanksByDiscipline: Map<string, Map<string, number | null>>;
  seasonPointsRanksByDiscipline: Map<string, Map<string, number | null>>;
  allTimePointsRanksByDiscipline: Map<string, Map<string, number | null>>;
};

export type PlayerDisciplineDrawerDetail = {
  mutatorPps: number;
  slotLabels: string[];
};

/**
 * Server-berechnete Saison-/All-Time-Ränge je Disziplin für GENAU einen Spieler
 * (bug-2026-08-04T13-23-39-256Z-uzetn6 — "Top Disziplinen ... da fehlt jeweils
 * auch der Rank"). Siehe docs/CLIENT_PAYLOAD_LEERE_ABLEITUNGEN.md: der kompakte
 * Client-Payload streicht `matchdayResults`/`seasonSnapshots`, also ist
 * `buildDisciplineGlobalRankMaps` im Browser blind für alle Spieler außer dem
 * aktiven Spieltag — die PPs-Zahl stimmt (kommt aus der Spieler-Performance im
 * Payload), der Rang bräuchte aber den Vergleich über ALLE Spieler und fällt
 * sonst still auf null. Bewusst DÜNN besetzt (wie `disciplinePointsByPlayerId`):
 * eine fehlende Disziplin-ID heißt "kein Rang" (Spieler ohne Punkte in dieser
 * Disziplin, z. B. Saisonstart), nicht "Rang unbekannt".
 */
export type PlayerDisciplineRankOverride = {
  seasonPointsRankByDisciplineId: Record<string, number>;
  allTimePointsRankByDisciplineId: Record<string, number>;
  /**
   * ALL-TIME-PUNKTE JE DISZIPLIN — dieselbe Payload-Luecke wie bei den Raengen daneben, nur eine
   * Spalte weiter.
   *
   * GEMELDET VON CHRIS (`l4835p`): „in den Top Disziplinen sieht man nur die aktuelle Season in die
   * Punkte eingepreist! All Time fehlt komplett!"
   *
   * Die Zahlen sind LAENGST ARCHIVIERT: `season-snapshot-service.ts` schreibt je Spieler und
   * Disziplin `totalContribution`, und das ist bereits der PP-Wert aus dem Saison-Punkte-Ledger
   * (`pointEntriesByPerformanceId…points`), nicht der rohe Beitrag. Am Abbild `hwz8fk` summiert er
   * sich je Spieler auf `totalPoints` — 339 von 339 Zeilen, Abweichung maximal 0,2 (Rundung), und
   * die Einsatzzahlen stimmen bei allen exakt.
   *
   * WEG IST ER NUR IM BROWSER. `foundation-season-history-projection.ts` laesst
   * `disciplineBreakdown` beim Zusammenfalten AUSDRUECKLICH weg (647 KiB gegen 88 KiB je Saison) —
   * gemessen: der Ersatz-Schnappschuss traegt alle 339 Spielerzeilen, aber keine einzige
   * Disziplin-Zeile. Die All-Time-Spalte der Top-Disziplinen lief damit gegen eine leere Summe und
   * zeigte nichts, statt zu sagen, dass sie nichts weiss.
   *
   * Deshalb faehrt die Zahl denselben Weg wie der Rang: serverseitig auf dem vollen Save gerechnet,
   * NUR fuer den angezeigten Spieler. Kein Snapshot wird umgeschrieben, und bestehende Spielstaende
   * — Chris' Saison 1 eingeschlossen — zeigen die Werte sofort.
   *
   * Ebenfalls DUENN besetzt: eine fehlende Disziplin-ID heisst „keine Punkte", nicht „unbekannt".
   */
  allTimePointsByDisciplineId: Record<string, number>;
  allTimeAppearancesByDisciplineId: Record<string, number>;
};

/**
 * Die Saison-Schnappschuesse fuer die Spieler-Auswertungen dieses Moduls — voll auf dem Server,
 * aus der mitgefahrenen Kurzfassung wiederaufgebaut im Browser.
 *
 * GEMELDET (zwei Symptome, eine Ursache): „bitte prüfe dass die S1 snapshots mit den punkten usw in
 * den historien verfügbar ist" und „in den kacheln steht kein verlauf obwohl jasper in season 1
 * auch dabei war".
 *
 * `clampSeasonSnapshotsToCurrentSeason` liest per Vorgabe `seasonState.seasonSnapshots` — und die
 * streicht `compactFoundationInitialGameState` fuer den Browser. Ohne Schnappschuss faellt die
 * Historie auf eine Platzhalterzeile zurueck (jede Spalte „—"), und weil das Delta der
 * OVR/PPS/MVS-Kacheln gegen genau diese Zeile rechnet, steht dort „Kein Verlauf". Am Live-Save
 * nachgemessen: voll pps 10,7 / ovr 70,8 / mvs 13, kompaktiert ueberall null.
 *
 * Andere Ansichten (Ewige Tabelle, Ranks-Podium) hatten diesen Rueckfall laengst; dem Drawer fehlte er.
 */
export function schnappschuesseFuerSpielerhistorie(gameState: GameState) {
  return clampSeasonSnapshotsToCurrentSeason(gameState, leseSaisonSchnappschuesse(gameState));
}

export function buildSharedRankMap(values: Array<{ playerId: string; value: number | null }>) {
  const sorted = [...values].sort((left, right) => {
    const leftValue = left.value ?? Number.NEGATIVE_INFINITY;
    const rightValue = right.value ?? Number.NEGATIVE_INFINITY;
    if (rightValue !== leftValue) {
      return rightValue - leftValue;
    }
    return left.playerId.localeCompare(right.playerId, "de");
  });

  const rankMap = new Map<string, number | null>();
  let previousValue: number | null = null;
  let previousRank = 0;

  sorted.forEach((entry, index) => {
    if (entry.value == null) {
      rankMap.set(entry.playerId, null);
      return;
    }

    if (previousValue != null && entry.value === previousValue) {
      rankMap.set(entry.playerId, previousRank);
      return;
    }

    previousValue = entry.value;
    previousRank = index + 1;
    rankMap.set(entry.playerId, previousRank);
  });

  return rankMap;
}

function addDisciplinePoints(
  totalsByDiscipline: Map<string, Map<string, number>>,
  disciplineId: string | null | undefined,
  playerId: string | null | undefined,
  value: number | null | undefined,
) {
  if (!disciplineId || !playerId || value == null || !Number.isFinite(value)) {
    return;
  }
  const byPlayerId = totalsByDiscipline.get(disciplineId) ?? new Map<string, number>();
  byPlayerId.set(playerId, roundValue((byPlayerId.get(playerId) ?? 0) + value, 1));
  totalsByDiscipline.set(disciplineId, byPlayerId);
}

function mergeDisciplinePointTotals(
  target: Map<string, Map<string, number>>,
  source: Map<string, Map<string, number>>,
) {
  for (const [disciplineId, byPlayerId] of source.entries()) {
    const targetByPlayerId = target.get(disciplineId) ?? new Map<string, number>();
    for (const [playerId, value] of byPlayerId.entries()) {
      targetByPlayerId.set(playerId, roundValue((targetByPlayerId.get(playerId) ?? 0) + value, 1));
    }
    target.set(disciplineId, targetByPlayerId);
  }
}

export function buildDisciplineGlobalRankMaps(
  gameState: GameState,
  disciplines: Array<{ id: string; name: string; category: DisciplineCategory; playerCount?: number | null }>,
  currentSeasonLedger = buildSeasonPointsLedger(gameState),
  rankPoolPlayerIds?: string[] | null,
): DisciplineGlobalRankMaps {
  const rankPoolSet = rankPoolPlayerIds != null ? new Set(rankPoolPlayerIds.filter(Boolean)) : null;
  const rankedPlayers = rankPoolSet ? gameState.players.filter((player) => rankPoolSet.has(player.id)) : gameState.players;
  const valueRanksByDiscipline = new Map<string, Map<string, number | null>>();
  const seasonPointsRanksByDiscipline = new Map<string, Map<string, number | null>>();
  const allTimePointsRanksByDiscipline = new Map<string, Map<string, number | null>>();
  const currentSeasonId = gameState.season.id ?? null;
  const currentSeasonTotalsByDiscipline = new Map<string, Map<string, number>>();
  const allTimeTotalsByDiscipline = new Map<string, Map<string, number>>();

  for (const snapshot of clampSeasonSnapshotsToCurrentSeason(gameState)) {
    for (const playerPerformance of snapshot.playerPerformances ?? []) {
      for (const entry of playerPerformance.disciplineBreakdown ?? []) {
        addDisciplinePoints(allTimeTotalsByDiscipline, entry.disciplineId, playerPerformance.playerId, entry.totalContribution ?? null);
      }
    }
  }

  for (const entry of currentSeasonLedger.pointEntries) {
    const seasonId = entry.seasonId ?? currentSeasonId;
    if (currentSeasonId && seasonId !== currentSeasonId) {
      continue;
    }
    addDisciplinePoints(currentSeasonTotalsByDiscipline, entry.disciplineId, entry.playerId, entry.points ?? null);
  }

  const hasCurrentSeasonSnapshot = Boolean(
    currentSeasonId &&
      (gameState.seasonState.seasonSnapshots ?? []).some((snapshot) => snapshot.seasonId === currentSeasonId),
  );
  if (!hasCurrentSeasonSnapshot) {
    mergeDisciplinePointTotals(allTimeTotalsByDiscipline, currentSeasonTotalsByDiscipline);
  }

  for (const discipline of disciplines) {
    valueRanksByDiscipline.set(
      discipline.id,
      buildSharedRankMap(
        rankedPlayers.map((player) => ({
          playerId: player.id,
          value: player.currentDisciplineValues?.[discipline.id] ?? player.disciplineRatings?.[discipline.id] ?? null,
        })),
      ),
    );
    seasonPointsRanksByDiscipline.set(
      discipline.id,
      buildSharedRankMap(
        rankedPlayers.map((player) => ({
          playerId: player.id,
          value: currentSeasonTotalsByDiscipline.get(discipline.id)?.get(player.id) ?? null,
        })),
      ),
    );
    allTimePointsRanksByDiscipline.set(
      discipline.id,
      buildSharedRankMap(
        rankedPlayers.map((player) => ({
          playerId: player.id,
          value: allTimeTotalsByDiscipline.get(discipline.id)?.get(player.id) ?? null,
        })),
      ),
    );
  }

  return {
    valueRanksByDiscipline,
    seasonPointsRanksByDiscipline,
    allTimePointsRanksByDiscipline,
  };
}

/**
 * Anzeige-Label zur Kadergroesse einer Disziplin (W4,
 * docs/design/battle-mode-20-spieltage-recherche-06-09.md Abschnitt 1.8/5): zuerst das Label aus
 * `buildSeasonDisciplinePlayerCountDisplayMap` (bei zwei unterschiedlichen Saison-Vorkommen
 * "4 · 6"), sonst der reine Zahlenwert als Text, sonst nichts.
 */
export function resolveDisciplinePlayerCountLabel(
  display: { value: number | null; label: string | null } | undefined,
  numerischerRueckfall: number | null,
): string | null {
  if (display?.label) {
    return display.label;
  }
  const wert = display?.value ?? numerischerRueckfall;
  return wert != null ? String(wert) : null;
}

export function resolveAttributeVisibility(input: {
  teamId: string | null | undefined;
  teamHumanControlled: boolean | null | undefined;
  manageableTeamIds?: string[] | null;
  scoutingLevel?: number | null;
  isOnViewingTeamRoster?: boolean;
  /**
   * Der Betrachter will den Nebel ausdruecklich (Liga-Draft-Overlay, 19.11.): der globale Entwickler-Schalter
   * `DEBUG_FORCE_PLAYER_VISIBILITY` (zeigt sonst ueberall exakt) gilt dann nicht.
   */
  ignoreDebug?: boolean;
}): AttributeVisibility {
  if (DEBUG_FORCE_PLAYER_VISIBILITY && !input.ignoreDebug) {
    return "exact";
  }
  if (input.manageableTeamIds && input.manageableTeamIds.length > 0) {
    if (
      input.isOnViewingTeamRoster &&
      input.teamId &&
      input.manageableTeamIds.includes(input.teamId)
    ) {
      return "exact";
    }
    return "scouted";
  }
  if (input.teamHumanControlled === false) {
    return "scouted";
  }
  return "exact";
}

export function buildDisciplineValuesFromPlayer(
  player: Pick<Player, "id" | "disciplineRatings" | "previousDisciplineRatings" | "lastSeasonDisciplineValues" | "currentDisciplineValues" | "disciplineDelta"> | null,
  disciplines: Array<{ id: string; name: string; category: DisciplineCategory; playerCount?: number | null }>,
  performance?: {
    seasonId: string | null;
    disciplineBreakdown: Array<{
      disciplineId: string;
      appearances: number;
      totalContribution: number | null;
    }>;
  } | null,
  latestArchivedPerformance?: {
    seasonId: string | null;
    disciplineBreakdown?: Array<{
      disciplineId: string;
      appearances?: number | null;
      totalContribution?: number | null;
    }>;
  } | null,
  gameState?: GameState | null,
  globalRankMaps?: DisciplineGlobalRankMaps | null,
  disciplineRankOverride?: PlayerDisciplineRankOverride | null,
) {
  if (!player) {
    return [];
  }
  const seasonByDisciplineId = new Map((performance?.disciplineBreakdown ?? []).map((entry) => [entry.disciplineId, entry] as const));
  const lastSeasonByDisciplineId = new Map((latestArchivedPerformance?.disciplineBreakdown ?? []).map((entry) => [entry.disciplineId, entry] as const));
  const allTimeByDisciplineId = new Map<string, { points: number; appearances: number }>();
  const currentDetailsByDisciplineId = new Map<string, PlayerDisciplineDrawerDetail>();
  const currentSeasonId = gameState?.season.id ?? performance?.seasonId ?? null;
  const seasonPlayerCountByDisciplineId = gameState ? buildSeasonDisciplinePlayerCountMap(gameState) : null;
  const seasonPlayerCountDisplayById = gameState ? buildSeasonDisciplinePlayerCountDisplayMap(gameState) : null;

  if (gameState) {
    for (const snapshot of schnappschuesseFuerSpielerhistorie(gameState)) {
      const snapshotPerformance = resolveSnapshotPlayerPerformanceRow(gameState, snapshot, player.id);
      if (!snapshotPerformance) continue;
      for (const entry of snapshotPerformance.disciplineBreakdown ?? []) {
        const current = allTimeByDisciplineId.get(entry.disciplineId) ?? { points: 0, appearances: 0 };
        current.points += entry.totalContribution ?? 0;
        current.appearances += entry.appearances ?? 0;
        allTimeByDisciplineId.set(entry.disciplineId, current);
      }
    }
  }

  const hasCurrentSeasonSnapshot = Boolean(
    currentSeasonId &&
      (gameState?.seasonState.seasonSnapshots ?? []).some((snapshot) => snapshot.seasonId === currentSeasonId),
  );
  if (!hasCurrentSeasonSnapshot) {
    for (const entry of performance?.disciplineBreakdown ?? []) {
      const current = allTimeByDisciplineId.get(entry.disciplineId) ?? { points: 0, appearances: 0 };
      current.points += entry.totalContribution ?? 0;
      current.appearances += entry.appearances ?? 0;
      allTimeByDisciplineId.set(entry.disciplineId, current);
    }
  }

  // DISZIPLIN-LAUFBAHN (Q2): einmal je Spieler vorberechnet, nicht je Disziplin — dieselbe
  // Rechenstelle wie `buildPlayerSeasonAwards`, s. `lib/season/player-discipline-laufbahn.ts`.
  const laufbahnByDisciplineId = gameState ? buildPlayerDisciplineLaufbahn(gameState, player.id) : null;

  const resultById = new Map((gameState?.seasonState.matchdayResults ?? []).map((entry) => [entry.id, entry] as const));
  for (const entry of gameState?.seasonState.playerDisciplinePerformances ?? []) {
    if (entry.playerId !== player.id) continue;
    const result = resultById.get(entry.matchdayResultId) ?? null;
    if (currentSeasonId && (result?.seasonId ?? currentSeasonId) !== currentSeasonId) continue;
    const detail = currentDetailsByDisciplineId.get(entry.disciplineId) ?? { mutatorPps: 0, slotLabels: [] };
    detail.mutatorPps += entry.mutatorPpsBonus ?? 0;
    const matchdayLabel = result?.matchdayId?.match(/matchday-(\d+)/i)?.[1] ?? result?.matchdayId ?? "MD";
    const slotLabel = `MD ${matchdayLabel} ${entry.disciplineSide.toUpperCase()}-${entry.slotIndex + 1}`;
    if (!detail.slotLabels.includes(slotLabel)) {
      detail.slotLabels.push(slotLabel);
    }
    currentDetailsByDisciplineId.set(entry.disciplineId, detail);
  }

  return disciplines
    .map((discipline) => {
      const seasonRow = seasonByDisciplineId.get(discipline.id) ?? null;
      const lastSeasonRow = lastSeasonByDisciplineId.get(discipline.id) ?? null;
      const allTimeRow = allTimeByDisciplineId.get(discipline.id) ?? null;
      const currentDetail = currentDetailsByDisciplineId.get(discipline.id) ?? null;
      const previous =
        player.lastSeasonDisciplineValues?.[discipline.id] != null && player.currentDisciplineValues?.[discipline.id] != null
          ? player.lastSeasonDisciplineValues[discipline.id]
          : player.previousDisciplineRatings?.[discipline.id] != null && player.disciplineRatings?.[discipline.id] != null
            ? player.previousDisciplineRatings[discipline.id]
            : null;
      const current =
        player.currentDisciplineValues?.[discipline.id] != null
          ? player.currentDisciplineValues[discipline.id]
          : player.disciplineRatings?.[discipline.id] ?? null;
      const delta =
        player.disciplineDelta?.[discipline.id] != null
          ? player.disciplineDelta[discipline.id]
          : previous != null && current != null
            ? roundValue(current - previous, 0)
            : null;
      return {
        id: discipline.id,
        label: discipline.name,
        category: discipline.category,
        value: current,
        seasonPoints: seasonRow?.totalContribution ?? null,
        // Override (server, voller Save) hat Vorrang und ist bei Vorhandensein
        // ABSCHLIESSEND — auch eine fehlende Disziplin-ID heißt "kein Rang"
        // und fällt NICHT auf den lokal berechneten (auf dem kompakten Payload
        // ggf. falschen, siehe docs/CLIENT_PAYLOAD_LEERE_ABLEITUNGEN.md) Wert
        // zurück. Ohne Override (Override-Fetch lief noch/fehlgeschlagen) bleibt
        // die bisherige lokale Berechnung als Fallback.
        seasonPointsRank: disciplineRankOverride
          ? disciplineRankOverride.seasonPointsRankByDisciplineId[discipline.id] ?? null
          : globalRankMaps?.seasonPointsRanksByDiscipline.get(discipline.id)?.get(player.id) ?? null,
        seasonAppearances: seasonRow?.appearances ?? null,
        /**
         * Der Server-Override hat Vorrang und ist bei Vorhandensein ABSCHLIESSEND — dieselbe Regel
         * wie bei den Raengen darunter, und aus demselben Grund: im Browser fehlt die
         * Disziplin-Aufschluesselung der Archiv-Saisons ganz (siehe `PlayerDisciplineRankOverride`).
         * Die lokal gerechnete Summe waere dort nicht „ungenau", sondern leer, und ein Rueckfall
         * darauf machte aus einer bekannten Zahl wieder ein stummes Feld.
         */
        allTimePoints: disciplineRankOverride
          ? disciplineRankOverride.allTimePointsByDisciplineId[discipline.id] ?? null
          : allTimeRow
            ? roundValue(allTimeRow.points, 1)
            : null,
        allTimePointsRank: disciplineRankOverride
          ? disciplineRankOverride.allTimePointsRankByDisciplineId[discipline.id] ?? null
          : globalRankMaps?.allTimePointsRanksByDiscipline.get(discipline.id)?.get(player.id) ?? null,
        allTimeAppearances: disciplineRankOverride
          ? disciplineRankOverride.allTimeAppearancesByDisciplineId[discipline.id] ?? null
          : allTimeRow?.appearances ?? null,
        currentSeasonMutatorPps: currentDetail ? roundValue(currentDetail.mutatorPps, 1) : null,
        slotLabels: currentDetail?.slotLabels.slice(0, 8) ?? [],
        lastSeasonPoints: lastSeasonRow?.totalContribution ?? null,
        lastSeasonAppearances: lastSeasonRow?.appearances ?? null,
        lastSeasonId: latestArchivedPerformance?.seasonId ?? null,
        upgradeDelta: delta,
        lastSeasonDisciplineValues: previous,
        currentDisciplineValues: current,
        disciplineDelta: delta,
        playerCount: seasonPlayerCountByDisciplineId?.get(discipline.id) ?? discipline.playerCount ?? null,
        playerCountLabel: resolveDisciplinePlayerCountLabel(
          seasonPlayerCountDisplayById?.get(discipline.id),
          discipline.playerCount ?? null,
        ),
        laufbahn: laufbahnByDisciplineId?.get(discipline.id) ?? null,
      };
    })
    .sort((left, right) => (right.value ?? Number.NEGATIVE_INFINITY) - (left.value ?? Number.NEGATIVE_INFINITY))
    .map((entry, index) => ({
      ...entry,
      rank: globalRankMaps?.valueRanksByDiscipline.get(entry.id)?.get(player.id) ?? (entry.value == null ? null : index + 1),
    }));
}

export function resolveRosterEntry(
  rosters: RosterEntry[],
  playerId: string,
  activePlayerId?: string | null,
) {
  if (activePlayerId) {
    return rosters.find((entry) => entry.id === activePlayerId) ?? null;
  }

  return rosters.find((entry) => entry.playerId === playerId) ?? null;
}

export function resolveTeam(
  teams: Team[],
  rosterEntry: Pick<RosterEntry, "teamId"> | null,
) {
  if (!rosterEntry) {
    return null;
  }

  return teams.find((team) => team.teamId === rosterEntry.teamId) ?? null;
}

export function findLatestArchivedPlayerPerformance(gameState: GameState, playerId: string) {
  return schnappschuesseFuerSpielerhistorie(gameState)
    .filter((snapshot) => snapshot.seasonId !== gameState.season.id)
    .sort((left, right) => right.seasonId.localeCompare(left.seasonId, "de"))
    .map((snapshot) => {
      const row = resolveSnapshotPlayerPerformanceRow(gameState, snapshot, playerId);
      return row ? { ...row, seasonId: snapshot.seasonId } : null;
    })
    .find((entry): entry is NonNullable<typeof entry> => Boolean(entry)) ?? null;
}
