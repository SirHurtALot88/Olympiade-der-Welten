import type { PrismaClient } from "@prisma/client";
import { loadBillbeeConfig } from "./credentials";
import { syncBillbee, type BillbeeSyncReport } from "./sync";

/** Hoechstens ein Billbee-Lauf gleichzeitig je Server-Prozess (Muster wie market/runner.ts). */

export interface BillbeeSyncState {
  running: boolean;
  lastReport: BillbeeSyncReport | null;
  lastError: string | null;
  /** ISO-Zeit des letzten fehlgeschlagenen Abrufs (fuer die Anzeige in der Seitenleiste). */
  lastErrorAt?: string | null;
  /** Fortschritt des laufenden Abrufs (null, wenn keiner laeuft). */
  progress?: { percent: number; label: string } | null;
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
  s.lastErrorAt = null;
  s.progress = { percent: 0, label: "Starte …" };
  syncBillbee(prisma, { onProgress: (percent, label) => (s.progress = { percent, label }) })
    .then((r) => {
      s.lastReport = r;
    })
    .catch((e: unknown) => {
      s.lastError = e instanceof Error ? e.message : String(e);
      s.lastErrorAt = new Date().toISOString();
      // Auch ins Server-Log (docker logs), damit der Grund nicht nur im Speicher steht.
      console.error("[billbee-sync] Abruf fehlgeschlagen:", e);
    })
    .finally(() => {
      s.running = false;
      s.progress = null;
    });
  return true;
}
