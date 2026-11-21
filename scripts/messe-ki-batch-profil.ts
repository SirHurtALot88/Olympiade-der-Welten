// Profil des KI-Aufstellungs-Batches auf einer KOPIE des Live-Abbilds (21.11.).
import { createHash } from "node:crypto";
//   OLY_MESS_SAVE=<saveId> OLY_APP_SQLITE_PATH=<kopie.sqlite> node --cpu-prof --cpu-prof-dir=<dir> --import tsx scripts/messe-ki-batch-profil.ts
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applyAiLegacyLineupBatchLocally } from "@/lib/ai/ai-legacy-lineup-batch-apply-service";

const persistence = createPersistenceService();
const saveId = process.env.OLY_MESS_SAVE!;
const gs = persistence.getSaveById(saveId)!.gameState;
const seasonId = gs.season.id;
const matchdayId = gs.matchdayState.matchdayId;
const t = Date.now();
const r = applyAiLegacyLineupBatchLocally(
  { saveId, seasonId, matchdayId, dryRun: false, includeWarningTeams: true, overwriteExisting: true },
  persistence,
);
console.log(`Batch ${Date.now() - t} ms`, JSON.stringify((r as { summary?: unknown }).summary ?? {}).slice(0, 300));
const nach = persistence.getSaveById(saveId)!.gameState;
const drafts = (nach.seasonState.lineupDrafts ?? []).filter((d) => d.matchdayId === matchdayId);

console.log(`DRAFT-HASH ${createHash("sha256").update(JSON.stringify(drafts.map((d) => ({ t: d.teamId, e: d.entries, m: (d as { modifiers?: unknown }).modifiers })).sort((a, b) => a.t.localeCompare(b.t)))).digest("hex").slice(0, 16)} (${drafts.length} Entwuerfe)`);
process.exit(0);
