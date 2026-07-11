/**
 * Top up team cash to a floor on a live save (no clone).
 *
 * Usage:
 *   npx tsx scripts/topup-team-cash-floor.ts \
 *     --save-id fresh-season-1-1783169019878 \
 *     [--floor 50] \
 *     [--dry-run]
 */
import { loadEnvConfig } from "@next/env";

import { createPersistenceService } from "@/lib/persistence/persistence-service";

const PROJECT_ROOT = process.cwd();

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

async function main() {
  loadEnvConfig(PROJECT_ROOT);
  process.env.OLY_LONG_RUN_ISOLATED_DB = "0";

  const saveId = argValue("--save-id");
  if (!saveId) {
    console.error("Missing --save-id");
    process.exit(1);
  }
  const floor = Number(argValue("--floor") ?? 50);
  const dryRun = process.argv.includes("--dry-run");

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) {
    console.error(`Save not found: ${saveId}`);
    process.exit(1);
  }

  const touched: Array<{ shortCode: string; before: number; after: number }> = [];
  const gameState = structuredClone(save.gameState);
  for (const team of gameState.teams) {
    const cash = team.cash ?? 0;
    if (cash >= floor) continue;
    touched.push({ shortCode: team.shortCode, before: round(cash), after: floor });
    team.cash = floor;
  }

  console.error(
    `[cash-topup] save=${saveId} season=${save.gameState.season.id} phase=${save.gameState.gamePhase ?? "?"} floor=${floor} teams=${touched.length}${dryRun ? " (dry-run)" : ""}`,
  );
  for (const row of touched.sort((a, b) => a.shortCode.localeCompare(b.shortCode))) {
    console.error(`  ${row.shortCode}: ${row.before} -> ${row.after}`);
  }

  if (!dryRun && touched.length > 0) {
    persistence.saveSingleplayerState(saveId, gameState);
    console.error("[cash-topup] saved");
  }

  console.log(JSON.stringify({ saveId, floor, dryRun, topUpCount: touched.length, teams: touched }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
