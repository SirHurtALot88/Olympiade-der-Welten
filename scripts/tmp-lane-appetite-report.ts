import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getDatabase } from "@/lib/persistence/sqlite";
import { computeIdentityLaneAppetite } from "@/lib/ai/ai-needs-picks-compare-service";

const PROJECT_ROOT = path.resolve(__dirname, "..");
loadEnvConfig(PROJECT_ROOT);
getDatabase();

const saveId = process.argv[2];
const persistence = createPersistenceService();
const save = persistence.getSaveById(saveId);
if (!save) throw new Error("save not found: " + saveId);

const rows = save.gameState.teams
  .map((team) => {
    const identity = save.gameState.teamIdentities.find((entry) => entry.teamId === team.teamId) ?? null;
    const philosophy = computeIdentityLaneAppetite(identity);
    return {
      team: team.shortCode ?? team.teamId,
      ambition: identity?.ambition ?? null,
      finances: identity?.finances ?? null,
      boardConfidence: identity?.boardConfidence ?? null,
      premiumAppetite: Number(philosophy.premiumAppetite.toFixed(3)),
      premiumCap: philosophy.premiumCap,
      superstarCap: philosophy.superstarCap,
      coreBias: Number(philosophy.coreBias.toFixed(3)),
      depthBias: Number(philosophy.depthBias.toFixed(3)),
    };
  })
  .sort((a, b) => b.premiumAppetite - a.premiumAppetite);

console.log("team,ambition,finances,boardConfidence,premiumAppetite,premiumCap,superstarCap,coreBias,depthBias");
for (const row of rows) {
  console.log(
    `${row.team},${row.ambition},${row.finances},${row.boardConfidence},${row.premiumAppetite},${row.premiumCap},${row.superstarCap},${row.coreBias},${row.depthBias}`,
  );
}

const capCounts = new Map<number, number>();
for (const row of rows) {
  capCounts.set(row.premiumCap, (capCounts.get(row.premiumCap) ?? 0) + 1);
}
console.log("\npremiumCap distribution:", Object.fromEntries(capCounts));
console.log("superstarCap>=1 teams:", rows.filter((r) => r.superstarCap >= 1).map((r) => r.team));
