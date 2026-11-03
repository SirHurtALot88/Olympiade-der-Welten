/**
 * EINGEFRORENER KI-ENTWURF MIT GESPERRTEM SPIELER: GEZIELT NACHBESETZEN, NICHT DURCHWINKEN.
 *
 * Seit dem Saisontest-Fund 02.11. (Commit cbd52cc3b) bleibt ein abgegebener KI-Entwurf
 * eingefroren, sobald der Spieltag laeuft (eine Disziplin-Seite gebucht): die gebuchte Seite und
 * der Arena-Vorlauf der offenen Seite muessen zur Aufstellung passen. Das Einfrieren fragt aber
 * nicht, ob in der noch OFFENEN Seite ein Spieler steht, der gar nicht antreten darf — und die
 * Score-Engine (`scoreLegacyLineupDisciplineSide`) wertet jeden Entwurfs-Eintrag, sie kennt keine
 * Sperre. Ein gesperrter Spieler im eingefrorenen Entwurf wuerde also gewertet.
 *
 * Gemessen am Battle-Mode-Testlauf (Saison 1, `new-game-1793629096917-sjsiu9`): 35 Plaetze fuer
 * gesperrte Spieler in KI-Aufstellungen (Spieltage 12, 17, 19), gewertet u. a. Grok-Na (Z-H),
 * Moonga und Brunhilde (V-V). Die Hauptursache — der D1-Teil-Commit gab den Gesperrten schon fuer
 * D2 frei — ist in `applyFatigueAndInjuryAfterMatchday` behoben. Diese Datei ist das Netz darunter:
 * welcher Weg auch immer einen Gesperrten in einen eingefrorenen Entwurf bringt, gewertet wird er
 * nicht.
 *
 * WAS PASSIERT:
 * - Nur die OFFENEN Seiten werden angefasst. Die gebuchte Seite bleibt Wort fuer Wort stehen —
 *   dort traegt ein in D1 Verletzter weiter seinen Namen (#505, die gebuchte D1 rechnet mit ihm,
 *   und die Fatigue-Buchhaltung liest die Eintraege).
 * - Ein gesperrter Eintrag wird durch den besten freien Kaderspieler fuer DIESE Disziplin ersetzt
 *   (Disziplinwert, derselbe, den die Score-Engine liest): einsatzfaehig und an diesem Spieltag noch
 *   nirgends aufgestellt. Slot und Kapitaensbinde wandern mit — die Kapitaenszaehlung je Seite
 *   bleibt damit unveraendert.
 * - Gibt der Kader niemanden mehr her, faellt der Eintrag ersatzlos weg. Die Disziplin laeuft dann
 *   kurz; das regelt die bestehende Kurz-Aufstellungs-Regel (`legacy-matchday-partial-lineup-rule`).
 * - Menschliche Teams (`manual`) bleiben unberuehrt: eine abgegebene Aufstellung eines Menschen
 *   aendert sich nicht.
 *
 * Bewusst KEIN Neuaufstellen der ganzen Aufstellung: genau das hat der KI-Batch im D2-Commit
 * frueher getan und damit die gebuchte D1-Seite samt Formkarten umgeschrieben.
 *
 * Preis: Greift die Reparatur, aendert sich die Signatur der offenen Seite, und ihr Arena-Vorlauf
 * passt nicht mehr (Buchung ueber die PPS-Bruecke statt die Arena). Das ist gewollt — lieber ohne
 * Arena-Vorlauf richtig gewertet als mit einem gesperrten Spieler.
 */
import type { GameState, LineupDraft, LineupDraftEntry } from "@/lib/data/olyDataTypes";
import { getPlayerAvailabilityView } from "@/lib/fatigue/fatigue-injury-service";

export type FrozenDraftBlockedRepair = {
  teamId: string;
  disciplineId: string;
  disciplineSide: "d1" | "d2";
  slotIndex: number;
  blockedPlayerId: string;
  /** `null`: kein freier Ersatz im Kader, der Eintrag ist ersatzlos entfallen. */
  replacementPlayerId: string | null;
};

/** Welche Disziplin-Seiten dieses Spieltags sind schon gebucht? */
export function listBookedMatchdaySides(
  gameState: GameState,
  scope: { saveId: string; seasonId: string; matchdayId: string },
): Set<"d1" | "d2"> {
  const resultIds = new Set(
    (gameState.seasonState.matchdayResults ?? [])
      .filter((entry) => entry.saveId === scope.saveId && entry.seasonId === scope.seasonId && entry.matchdayId === scope.matchdayId)
      .map((entry) => entry.id),
  );
  if (resultIds.size === 0) return new Set();
  return new Set(
    (gameState.seasonState.disciplineResults ?? [])
      .filter((result) => resultIds.has(result.matchdayResultId))
      .map((result) => result.disciplineSide),
  );
}

function repairDraft(
  gameState: GameState,
  draft: LineupDraft,
  bookedSides: Set<"d1" | "d2">,
): { entries: LineupDraftEntry[]; repairs: FrozenDraftBlockedRepair[] } | null {
  const isBlocked = (playerId: string) =>
    getPlayerAvailabilityView(gameState, playerId, draft.teamId, draft.matchdayId).isUnavailable;

  const blockedEntries = draft.entries.filter(
    (entry) => !bookedSides.has(entry.disciplineSide) && isBlocked(entry.playerId),
  );
  if (blockedEntries.length === 0) return null;

  const usedPlayerIds = new Set(draft.entries.map((entry) => entry.playerId));
  const playersById = new Map(gameState.players.map((player) => [player.id, player] as const));
  const freeRoster = gameState.rosters.filter(
    (roster) => roster.teamId === draft.teamId && !usedPlayerIds.has(roster.playerId) && playersById.has(roster.playerId),
  );
  const repairs: FrozenDraftBlockedRepair[] = [];
  const replacementByEntry = new Map<LineupDraftEntry, LineupDraftEntry | null>();

  for (const entry of blockedEntries) {
    let best: { rosterId: string; playerId: string; score: number } | null = null;
    for (const roster of freeRoster) {
      if (usedPlayerIds.has(roster.playerId) || isBlocked(roster.playerId)) continue;
      const score = playersById.get(roster.playerId)?.disciplineRatings?.[entry.disciplineId] ?? 0;
      if (
        best == null ||
        score > best.score ||
        (score === best.score && roster.playerId.localeCompare(best.playerId) < 0)
      ) {
        best = { rosterId: roster.id, playerId: roster.playerId, score };
      }
    }
    if (best) usedPlayerIds.add(best.playerId);
    replacementByEntry.set(
      entry,
      best
        ? { ...entry, playerId: best.playerId, activePlayerId: best.rosterId }
        : null,
    );
    repairs.push({
      teamId: draft.teamId,
      disciplineId: entry.disciplineId,
      disciplineSide: entry.disciplineSide,
      slotIndex: entry.slotIndex,
      blockedPlayerId: entry.playerId,
      replacementPlayerId: best?.playerId ?? null,
    });
  }

  const entries = draft.entries.flatMap((entry) => {
    if (!replacementByEntry.has(entry)) return [entry];
    const replacement = replacementByEntry.get(entry);
    return replacement ? [replacement] : [];
  });
  return { entries, repairs };
}

/**
 * Ersetzt in den Entwuerfen eines LAUFENDEN Spieltags gesperrte Spieler auf den offenen Seiten.
 * Laeuft der Spieltag noch nicht (keine Seite gebucht), passiert nichts — dann rechnet der KI-Batch
 * veraltete Entwuerfe ohnehin neu (`findStaleAiLineupEntries`, `player_unavailable`).
 *
 * Unveraenderter `gameState` (dieselbe Referenz), wenn nichts zu tun ist.
 */
export function repairFrozenAiDraftsWithBlockedPlayers(input: {
  gameState: GameState;
  scope: { saveId: string; seasonId: string; matchdayId: string };
  /** Teams, deren Entwurf angefasst werden darf (nicht `manual`). */
  repairableTeamIds: ReadonlySet<string>;
  now?: string;
}): { gameState: GameState; repairs: FrozenDraftBlockedRepair[] } {
  const { gameState, scope } = input;
  const bookedSides = listBookedMatchdaySides(gameState, scope);
  if (bookedSides.size === 0 || (bookedSides.has("d1") && bookedSides.has("d2"))) {
    return { gameState, repairs: [] };
  }

  const repairs: FrozenDraftBlockedRepair[] = [];
  let changed = false;
  const now = input.now ?? new Date().toISOString();
  const nextDrafts = (gameState.seasonState.lineupDrafts ?? []).map((draft) => {
    if (
      draft.seasonId !== scope.seasonId ||
      draft.matchdayId !== scope.matchdayId ||
      (draft.saveId != null && draft.saveId !== scope.saveId) ||
      !input.repairableTeamIds.has(draft.teamId)
    ) {
      return draft;
    }
    const repaired = repairDraft(gameState, draft, bookedSides);
    if (!repaired) return draft;
    changed = true;
    repairs.push(...repaired.repairs);
    return { ...draft, entries: repaired.entries, updatedAt: now };
  });

  if (!changed) return { gameState, repairs };
  return {
    gameState: { ...gameState, seasonState: { ...gameState.seasonState, lineupDrafts: nextDrafts } },
    repairs,
  };
}
