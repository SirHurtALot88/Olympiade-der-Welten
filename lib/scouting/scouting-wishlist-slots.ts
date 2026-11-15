import type { GameState, TransferWishlistEntry } from "@/lib/data/olyDataTypes";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { isPlayerFullyScouted } from "@/lib/scouting/scouting-reveal-state";

/**
 * WIE VIELE SPIELER OHNE JEDES SCOUTING-BUERO GLEICHZEITIG AKTIV GESCOUTET WERDEN.
 *
 * Seit dem Scouting-Ausbau (Chris, 10.11.: „dass dort endlos viele Spieler für ein team gespeichert
 * werden dürfen, es wird aber weiterhin dann nur die obersten X der liste gescoutet bis die
 * vollständig gescoutet sind") begrenzt diese Zahl NICHT mehr die Wunschliste selbst — die ist
 * unbegrenzt —, sondern nur noch die aktive Scouting-Queue: die obersten X noch nicht fertigen
 * Einträge. Siehe `getScoutingWishlistQueue` und docs/design/scouting-ausbau-konzept-11-11.md.
 *
 * Historie der Zahl (damals noch Listen-Grenze):
 *
 * Chris: „erweiter die wunschliste mal um 2 slots". Von 4 auf 6.
 *
 * Warum das mehr ist als eine Bequemlichkeit: vier Plaetze reichen nicht, um eine Position
 * ueberhaupt zu VERGLEICHEN. Wer einen Ersatz fuer eine Achse sucht, hat schnell drei Kandidaten
 * im Blick und will daneben noch ein, zwei Namen aus einem anderen Preisband — bei vier Plaetzen
 * loescht man dafuer jedes Mal einen, den man eigentlich behalten wollte.
 */
export const SCOUTING_WISHLIST_BASE_SLOTS = 6;

/**
 * WIE VIELE PLAETZE JEDE STUFE DES SCOUTING-BUEROS DAZUGIBT.
 *
 * Chris: „+ mehr slots mit den gebäudeupgrades pro stufe". Von 3 auf 4.
 *
 * Die Zahl ist an den Baukosten gemessen, nicht geraten: das Buero kostet kumuliert 6 / 18 / 38 /
 * 70 / 120 C. Mit 4 Plaetzen je Stufe kostet der erste Ausbau 6 C fuer vier Plaetze (1,5 C je
 * Platz), der letzte 50 C fuer vier (12,5 C je Platz) — die Plaetze werden also mit jeder Stufe
 * teurer, und das ist beabsichtigt: die ersten Ausbauten sollen sich klar lohnen, der Vollausbau
 * eine Entscheidung sein.
 *
 * Endstand: 6 Plaetze ohne Buero, 26 bei Stufe 5 (vorher 4 und 19).
 */
export const SCOUTING_WISHLIST_SLOTS_PER_LEVEL = 4;
export const SCOUTING_DRAFT_WISHLIST_SLOT_LIMIT = 999;

/**
 * Aktive Scouting-Plätze während der Draft-Phase (bis 11.11. die Obergrenze der Wunschliste selbst)
 * — Season 1, bis der Einstiegs-Flow abgeschlossen ist. Bug 2026-07-31: Chris meldete eine
 * zu kleine Grenze im Draft — tatsächlich war sie `null` (unbegrenzt), aber
 * `isTeamSetupDraftWishlistPhase` erkannte den Draft in seinem Spielstand gar
 * nicht mehr als solchen (siehe dort), sodass schon die reguläre, sehr
 * niedrige Scouting-Grenze griff. Getrennt von `SCOUTING_DRAFT_WISHLIST_SLOT_LIMIT`
 * oben, das die Kapazität der manuellen Scouting-Pipeline (nicht die
 * Wunschliste) im Draft begrenzt.
 */
export const DRAFT_TRANSFER_WISHLIST_SLOT_LIMIT = 15;

export type ScoutingWishlistSlotCheck = {
  ok: boolean;
  /** Aktive Scouting-Plätze (nicht mehr die Listen-Grenze, die Liste ist unbegrenzt). */
  limit: number | null;
  used: number;
  draftSuspended: boolean;
  /** Aktive Plätze sind alle belegt — ein neuer Eintrag wartet, bis einer frei wird. */
  waitsForSlot?: boolean;
  reason?: "wishlist_full";
};

export function getScoutingWishlistSlotsForLevel(level: number) {
  return SCOUTING_WISHLIST_BASE_SLOTS + Math.max(0, level) * SCOUTING_WISHLIST_SLOTS_PER_LEVEL;
}

/**
 * Scouting focus queue order. Lower rank = scouted first. Legacy entries
 * without an explicit `priorityRank` fall back to their `createdAt` epoch so
 * existing FIFO ordering is preserved until the user reorders the queue.
 */
export function getWishlistEntryPriorityRank(entry: TransferWishlistEntry) {
  if (typeof entry.priorityRank === "number" && Number.isFinite(entry.priorityRank)) {
    return entry.priorityRank;
  }
  const parsed = Date.parse(entry.createdAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortByPriorityRank(entries: TransferWishlistEntry[]) {
  return [...entries].sort((left, right) => getWishlistEntryPriorityRank(left) - getWishlistEntryPriorityRank(right));
}

function getSetupRosterTarget(gameState: GameState, teamId: string) {
  const identity = gameState.teamIdentities.find((entry) => entry.teamId === teamId);
  const team = gameState.teams.find((entry) => entry.teamId === teamId);
  return Math.max(1, identity?.playerMin ?? identity?.playerOpt ?? team?.rosterLimit ?? 12);
}

export function isTeamSetupDraftWishlistPhase(gameState: GameState, teamId: string) {
  if (gameState.season.id !== "season-1") return false;
  if (gameState.gamePhase && gameState.gamePhase !== "preseason_management") return false;
  const flow = gameState.seasonState.newGameFlow;
  if (flow) {
    // `newGameFlow.active` wird erst false, sobald ALLE Einstiegsschritte
    // abgeschlossen oder übersprungen sind (siehe `updateNewGameFlowStepStatus`
    // in use-foundation-shell-router-body-scope.tsx) — das ist das verlässliche
    // Draft-Ende. Der Kaderstand allein reicht nicht: `fill_roster` gilt schon
    // ab Mindestkader (`playerMin`) als erledigt, obwohl z. B. Sponsor-Wahl
    // oder Aufstellung noch offen sind und der Spieler sich weiter im Draft
    // sieht. Genau das hat Chris' zu kleine Wunschliste ausgelöst (Bug
    // 2026-07-31): Kader 9/8 (schon über `playerMin`) ließ die alte,
    // rosterbasierte Prüfung die Draft-Phase vorzeitig verlassen, obwohl der
    // Einstiegs-Flow noch aktiv war.
    return flow.active;
  }
  // Fallback für Spielstände ohne `newGameFlow` (z. B. ältere Saves): Draft
  // gilt, solange der Kader das Soll noch nicht erreicht hat.
  const rosterCount = gameState.rosters.filter((entry) => entry.teamId === teamId).length;
  return rosterCount < getSetupRosterTarget(gameState, teamId);
}

export function getScoutingFacilityLevel(gameState: GameState, teamId: string) {
  return getFacilityLevel(getTeamFacilityState(gameState, teamId), "scouting_office");
}

/**
 * Wie viele Wunschlisten-Einträge gleichzeitig AKTIV gescoutet werden (die „obersten X").
 * Der Name stammt aus der Zeit, als das zugleich die Listen-Grenze war; seit 11.11. ist die
 * Liste unbegrenzt. `getActiveScoutingSlotLimit` ist der sprechende Alias.
 */
export function getScoutingWishlistSlotLimit(gameState: GameState, teamId: string): number {
  if (isTeamSetupDraftWishlistPhase(gameState, teamId)) {
    return DRAFT_TRANSFER_WISHLIST_SLOT_LIMIT;
  }
  return getScoutingWishlistSlotsForLevel(getScoutingFacilityLevel(gameState, teamId));
}

export function getScoutingPipelineSlotLimit(gameState: GameState, teamId: string) {
  if (isTeamSetupDraftWishlistPhase(gameState, teamId)) {
    return SCOUTING_DRAFT_WISHLIST_SLOT_LIMIT;
  }
  return getScoutingWishlistSlotsForLevel(getScoutingFacilityLevel(gameState, teamId));
}

export function getTeamTransferWishlistEntries(gameState: GameState, teamId: string) {
  return (gameState.seasonState.transferWishlist ?? []).filter((entry) => entry.teamId === teamId);
}

export const getActiveScoutingSlotLimit = getScoutingWishlistSlotLimit;

export type ScoutingWishlistQueueState = "active" | "completed" | "waiting";

export type ScoutingWishlistQueue = {
  /** Alle Einträge des Teams in Prioritätsreihenfolge (Platz 1 zuerst). */
  ordered: TransferWishlistEntry[];
  /** Die obersten X noch nicht voll gescouteten Einträge — nur die bekommen Scouting-Fortschritt. */
  active: TransferWishlistEntry[];
  /** Voll gescoutete Einträge — belegen keinen Slot mehr, bleiben aber auf der Liste. */
  completed: TransferWishlistEntry[];
  /** Noch nicht fertig, aber unterhalb der aktiven Plätze — warten auf einen freien Slot. */
  waiting: TransferWishlistEntry[];
  capacity: number;
  stateByPlayerId: Map<string, ScoutingWishlistQueueState>;
};

/**
 * Reine Aufteilung einer nach Priorität sortierten Liste in aktiv / fertig / wartend.
 * Fertige Einträge überspringt die Zählung — ihr Platz geht an den nächsten wartenden.
 */
export function splitScoutingWishlistQueue(
  ordered: TransferWishlistEntry[],
  capacity: number,
  isComplete: (playerId: string) => boolean,
): ScoutingWishlistQueue {
  const active: TransferWishlistEntry[] = [];
  const completed: TransferWishlistEntry[] = [];
  const waiting: TransferWishlistEntry[] = [];
  const stateByPlayerId = new Map<string, ScoutingWishlistQueueState>();
  const safeCapacity = Math.max(0, capacity);
  for (const entry of ordered) {
    if (isComplete(entry.playerId)) {
      completed.push(entry);
      stateByPlayerId.set(entry.playerId, "completed");
    } else if (active.length < safeCapacity) {
      active.push(entry);
      stateByPlayerId.set(entry.playerId, "active");
    } else {
      waiting.push(entry);
      stateByPlayerId.set(entry.playerId, "waiting");
    }
  }
  return { ordered, active, completed, waiting, capacity: safeCapacity, stateByPlayerId };
}

/**
 * Die Scouting-Queue eines Teams: unbegrenzte Wunschliste, davon die obersten X nicht fertigen
 * Einträge aktiv (X = `getScoutingWishlistSlotLimit`).
 */
export function getScoutingWishlistQueue(gameState: GameState, teamId: string): ScoutingWishlistQueue {
  return splitScoutingWishlistQueue(
    sortByPriorityRank(getTeamTransferWishlistEntries(gameState, teamId)),
    getScoutingWishlistSlotLimit(gameState, teamId),
    (playerId) => isPlayerFullyScouted(gameState, teamId, playerId),
  );
}

/**
 * Die AKTIV gescouteten Wunschlisten-Einträge (die obersten X noch nicht fertigen).
 *
 * Bis 11.11. schnitt das die obersten X ab, egal ob fertig — ein voll gescouteter Spieler auf
 * Platz 1 hielt seinen Slot dann für immer. Jetzt gibt ein fertiger Eintrag seinen Platz frei.
 */
export function getActiveScoutingWishlistEntries(gameState: GameState, teamId: string) {
  return getScoutingWishlistQueue(gameState, teamId).active;
}

/**
 * Assigns a `priorityRank` to a new wishlist entry so it lands at the end of
 * the team's scouting focus queue (lowest priority) by default.
 */
export function getNextWishlistPriorityRank(gameState: GameState, teamId: string) {
  const entries = getTeamTransferWishlistEntries(gameState, teamId);
  if (entries.length === 0) {
    return 0;
  }
  const maxRank = Math.max(...entries.map(getWishlistEntryPriorityRank));
  return maxRank + 1;
}

/**
 * Reorders a team's scouting focus queue by moving `playerId` to
 * `targetIndex` among the team's own wishlist entries (priority order), then
 * re-sequences `priorityRank` for that team's entries as 0..N-1. Entries
 * belonging to other teams are returned unchanged.
 */
export function reorderTeamTransferWishlist(
  allEntries: TransferWishlistEntry[],
  teamId: string,
  playerId: string,
  targetIndex: number,
): TransferWishlistEntry[] {
  const teamEntries = sortByPriorityRank(allEntries.filter((entry) => entry.teamId === teamId));
  const otherEntries = allEntries.filter((entry) => entry.teamId !== teamId);
  const movingIndex = teamEntries.findIndex((entry) => entry.playerId === playerId);
  if (movingIndex === -1) {
    return allEntries;
  }
  const [moving] = teamEntries.splice(movingIndex, 1);
  const clampedIndex = Math.max(0, Math.min(targetIndex, teamEntries.length));
  teamEntries.splice(clampedIndex, 0, moving);
  const reranked = teamEntries.map((entry, index) => ({ ...entry, priorityRank: index }));
  return [...otherEntries, ...reranked];
}

/**
 * Darf der Spieler auf die Wunschliste? Seit 11.11. immer — die Liste ist unbegrenzt
 * (Chris: „endlos viele Spieler"). Die Prüfung bleibt als Schnittstelle bestehen, weil das UI aus
 * ihr ablesen will, ob ein neuer Eintrag sofort gescoutet wird oder auf einen Slot wartet
 * (`waitsForSlot`).
 */
export function canAddPlayerToTransferWishlist(
  gameState: GameState,
  teamId: string,
  playerId?: string | null,
): ScoutingWishlistSlotCheck {
  const entries = getTeamTransferWishlistEntries(gameState, teamId);
  const used = entries.length;
  const draftSuspended = isTeamSetupDraftWishlistPhase(gameState, teamId);
  const limit = getScoutingWishlistSlotLimit(gameState, teamId);
  if (playerId && entries.some((entry) => entry.playerId === playerId)) {
    return { ok: true, limit, used, draftSuspended };
  }
  const activeCount = getScoutingWishlistQueue(gameState, teamId).active.length;
  return { ok: true, limit, used, draftSuspended, waitsForSlot: activeCount >= limit };
}

export function getScoutingWishlistSlotMessage(check: ScoutingWishlistSlotCheck) {
  if (check.reason !== "wishlist_full") {
    return null;
  }
  if (check.draftSuspended) {
    return `Scouting-Slots im Draft belegt (${check.used}/${check.limit}).`;
  }
  return `Scouting-Slots belegt (${check.used}/${check.limit}). Erst eine Beobachtung entfernen oder Scouting Office upgraden.`;
}

export function countManualScoutingWatchSlots(gameState: GameState, teamId: string) {
  return (gameState.seasonState.scoutingWatchlist ?? []).filter(
    (entry) =>
      entry.teamId === teamId &&
      entry.seasonId === gameState.season.id &&
      entry.source !== "transfer_wishlist_mirror",
  ).length;
}

export function canAddManualScoutingWatchEntry(gameState: GameState, teamId: string) {
  const draftSuspended = isTeamSetupDraftWishlistPhase(gameState, teamId);
  if (draftSuspended) {
    return { ok: true, limit: null, used: getTeamTransferWishlistEntries(gameState, teamId).length, draftSuspended: true };
  }
  const limit = getScoutingPipelineSlotLimit(gameState, teamId);
  // Nur die AKTIVEN Wunschlisten-Plätze belegen die Pipeline — eine lange Merkliste darf manuelle
  // Beobachtungen nicht aussperren (seit 11.11. ist die Wunschliste unbegrenzt).
  const wishlistUsed = getScoutingWishlistQueue(gameState, teamId).active.length;
  const manualUsed = countManualScoutingWatchSlots(gameState, teamId);
  const used = wishlistUsed + manualUsed;
  if (used >= limit) {
    return { ok: false, limit, used, draftSuspended: false, reason: "wishlist_full" as const };
  }
  return { ok: true, limit, used, draftSuspended: false };
}
