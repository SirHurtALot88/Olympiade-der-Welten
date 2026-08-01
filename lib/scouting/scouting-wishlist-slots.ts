import type { GameState, TransferWishlistEntry } from "@/lib/data/olyDataTypes";
import { getFacilityLevel, getTeamFacilityState } from "@/lib/facilities/facility-effects";

export const SCOUTING_WISHLIST_BASE_SLOTS = 4;
export const SCOUTING_WISHLIST_SLOTS_PER_LEVEL = 3;
export const SCOUTING_DRAFT_WISHLIST_SLOT_LIMIT = 999;

/**
 * Obergrenze der Wunschliste selbst während der Draft-Phase (Season 1, bis
 * der Einstiegs-Flow abgeschlossen ist). Bug 2026-07-31: Chris meldete eine
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
  limit: number | null;
  used: number;
  draftSuspended: boolean;
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

export function getActiveScoutingWishlistEntries(gameState: GameState, teamId: string) {
  const entries = sortByPriorityRank(getTeamTransferWishlistEntries(gameState, teamId));
  const limit = getScoutingWishlistSlotLimit(gameState, teamId);
  // Nur die Anzeige/Aktivierung wird gekappt (slice) — gespeicherte Einträge
  // oberhalb der Grenze bleiben im Save erhalten, siehe trimTransferWishlistToSlotLimit
  // für die einzige Stelle, die Einträge tatsächlich entfernt.
  return entries.slice(0, limit);
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

export function canAddPlayerToTransferWishlist(
  gameState: GameState,
  teamId: string,
  playerId?: string | null,
): ScoutingWishlistSlotCheck {
  const entries = getTeamTransferWishlistEntries(gameState, teamId);
  const used = entries.length;
  const draftSuspended = isTeamSetupDraftWishlistPhase(gameState, teamId);
  // Seit `getScoutingWishlistSlotLimit` im Draft die feste 15er-Grenze statt
  // `null` liefert, greift dieselbe Prüfung einheitlich in beiden Phasen —
  // `draftSuspended` bleibt nur noch als Info fürs UI erhalten (andere
  // Meldung, siehe getScoutingWishlistSlotMessage).
  const limit = getScoutingWishlistSlotLimit(gameState, teamId);
  if (playerId && entries.some((entry) => entry.playerId === playerId)) {
    return { ok: true, limit, used, draftSuspended };
  }
  if (used >= limit) {
    return { ok: false, limit, used, draftSuspended, reason: "wishlist_full" };
  }
  return { ok: true, limit, used, draftSuspended };
}

export function getScoutingWishlistSlotMessage(check: ScoutingWishlistSlotCheck) {
  if (check.reason !== "wishlist_full") {
    return null;
  }
  if (check.draftSuspended) {
    return `Wunschliste im Draft voll (${check.used}/${check.limit} Plätzen). Erst einen Spieler entfernen, um einen neuen zu setzen.`;
  }
  return `Wishlist voll (${check.used}/${check.limit} Scouting-Slots). Erst einen Spieler entfernen oder Scouting Office upgraden.`;
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
  const wishlistUsed = getTeamTransferWishlistEntries(gameState, teamId).length;
  const manualUsed = countManualScoutingWatchSlots(gameState, teamId);
  const used = wishlistUsed + manualUsed;
  if (used >= limit) {
    return { ok: false, limit, used, draftSuspended: false, reason: "wishlist_full" as const };
  }
  return { ok: true, limit, used, draftSuspended: false };
}

export function trimTransferWishlistToSlotLimit(entries: TransferWishlistEntry[], gameState: GameState, teamId: string) {
  const limit = getScoutingWishlistSlotLimit(gameState, teamId);
  const teamEntries = entries.filter((entry) => entry.teamId === teamId);
  const otherEntries = entries.filter((entry) => entry.teamId !== teamId);
  if (limit == null) {
    return entries;
  }
  const keptTeamEntries = sortByPriorityRank(teamEntries).slice(0, limit);
  return [...otherEntries, ...keptTeamEntries];
}
