/**
 * Hintergrund-Jobs beim Serverstart (nur Produktion, nur Node-Runtime, siehe
 * instrumentation.ts): Kartenbilder und aktuelle VK-Preise aus dem eBay-Shop (src/lib/images/)
 * sowie Cardmarket-Marktwerte (src/lib/market/). Chris pflegt in der App nichts von Hand —
 * die Daten kommen von selbst.
 */
import { prisma, resolveImageDir } from "./lib/db/client";
import { startImageSync } from "./lib/images/runner";
import { startMarketSync } from "./lib/market/runner";
import { startBillbeeSync } from "./lib/billbee/runner";

const HOUR_MS = 60 * 60 * 1000;

// Bilder und aktuelle Angebotspreise aus dem eBay-Shop: alle 6 Stunden (ein Lauf dauert gut
// anderthalb Minuten, 35 Shopseiten mit Pause; er laedt nur, was fehlt oder sich geaendert hat).
// Cardmarket erneuert seine Preisliste einmal am Tag.
function runShop() {
  startImageSync(prisma, resolveImageDir());
}

if (process.env.NODE_ENV === "production") {
  // Kurz warten, bis der Server steht (Migrationen laufen schon vorher in start-hosted.sh).
  setTimeout(() => {
    // Billbee zuerst (legt neue Artikel an, nur wenn die Zugangsdaten gesetzt sind), dann Bilder/Preise/Marktwerte.
    void startBillbeeSync(prisma);
    runShop();
    startMarketSync(prisma);
  }, 60_000);
  setInterval(runShop, 6 * HOUR_MS);
  setInterval(() => void startBillbeeSync(prisma), 3 * HOUR_MS);
  setInterval(() => startMarketSync(prisma), 24 * HOUR_MS);
}
