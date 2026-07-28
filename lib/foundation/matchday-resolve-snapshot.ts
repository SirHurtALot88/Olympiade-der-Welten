import { createHash } from "node:crypto";

import type { GameState, MatchdayResolveSnapshotRecord } from "@/lib/data/olyDataTypes";
import { buildLegacyMatchdayReadiness } from "@/lib/lineups/legacy-matchday-readiness";
import { loadAllLocalLegacyLineupContexts } from "@/lib/lineups/legacy-lineup-local-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { requireLocalPersistedSave } from "@/lib/persistence/resolve-local-save";
import type { PersistenceService } from "@/lib/persistence/types";
import {
  buildLegacyMatchdayResolvePreviewPayload,
  type LegacyMatchdayResolvePreviewPayload,
} from "@/lib/foundation/legacy-matchday-resolve-preview-service";

export type MatchdayResolveScope = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
};

export type MatchdayResolveSnapshot = {
  record: MatchdayResolveSnapshotRecord;
  payload: LegacyMatchdayResolvePreviewPayload;
};

function buildSnapshotId(scope: MatchdayResolveScope) {
  return `matchday-resolve-snapshot::${scope.saveId}::${scope.seasonId}::${scope.matchdayId}`;
}

/**
 * Bindet den Snapshot an genau die Eingaben, aus denen das Ergebnis entstanden ist.
 *
 * Drin ist alles, was die Wertung bewegt: die Aufstellungen des Spieltags (Slots,
 * Reihenfolge, Kapitaen, Formkarten) und der Verfuegbarkeitsstand der eingesetzten
 * Spieler (Fatigue und Verletzung gehen ueber den Injury-Multiplikator direkt in die
 * Scores). Aendert sich davon etwas, passt der Snapshot nicht mehr und wird verworfen.
 *
 * Bewusst NICHT drin: der komplette GameState. Der aendert sich bei jeder Kleinigkeit
 * (Kasse, Postfach, Marktbewegungen) und wuerde den Snapshot dauernd ungueltig machen,
 * ohne dass sich am Spieltagsergebnis irgendetwas aendert.
 */
export function buildMatchdayResolveSignature(gameState: GameState, scope: MatchdayResolveScope) {
  const drafts = (gameState.seasonState.lineupDrafts ?? [])
    .filter((draft) => draft.seasonId === scope.seasonId && draft.matchdayId === scope.matchdayId)
    .map((draft) => ({
      teamId: draft.teamId,
      status: draft.status,
      entries: draft.entries
        .map((entry) => JSON.stringify(entry))
        .sort(),
      modifiers: draft.modifiers ? JSON.stringify(draft.modifiers) : null,
    }))
    .sort((left, right) => left.teamId.localeCompare(right.teamId));

  const fieldedPlayerIds = new Set<string>();
  for (const draft of gameState.seasonState.lineupDrafts ?? []) {
    if (draft.seasonId !== scope.seasonId || draft.matchdayId !== scope.matchdayId) continue;
    for (const entry of draft.entries) {
      const playerId = (entry as { playerId?: string }).playerId;
      if (playerId) fieldedPlayerIds.add(playerId);
    }
  }
  const availability = Object.entries(gameState.seasonState.playerAvailabilityState ?? {})
    .filter(([playerId]) => fieldedPlayerIds.has(playerId))
    .map(([playerId, state]) => `${playerId}:${JSON.stringify(state)}`)
    .sort();

  return createHash("sha256")
    .update(JSON.stringify({ scope, drafts, availability }))
    .digest("hex");
}

/**
 * Liest den Snapshot des Spieltags — aber nur, wenn er noch zu den aktuellen
 * Aufstellungen passt. Sonst `null`, und der Aufrufer rechnet wie bisher live.
 *
 * Ausnahme: Sobald fuer den Spieltag ein Ergebnis existiert, laeuft er bereits und
 * der Snapshot ist festgenagelt. Das ist kein Sonderfall, sondern der Normalfall
 * zwischen D1 und D2: Der D1-Commit schreibt die Fatigue der eingesetzten Spieler,
 * damit aendert sich die Signatur — ohne diese Klammer waere der Snapshot ausgerechnet
 * fuer den D2-Commit ungueltig, und D2 wuerde wieder neu und anders gerechnet.
 */
export function readMatchdayResolveSnapshot(
  gameState: GameState,
  scope: MatchdayResolveScope,
): MatchdayResolveSnapshot | null {
  const record = (gameState.seasonState.matchdayResolveSnapshots ?? []).find(
    (entry) =>
      entry.saveId === scope.saveId &&
      entry.seasonId === scope.seasonId &&
      entry.matchdayId === scope.matchdayId,
  );
  if (!record) return null;
  const matchdayInProgress = (gameState.seasonState.matchdayResults ?? []).some(
    (entry) =>
      entry.saveId === scope.saveId &&
      entry.seasonId === scope.seasonId &&
      entry.matchdayId === scope.matchdayId,
  );
  if (!matchdayInProgress && record.signature !== buildMatchdayResolveSignature(gameState, scope)) {
    return null;
  }
  const payload = record.payload as LegacyMatchdayResolvePreviewPayload | null;
  if (!payload?.preview) return null;
  return { record, payload };
}

/**
 * Steht das Feld? Erst wenn jedes Team fuer beide Disziplin-Seiten eine Aufstellung
 * hat, ergibt eine Vorberechnung Sinn — vorher wuerde sie ein Ergebnis zu einem
 * unvollstaendigen Teilnehmerfeld festschreiben.
 */
export function isMatchdayFieldComplete(gameState: GameState, scope: MatchdayResolveScope) {
  const drafts = (gameState.seasonState.lineupDrafts ?? []).filter(
    (draft) => draft.seasonId === scope.seasonId && draft.matchdayId === scope.matchdayId,
  );
  if (gameState.teams.length === 0) return false;
  const sidesByTeam = new Map<string, Set<string>>();
  for (const draft of drafts) {
    const sides = sidesByTeam.get(draft.teamId) ?? new Set<string>();
    for (const entry of draft.entries) {
      sides.add(entry.disciplineSide);
    }
    sidesByTeam.set(draft.teamId, sides);
  }
  return gameState.teams.every((team) => {
    const sides = sidesByTeam.get(team.teamId);
    return sides != null && sides.has("d1") && sides.has("d2");
  });
}

/**
 * Rechnet den Spieltag EINMAL und legt das Ergebnis im Save ab.
 *
 * Ab hier lesen Arena-Buehne und beide Disziplin-Buchungen aus demselben Ergebnis,
 * statt jeweils neu zu rechnen. Genau daran scheiterte die Gleichheit vorher: Der
 * erste Commit schreibt die Nach-Spieltags-Fatigue, und deren Rekonstruktion beim
 * naechsten Resolve traf den Ausgangsstand nicht exakt — dieselbe Disziplin kam
 * zweimal unterschiedlich heraus.
 *
 * Gibt `null` zurueck, wenn sich (noch) nichts rechnen laesst; der Aufrufer faellt
 * dann auf den bisherigen Live-Pfad zurueck.
 */
export function writeMatchdayResolveSnapshot(
  scope: MatchdayResolveScope,
  persistence: PersistenceService = createPersistenceService(),
): MatchdayResolveSnapshot | null {
  const { save } = requireLocalPersistedSave(persistence, scope.saveId);
  const contextResults = loadAllLocalLegacyLineupContexts(scope, persistence);
  const payload = buildLegacyMatchdayResolvePreviewPayload({
    source: "sqlite",
    params: scope,
    contextResults,
    gameState: save.gameState,
  });
  if (!payload) return null;

  const readinessByTeamId = Object.fromEntries(
    contextResults
      .flatMap((result) => (result.ok ? [result.context] : []))
      .map((context) => {
        const readiness = buildLegacyMatchdayReadiness(context);
        return [
          context.team.id,
          {
            readinessStatus: readiness.readinessStatus,
            reasonCodes: readiness.reasonCodes,
            shortReason: readiness.shortReason,
          },
        ] as const;
      }),
  );

  const record: MatchdayResolveSnapshotRecord = {
    id: buildSnapshotId(scope),
    saveId: scope.saveId,
    seasonId: scope.seasonId,
    matchdayId: scope.matchdayId,
    signature: buildMatchdayResolveSignature(save.gameState, scope),
    previewStatus: payload.preview.status,
    readinessByTeamId,
    payload,
    createdAt: new Date().toISOString(),
  };

  const nextGameState: GameState = {
    ...save.gameState,
    seasonState: {
      ...save.gameState.seasonState,
      // Immer nur der aktuelle Spieltag — aeltere Vorberechnungen sind wertlos und
      // wuerden den Save nur aufblaehen.
      matchdayResolveSnapshots: [record],
    },
  };
  persistence.saveSingleplayerState(save.saveId, nextGameState);

  return { record, payload };
}

/**
 * Sorgt dafuer, dass der Spieltag vorberechnet ist — rechnet aber nur, wenn das Feld
 * vollstaendig ist und noch kein gueltiger Snapshot vorliegt. Mehrfachaufrufe sind
 * damit billig; das ist der Einstiegspunkt fuer den Weg zur Arena.
 */
export function ensureMatchdayResolveSnapshot(
  scope: MatchdayResolveScope,
  persistence: PersistenceService = createPersistenceService(),
): MatchdayResolveSnapshot | null {
  const { save } = requireLocalPersistedSave(persistence, scope.saveId);
  const existing = readMatchdayResolveSnapshot(save.gameState, scope);
  if (existing) return existing;
  if (!isMatchdayFieldComplete(save.gameState, scope)) return null;
  return writeMatchdayResolveSnapshot(scope, persistence);
}
