/**
 * In-memory session cache for Matchday Arena v2 API bundles.
 * Survives tab unmount/remount within the same browser session.
 */

export type MatchdayArenaSessionParams = {
  saveId: string;
  seasonId: string;
  matchdayId: string;
  teamId: string;
  source: "sqlite" | "prisma";
  /**
   * MUSS Teil des Schlüssels sein: `includeDetails=1` liefert zusätzlich `resolvePreview` und
   * `standingsPreview` (siehe matchday-arena-base-service). Die Arena braucht genau diese Details;
   * der Hintergrund-Prefetch holt bewusst nur das Light-Bundle. Ohne diese Unterscheidung würde ein
   * Light-Treffer die Arena mit fehlender Engine-Preview beliefern.
   */
  includeDetails: boolean;
  /**
   * Stand der Aufstellungen dieses Spieltags (siehe `buildMatchdayLineupRevision`).
   *
   * MUSS Teil des Schlüssels sein. Das teuerste Stück des Bundles ist die Resolve-Preview — genau
   * das Ergebnis, das die Arena abspielt. Ohne die Aufstellungen im Schlüssel überlebte ein
   * Treffer jede Änderung an ihnen: typischer Ablauf war, dass die KI-Aufstellungen erst nach dem
   * ersten Laden nachgezogen wurden und die Bühne danach weiter die Preview von VOR dem Nachziehen
   * zeigte. Gebucht wurde anschliessend etwas anderes als das Gesehene.
   *
   * Leer lassen ist erlaubt (Aufrufer ohne GameState) — dann verhält sich der Schlüssel wie zuvor.
   */
  lineupRevision?: string;
};

export type MatchdayArenaBaseBundleCacheEntry = {
  storedAt: number;
  payload: unknown;
};

export type MatchdayArenaResolveCacheEntry = {
  storedAt: number;
  payload: unknown;
};

const MAX_ARENA_BASE_ENTRIES = 12;
const MAX_ARENA_RESOLVE_ENTRIES = 12;

const arenaBaseBundleByKey = new Map<string, MatchdayArenaBaseBundleCacheEntry>();
const arenaResolvePreviewByKey = new Map<string, MatchdayArenaResolveCacheEntry>();

/**
 * Kurzfassung des Aufstellungsstands eines Spieltags — Eingang in den Cache-Schlüssel.
 *
 * Bewusst über `updatedAt` statt über die Einträge selbst: jede Schreiboperation an einem Entwurf
 * bewegt den Zeitstempel, auch eine, die nur Modifikatoren (Formkarte, Intensität, Kapitän)
 * ändert — und die gehen genauso in das Ergebnis ein wie die Spielerauswahl. Die Anzahl steht
 * mit davor, damit auch das Verschwinden eines Entwurfs den Schlüssel bewegt.
 */
export function buildMatchdayLineupRevision(
  drafts: Array<{ seasonId: string; matchdayId: string; teamId: string; updatedAt: string }> | null | undefined,
  scope: { seasonId: string; matchdayId: string },
): string {
  const relevant = (drafts ?? []).filter(
    (draft) => draft.seasonId === scope.seasonId && draft.matchdayId === scope.matchdayId,
  );
  const stamped = relevant
    .map((draft) => `${draft.teamId}@${draft.updatedAt}`)
    .sort()
    .join(",");
  return `${relevant.length}|${stamped}`;
}

export function buildMatchdayArenaBaseSessionKey(params: MatchdayArenaSessionParams) {
  return `${params.saveId}:${params.seasonId}:${params.matchdayId}:${params.teamId}:${params.source}:${
    params.includeDetails ? "full" : "light"
  }:${params.lineupRevision ?? ""}:base`;
}

export function buildMatchdayArenaResolveSessionKey(
  params: Pick<MatchdayArenaSessionParams, "saveId" | "seasonId" | "matchdayId" | "source">,
) {
  return `${params.saveId}:${params.seasonId}:${params.matchdayId}:${params.source}:resolve`;
}

function trimCacheMap<T>(map: Map<string, T>, maxEntries: number) {
  while (map.size > maxEntries) {
    const oldestKey = map.keys().next().value;
    if (oldestKey == null) {
      break;
    }
    map.delete(oldestKey);
  }
}

export function getMatchdayArenaBaseBundle<T = unknown>(key: string): T | null {
  const entry = arenaBaseBundleByKey.get(key);
  return (entry?.payload as T | undefined) ?? null;
}

export function setMatchdayArenaBaseBundle(key: string, payload: unknown) {
  arenaBaseBundleByKey.set(key, { storedAt: Date.now(), payload });
  trimCacheMap(arenaBaseBundleByKey, MAX_ARENA_BASE_ENTRIES);
}

export function getMatchdayArenaResolvePreview<T = unknown>(key: string): T | null {
  const entry = arenaResolvePreviewByKey.get(key);
  return (entry?.payload as T | undefined) ?? null;
}

export function setMatchdayArenaResolvePreview(key: string, payload: unknown) {
  arenaResolvePreviewByKey.set(key, { storedAt: Date.now(), payload });
  trimCacheMap(arenaResolvePreviewByKey, MAX_ARENA_RESOLVE_ENTRIES);
}

export function invalidateMatchdayArenaSessionCache(input?: {
  saveId?: string;
  seasonId?: string;
  matchdayId?: string;
}) {
  if (!input?.saveId && !input?.seasonId && !input?.matchdayId) {
    arenaBaseBundleByKey.clear();
    arenaResolvePreviewByKey.clear();
    return;
  }

  for (const key of arenaBaseBundleByKey.keys()) {
    if (input.saveId && !key.startsWith(`${input.saveId}:`)) {
      continue;
    }
    if (input.seasonId && !key.includes(`:${input.seasonId}:`)) {
      continue;
    }
    if (input.matchdayId && !key.includes(`:${input.matchdayId}:`)) {
      continue;
    }
    arenaBaseBundleByKey.delete(key);
  }

  for (const key of arenaResolvePreviewByKey.keys()) {
    if (input.saveId && !key.startsWith(`${input.saveId}:`)) {
      continue;
    }
    if (input.seasonId && !key.includes(`:${input.seasonId}:`)) {
      continue;
    }
    if (input.matchdayId && !key.includes(`:${input.matchdayId}:`)) {
      continue;
    }
    arenaResolvePreviewByKey.delete(key);
  }
}
