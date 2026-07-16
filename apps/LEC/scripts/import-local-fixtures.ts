/**
 * Lokales Verifikations-Skript: importiert die echten Billbee-/eBay-Exporte
 * aus apps/LEC/.local-fixtures/ (gitignored, NICHT Teil des Repos) ueber
 * dieselbe runImport-Pipeline wie die Web-App (POST /api/import) und schreibt
 * sie in die lokale SQLite-DB. Dient nur der manuellen Verifikation gegen echte
 * Geschaeftsdaten — laeuft nicht in CI und wird nicht mit echten Daten committet.
 *
 * Aufruf: npm run import:local
 */
import fs from "node:fs";
import path from "node:path";
import { loadDotEnv } from "./_env";

loadDotEnv();

import { runImport, type UploadedFile } from "../src/lib/pipeline/runImport";
import { prisma } from "../src/lib/db/client";

async function main() {
  const fixturesDir = path.join(__dirname, "..", ".local-fixtures");
  if (!fs.existsSync(fixturesDir)) {
    console.error(`Kein Fixtures-Ordner gefunden: ${fixturesDir}`);
    process.exit(1);
  }

  const billbeeNames = ["billbee-30d.xlsx", "billbee-90d.xlsx", "billbee-365d.xlsx", "billbee-alltime.xlsx"];
  const billbeeFiles: UploadedFile[] = [];
  for (const name of billbeeNames) {
    const filePath = path.join(fixturesDir, name);
    if (!fs.existsSync(filePath)) {
      console.warn(`Ueberspringe fehlende Datei: ${name}`);
      continue;
    }
    billbeeFiles.push({ name, buffer: fs.readFileSync(filePath) });
  }

  const ebayPath = path.join(fixturesDir, "ebay-report-2026.csv");
  const ebayFile: UploadedFile | null = fs.existsSync(ebayPath)
    ? { name: "ebay-report-2026.csv", buffer: fs.readFileSync(ebayPath) }
    : null;

  // Billbee-Artikelstamm (Bestand + aktiver Katalog) -- optional, nur falls die
  // Fixture-Datei vorliegt (siehe billbeeArtikel.ts).
  const artikelPath = path.join(fixturesDir, "billbee-artikel.xlsx");
  const billbeeArtikelFile: UploadedFile | null = fs.existsSync(artikelPath)
    ? { name: "billbee-artikel.xlsx", buffer: fs.readFileSync(artikelPath) }
    : null;
  if (!billbeeArtikelFile) {
    console.warn("Ueberspringe fehlende Datei: billbee-artikel.xlsx (Bestand/aktiver Katalog bleiben leer)");
  }

  const summary = await runImport(prisma, { billbeeFiles, ebayFile, billbeeArtikelFile });

  console.log("--- Import-Zusammenfassung ---");
  for (const w of summary.windows) {
    console.log(`${w.fileName}: ${w.windowFrom} - ${w.windowTo} -> Fenster "${w.window}", ${w.rowCount} Zeilen`);
  }
  if (summary.ebay) {
    console.log(
      `${summary.ebay.fileName}: ${summary.ebay.rowCount} Zeilen, Abo-Gebuehr ${summary.ebay.subscriptionFee ?? "?"} EUR`
    );
  }
  if (summary.billbeeArtikel) {
    console.log(
      `${summary.billbeeArtikel.fileName}: ${summary.billbeeArtikel.rowCount} Zeilen, ${summary.billbeeArtikel.activeCount} aktiv gesetzt`
    );
  }
  console.log({
    articleCount: summary.articleCount,
    cardArticleCount: summary.cardArticleCount,
    matchedArticles: summary.matchedArticles,
    matchRate: `${(summary.matchRate * 100).toFixed(1)} %`,
    unmatchedBillbeeArticles: summary.unmatchedBillbeeArticles,
    unmatchedEbayListings: summary.unmatchedEbayListings,
    windowsReplaced: summary.windowsReplaced,
    reviewItemsOpen: summary.reviewItemsOpen,
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
