import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getDatabase } from "@/lib/persistence/sqlite";
import { derivePlayerThemeTags } from "@/lib/ai/team-theme-composition-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");
loadEnvConfig(PROJECT_ROOT);
getDatabase();

const saveId = process.argv[2];
const persistence = createPersistenceService();
const save = persistence.getSaveById(saveId);
if (!save) throw new Error("save not found: " + saveId);

const tt = save.gameState.teams.find((t) => t.teamId === "T-T" || t.shortCode === "T-T");
if (!tt) throw new Error("T-T not found");
const roster = save.gameState.rosters.filter((r) => r.teamId === tt.teamId);
const playerById = new Map(save.gameState.players.map((p) => [p.id, p]));

console.log("T-T roster (" + roster.length + " players):");
for (const entry of roster) {
  const p = playerById.get(entry.playerId);
  if (!p) continue;
  const tags = derivePlayerThemeTags(p).playerThemeTags;
  const themed = tags.includes("Teacher") || tags.includes("Mentor") || tags.includes("Leader");
  console.log(`  ${p.name} | class=${p.className} | mv=${p.marketValue} | tags=${tags.join(",")} | THEMED=${themed}`);
}
