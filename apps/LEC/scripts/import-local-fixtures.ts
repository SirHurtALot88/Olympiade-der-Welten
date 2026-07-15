/**
 * Lokales Verifikations-Skript: importiert die echten Billbee-/eBay-Exporte
 * aus apps/LEC/.local-fixtures/ (gitignored, NICHT Teil des Repos) und
 * schreibt sie in die lokale SQLite-DB. Dient nur der manuellen Verifikation
 * des Import-/Matching-Piplines gegen echte Geschaeftsdaten — laeuft nicht in
 * CI und wird nicht mit echten Daten committet.
 *
 * Aufruf: npm run import:local
 */
import fs from "node:fs";
import path from "node:path";
import { loadDotEnv } from "./_env";

loadDotEnv();

import { parseBillbeeWorkbook } from "../src/lib/importers/billbee";
import { parseEbayReport } from "../src/lib/importers/ebay";
import { buildImportPlan } from "../src/lib/pipeline/importPlan";
import { persistImportPlan } from "../src/lib/pipeline/persist";
import { DEFAULT_COST_SETTINGS } from "../src/lib/pricing/costSettings";
import { prisma } from "../src/lib/db/client";

async function main() {
  const fixturesDir = path.join(__dirname, "..", ".local-fixtures");
  if (!fs.existsSync(fixturesDir)) {
    console.error(`Kein Fixtures-Ordner gefunden: ${fixturesDir}`);
    process.exit(1);
  }

  const billbeeFiles = ["billbee-30d.xlsx", "billbee-90d.xlsx", "billbee-365d.xlsx", "billbee-alltime.xlsx"];
  const billbeeResults = [];
  for (const file of billbeeFiles) {
    const filePath = path.join(fixturesDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`Ueberspringe fehlende Datei: ${file}`);
      continue;
    }
    const buffer = fs.readFileSync(filePath);
    const result = await parseBillbeeWorkbook(buffer);
    console.log(
      `${file}: Zeitraum ${result.windowFrom.toISOString().slice(0, 10)} - ${result.windowTo
        .toISOString()
        .slice(0, 10)} -> Fenster "${result.window}", ${result.rows.length} Zeilen`
    );
    billbeeResults.push(result);
  }

  const ebayPath = path.join(fixturesDir, "ebay-report-2026.csv");
  let ebayResult = null;
  if (fs.existsSync(ebayPath)) {
    const csvText = fs.readFileSync(ebayPath, "utf-8");
    ebayResult = parseEbayReport(csvText);
    console.log(
      `ebay-report-2026.csv: ${ebayResult.rows.length} Zeilen, Abo-Gebuehr ${ebayResult.subscriptionFee ?? "?"} EUR`
    );
  }

  const plan = buildImportPlan(billbeeResults, ebayResult, DEFAULT_COST_SETTINGS);

  console.log("\n--- Import-Plan-Statistik ---");
  console.log(plan.stats);
  console.log(`Karten-Artikel im Katalog: ${plan.articles.filter((a) => a.isCard).length} / ${plan.articles.length}`);
  console.log(`Fenster-Snapshots geplant: ${plan.saleWindows.length}`);
  console.log(`Review-Items (ungematcht): ${plan.reviewItems.length}`);
  if (plan.reviewItems.length > 0) {
    console.log("Beispiele:", plan.reviewItems.slice(0, 10).map((r) => `[${r.source}] ${r.nameRaw}`));
  }

  const persistResult = await persistImportPlan(prisma, plan);
  console.log("\n--- Persistiert ---");
  console.log(persistResult);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
