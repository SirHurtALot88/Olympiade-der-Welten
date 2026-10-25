// SPONSOR-/APRON-BIT-IDENTITAETS-SONDE (Task #158, Opus-Review-Fund 18.10.: die beiden
// bestehenden Sonden pruefen Resolve/Mapper/Ledger, NICHT die Finanzpfade selbst, die eine
// Liga-Split-Aenderung wie 10.3/10.4 tatsaechlich anfasst).
//
// Ergaenzt scripts/pruefe-resolve-bit-identitaet.ts und pruefe-mapper-bit-identitaet.ts, ersetzt
// sie nicht -- die drei zusammen decken Resolve/Mapper/Ledger UND Sponsor-/Apron-Abrechnung ab.
// Haengt an denselben echten Saves einer SQLite (je als SHA-256). Einmal auf main, einmal auf dem
// Branch laufen lassen (je gegen eine EIGENE Kopie desselben Abbilds) und die Ausgaben mit `cmp`
// vergleichen.
// Aufruf: OLY_APP_SQLITE_PATH=<kopie> npx tsx scripts/pruefe-sponsor-apron-bit-identitaet.ts <ausgabe.json>
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { previewApronSettlement } from "@/lib/season/apron-settlement-service";
import { previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { resolveGameMode } from "@/lib/season/game-mode";

const ausgabe = process.argv[2] ?? "/dev/stdout";
const persistence = createPersistenceService();
const saves = persistence.listSaves();
const bericht: Record<string, unknown> = {};
for (const summary of saves) {
  const save = persistence.getSaveById(summary.saveId);
  if (!save) continue;
  const gs = save.gameState;
  let apronResult: unknown;
  let sponsorResult: unknown;
  try {
    apronResult = previewApronSettlement(gs);
  } catch (error) {
    apronResult = `FEHLER:${error instanceof Error ? error.message : String(error)}`;
  }
  try {
    sponsorResult = previewSponsorSettlement(gs, "season_end");
  } catch (error) {
    sponsorResult = `FEHLER:${error instanceof Error ? error.message : String(error)}`;
  }
  bericht[save.saveId] = {
    gameMode: resolveGameMode(gs),
    apron: createHash("sha256").update(JSON.stringify(apronResult)).digest("hex").slice(0, 16),
    sponsor: createHash("sha256").update(JSON.stringify(sponsorResult)).digest("hex").slice(0, 16),
  };
  console.error(`[sponsor-apron-bit-identitaet] ${save.saveId} ${resolveGameMode(gs)}`);
}
writeFileSync(ausgabe, JSON.stringify(bericht, null, 1));
