import { writeFile } from "node:fs/promises";
import path from "node:path";

import { fetchPlayerAttributeSheetRows } from "@/lib/data/playerAttributeSheet";

async function main() {
  const rows = await fetchPlayerAttributeSheetRows();
  const outputPath = path.resolve(process.cwd(), "data/generated/oly-player-attributes.json");
  await writeFile(outputPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  console.log(`attributeRows: ${rows.length}`);
  console.log(`output: ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
