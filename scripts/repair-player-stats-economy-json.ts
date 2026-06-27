import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Player } from "@/lib/data/olyDataTypes";
import { hydratePlayerWithAttributeSheet } from "@/lib/data/playerAttributeSheetData";
import { repairImportedPlayerData } from "@/lib/data/playerImportRepairs";

async function main() {
  const jsonPath = path.resolve(process.cwd(), "data/generated/oly-player-stats.json");
  const players = JSON.parse(await readFile(jsonPath, "utf8")) as Player[];
  const repaired = repairImportedPlayerData(players.map(hydratePlayerWithAttributeSheet));

  let updated = 0;
  for (let index = 0; index < players.length; index += 1) {
    const before = players[index];
    const after = repaired[index];
    if (
      before?.marketValue !== after?.marketValue ||
      before?.salaryDemand !== after?.salaryDemand ||
      before?.displayMarketValue !== after?.displayMarketValue ||
      before?.displaySalary !== after?.displaySalary
    ) {
      updated += 1;
    }
  }

  await writeFile(jsonPath, `${JSON.stringify(repaired, null, 2)}\n`, "utf8");
  console.log(`repairedPlayers: ${updated}`);
  console.log(`output: ${jsonPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
