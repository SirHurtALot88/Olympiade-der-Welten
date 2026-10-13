import type { PrismaClient } from "@prisma/client";
import { billbeeConfigFromEnv } from "./client";
import { syncBillbee, type BillbeeSyncReport } from "./sync";

/** Hoechstens ein Billbee-Lauf gleichzeitig je Server-Prozess (Muster wie market/runner.ts). */

export interface BillbeeSyncState {
  running: boolean;
  lastReport: BillbeeSyncReport | null;
  lastError: string | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __lecBillbeeSync: BillbeeSyncState | undefined;
}

function state(): BillbeeSyncState {
  globalThis.__lecBillbeeSync ??= { running: false, lastReport: null, lastError: null };
  return globalThis.__lecBillbeeSync;
}

export function getBillbeeSyncState(): BillbeeSyncState & { configured: boolean } {
  return { ...state(), configured: billbeeConfigFromEnv() !== null };
}

/** false = laeuft schon oder nicht eingerichtet. */
export function startBillbeeSync(prisma: PrismaClient): boolean {
  const s = state();
  if (s.running || !billbeeConfigFromEnv()) return false;
  s.running = true;
  s.lastError = null;
  syncBillbee(prisma)
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
