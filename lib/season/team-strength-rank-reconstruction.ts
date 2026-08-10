/**
 * REKONSTRUKTION DES KADERSTANDS ZUM LETZTEN GEWERTETEN SPIELTAG — aus der Transferhistorie.
 *
 * GEMELDET VON CHRIS: Der Season-1-Schnappschuss trägt Teamstärke-Ränge vom Saisonabschluss statt
 * vom Saisonlauf („da ist N-N zb 32. … das kann nicht der stand während der saison gewesen sein").
 * Zwischen letztem Spieltag und Abschluss lagen im echten Spielstand vier Tage, 49 Verkäufe und
 * 54 Vertragsenden — der Schnappschuss hielt den Nach-Ausverkauf-Kader fest.
 *
 * Für NEUE Saisonabschlüsse ist das an der Quelle behoben (Erfassung bei der Spieltagswertung,
 * siehe teamStrengthRankCaptures). Für den BESTEHENDEN Spielstand muss der Stand rückwirkend
 * rekonstruiert werden: alle Kaderbewegungen nach dem letzten gewerteten Spieltag rückwärts
 * anwenden. Genau das leistet dieses Modul — als reine Funktionen, damit die Umkehrung testbar
 * ist (ein Vorzeichenfehler bliebe sonst unbemerkt).
 *
 * EINE QUELLE PRO GRÖSSE: die Ränge selbst rechnet weiterhin ausschließlich
 * `buildTeamDisciplineRankSnapshotRecords` (derselbe Live-Pfad wie Matrix und Erfassung); hier
 * entsteht nur der Spielzustand, auf dem diese Funktion läuft.
 */
import type { GameState, Player, TransferHistoryEntry } from "@/lib/data/olyDataTypes";

/** Kaderzugehörigkeit als Abbildung Spieler → Team; ein Spieler steht in höchstens einem Kader. */
export type RosterMembershipMap = Map<string, string>;

export type MovementReplayResult = {
  memberships: RosterMembershipMap;
  warnings: string[];
};

type Movement = Pick<TransferHistoryEntry, "id" | "playerId" | "fromTeamId" | "toTeamId" | "transferType" | "happenedAt">;

/**
 * Wendet eine Bewegung VORWÄRTS an: der Spieler verlässt `fromTeamId` (falls gesetzt) und tritt
 * `toTeamId` bei (falls gesetzt). `sell`/`contract_exit` haben `toTeamId: null` (raus aus der
 * Liga in den Pool), `buy` aus dem Pool hat `fromTeamId: null`.
 */
export function applyMovementForward(memberships: RosterMembershipMap, movement: Movement): MovementReplayResult {
  const next = new Map(memberships);
  const warnings: string[] = [];
  const current = next.get(movement.playerId) ?? null;

  if (movement.fromTeamId != null) {
    if (current !== movement.fromTeamId) {
      warnings.push(
        `bewegung_${movement.id}: Spieler ${movement.playerId} sollte ${movement.fromTeamId} verlassen, steht aber bei ${current ?? "(keinem Team)"}`,
      );
    }
    if (current === movement.fromTeamId) {
      next.delete(movement.playerId);
    }
  }
  if (movement.toTeamId != null) {
    const afterExit = next.get(movement.playerId) ?? null;
    if (afterExit != null) {
      warnings.push(
        `bewegung_${movement.id}: Spieler ${movement.playerId} tritt ${movement.toTeamId} bei, stand aber noch bei ${afterExit}`,
      );
    }
    next.set(movement.playerId, movement.toTeamId);
  }

  return { memberships: next, warnings };
}

/**
 * Die exakte UMKEHRUNG von `applyMovementForward`: der Spieler verlässt `toTeamId` wieder und
 * kehrt zu `fromTeamId` zurück. Ein `sell` rückwärts setzt den Spieler also zurück in den
 * verkaufenden Kader, ein `buy` rückwärts nimmt ihn wieder heraus.
 */
export function revertMovement(memberships: RosterMembershipMap, movement: Movement): MovementReplayResult {
  const next = new Map(memberships);
  const warnings: string[] = [];
  const current = next.get(movement.playerId) ?? null;

  if (movement.toTeamId != null) {
    if (current !== movement.toTeamId) {
      warnings.push(
        `bewegung_${movement.id}: Rückabwicklung erwartet Spieler ${movement.playerId} bei ${movement.toTeamId}, gefunden bei ${current ?? "(keinem Team)"}`,
      );
    }
    if (current === movement.toTeamId) {
      next.delete(movement.playerId);
    }
  }
  if (movement.fromTeamId != null) {
    const afterUndo = next.get(movement.playerId) ?? null;
    if (afterUndo != null) {
      warnings.push(
        `bewegung_${movement.id}: Rückabwicklung setzt Spieler ${movement.playerId} zurück zu ${movement.fromTeamId}, er steht aber noch bei ${afterUndo}`,
      );
    }
    next.set(movement.playerId, movement.fromTeamId);
  }

  return { memberships: next, warnings };
}

/**
 * Wickelt eine Menge Bewegungen rückwärts ab — jüngste zuerst, damit Ketten (verkauft und später
 * wieder gekauft) in der richtigen Reihenfolge aufgelöst werden.
 */
export function revertMovements(memberships: RosterMembershipMap, movements: Movement[]): MovementReplayResult {
  const ordered = [...movements].sort((left, right) => {
    if (left.happenedAt !== right.happenedAt) {
      return right.happenedAt.localeCompare(left.happenedAt);
    }
    return right.id.localeCompare(left.id);
  });

  let current = memberships;
  const warnings: string[] = [];
  for (const movement of ordered) {
    const step = revertMovement(current, movement);
    current = step.memberships;
    warnings.push(...step.warnings);
  }
  return { memberships: current, warnings };
}

/**
 * Disziplinwerte eines Spielers ZUM ENDE DER VORSAISON, also vor der Saisonwechsel-Entwicklung.
 *
 * Beim Übergang S1→S2 laufen bis zu zwei Entwicklungspfade über die Werte:
 *   - `season-end-xp-apply-service` (player_development): schreibt die neuen Werte und legt die
 *     alten in `previousDisciplineRatings` UND `lastSeasonDisciplineValues` ab,
 *   - `preseason-workflow-service` (organische Progression): schreibt die neuen Werte und legt die
 *     alten nur in `previousDisciplineRatings` ab — läuft er NACH dem XP-Apply, überschreibt er
 *     dessen `previousDisciplineRatings` mit einem Zwischenstand.
 *
 * Daraus folgt die Rangfolge: `lastSeasonDisciplineValues` (übersteht beide Pfade unverändert),
 * sonst `previousDisciplineRatings` (nur organischer Pfad gelaufen), sonst die aktuellen Werte
 * (keine Entwicklung gelaufen — z. B. nie geberuft oder Pool-Spieler). Die Regel gilt genau für
 * die Grenze „aktuelle Saison ↔ unmittelbare Vorsaison"; weiter zurück reicht keine der Quellen.
 */
export function resolvePreviousSeasonDisciplineRatings(player: Player): Record<string, number> {
  const last = player.lastSeasonDisciplineValues;
  if (last != null && Object.keys(last).length > 0) {
    return last;
  }
  const previous = player.previousDisciplineRatings;
  if (previous != null && Object.keys(previous).length > 0) {
    return previous;
  }
  return player.disciplineRatings ?? {};
}

export type SeasonEndReconstructionResult = {
  /** Spielzustand mit rekonstruierten Kadern und Vorsaison-Disziplinwerten — NUR zum Rechnen, nie zum Speichern. */
  gameState: GameState;
  movementsReverted: number;
  playersMissing: string[];
  /** Kaderspieler, deren Vorsaison-Werte über `lastSeasonDisciplineValues` belegt sind. */
  membersWithPreviousSeasonValues: number;
  membersTotal: number;
  warnings: string[];
};

export type SeasonEndReconstructionOptions = {
  /**
   * `previous_season` (Standard): Disziplinwerte der Kaderspieler auf den Vorsaison-Stand setzen —
   * das ist der Zustand „während der Saison", den auch die Erfassung bei der Spieltagswertung
   * festhält. `current`: Werte unverändert lassen — dient als MESSSONDE, um allein die
   * rekonstruierte Kaderzugehörigkeit gegen einen bekannten Bezugswert zu prüfen.
   */
  ratingsSource?: "previous_season" | "current";
};

/**
 * Baut den Spielzustand, wie er ZUM LETZTEN GEWERTETEN SPIELTAG der Vorsaison bestand:
 * Kaderzugehörigkeit durch Rückabwicklung aller Bewegungen nach `cutoffIso`, Disziplinwerte über
 * `resolvePreviousSeasonDisciplineRatings`. Teams und Disziplinen bleiben unverändert.
 */
export function buildSeasonEndReconstructedGameState(
  gameState: GameState,
  cutoffIso: string,
  options: SeasonEndReconstructionOptions = {},
): SeasonEndReconstructionResult {
  const ratingsSource = options.ratingsSource ?? "previous_season";
  const movements = gameState.transferHistory.filter((entry) => entry.happenedAt > cutoffIso);

  const currentMemberships: RosterMembershipMap = new Map(
    gameState.rosters.map((entry) => [entry.playerId, entry.teamId] as const),
  );
  const { memberships, warnings } = revertMovements(currentMemberships, movements);

  const playerById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const playersMissing: string[] = [];
  const reconstructedRosters: GameState["rosters"] = [];
  const rosterByPlayerId = new Map(gameState.rosters.map((entry) => [entry.playerId, entry] as const));

  for (const [playerId, teamId] of memberships) {
    if (!playerById.has(playerId)) {
      // Erfundene Zahlen gibt es nicht: ein Spieler ohne Datensatz kann nicht bewertet werden und
      // wird ausgewiesen statt still ersetzt.
      playersMissing.push(playerId);
      continue;
    }
    const template = rosterByPlayerId.get(playerId) ?? null;
    if (template && template.teamId === teamId) {
      reconstructedRosters.push(template);
      continue;
    }
    // Für die Rangrechnung zählen nur teamId+playerId (Top-6-Disziplinsummen); die übrigen
    // Pflichtfelder sind neutral belegt und dieser Zustand wird nie gespeichert.
    reconstructedRosters.push({
      ...(template ?? {}),
      id: `rekonstruiert__${teamId}__${playerId}`,
      teamId,
      playerId,
      contractLength: template?.contractLength ?? 1,
      salary: template?.salary ?? 0,
      upkeep: template?.upkeep ?? 0,
      purchasePrice: template?.purchasePrice ?? null,
      currentValue: template?.currentValue ?? null,
      roleTag: template?.roleTag ?? "bench",
      joinedSeasonId: template?.joinedSeasonId ?? "rekonstruiert",
    });
  }

  let membersWithPreviousSeasonValues = 0;
  for (const [playerId] of memberships) {
    const player = playerById.get(playerId);
    const last = player?.lastSeasonDisciplineValues;
    if (last != null && Object.keys(last).length > 0) {
      membersWithPreviousSeasonValues += 1;
    }
  }

  const reconstructedPlayers =
    ratingsSource === "current"
      ? gameState.players
      : gameState.players.map((player) => {
          if (!memberships.has(player.id)) {
            return player;
          }
          return {
            ...player,
            disciplineRatings: resolvePreviousSeasonDisciplineRatings(player),
          };
        });

  return {
    gameState: {
      ...gameState,
      rosters: reconstructedRosters,
      players: reconstructedPlayers,
    },
    movementsReverted: movements.length,
    playersMissing,
    membersWithPreviousSeasonValues,
    membersTotal: memberships.size - playersMissing.length,
    warnings,
  };
}
