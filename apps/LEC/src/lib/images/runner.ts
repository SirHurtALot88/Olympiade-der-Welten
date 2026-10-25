import type { PrismaClient } from "@prisma/client";
import { syncArticleImages, type SyncReport } from "./sync";

/**
 * Hoechstens ein Bilderlauf gleichzeitig je Server-Prozess. Ein Lauf dauert gut
 * anderthalb Minuten (35 Shopseiten mit Pause), deshalb laeuft er im
 * Hintergrund; die Einstellungen-Seite fragt den Stand ab.
 */

export interface ImageSyncState {
  running: boolean;
  startedAt: string | null;
  lastReport: SyncReport | null;
  lastError: string | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __lecImageSync: { state: ImageSyncState; promise: Promise<void> | null } | undefined;
}

function holder() {
  globalThis.__lecImageSync ??= {
    state: { running: false, startedAt: null, lastReport: null, lastError: null },
    promise: null,
  };
  return globalThis.__lecImageSync;
}

export function getImageSyncState(): ImageSyncState {
  return { ...holder().state };
}

/** Startet einen Lauf, falls keiner laeuft. Gibt true zurueck, wenn neu gestartet. */
export function startImageSync(prisma: PrismaClient, imageDir: string, opts: { force?: boolean } = {}): boolean {
  const h = holder();
  if (h.state.running) return false;
  h.state = { ...h.state, running: true, startedAt: new Date().toISOString(), lastError: null };
  h.promise = syncArticleImages(prisma, { imageDir, force: opts.force })
    .then((report) => {
      h.state = { ...h.state, running: false, lastReport: report };
    })
    .catch((e: unknown) => {
      h.state = { ...h.state, running: false, lastError: e instanceof Error ? e.message : String(e) };
    })
    .finally(() => {
      h.promise = null;
    });
  return true;
}
