import type { PrismaClient } from "@prisma/client";
import { syncMarketPrices, type MarketSyncReport } from "./sync";

/** Hoechstens ein Marktwert-Lauf gleichzeitig je Server-Prozess (Muster wie images/runner.ts). */

export interface MarketSyncState {
  running: boolean;
  lastReport: MarketSyncReport | null;
  lastError: string | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __lecMarketSync: MarketSyncState | undefined;
}

function state(): MarketSyncState {
  globalThis.__lecMarketSync ??= { running: false, lastReport: null, lastError: null };
  return globalThis.__lecMarketSync;
}

export function getMarketSyncState(): MarketSyncState {
  return { ...state() };
}

export function startMarketSync(prisma: PrismaClient): boolean {
  const s = state();
  if (s.running) return false;
  s.running = true;
  s.lastError = null;
  syncMarketPrices(prisma)
    .then((r) => {
      s.lastReport = r;
    })
    .catch((e: unknown) => {
      s.lastError = e instanceof Error ? e.message : String(e);
    })
    .finally(() => {
      s.running = false;
    });
  return true;
}
