import type { PrismaClient } from "@prisma/client";
import { loadBillbeeConfig } from "./credentials";
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

export async function getBillbeeSyncState(prisma: PrismaClient): Promise<BillbeeSyncState & { configured: boolean; source: string | null }> {
  const { config, source } = await loadBillbeeConfig(prisma);
  return { ...state(), configured: config !== null, source };
}

/** false = laeuft schon oder nicht eingerichtet. */
export async function startBillbeeSync(prisma: PrismaClient): Promise<boolean> {
  const s = state();
  if (s.running || !(await loadBillbeeConfig(prisma)).config) return false;
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
