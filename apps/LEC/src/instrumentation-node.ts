/**
 * Hintergrund-Jobs beim Serverstart (nur Produktion, nur Node-Runtime, siehe
 * instrumentation.ts): Kartenbilder (src/lib/images/) und Cardmarket-Marktwerte
 * (src/lib/market/) sofort und danach taeglich nachziehen. Cardmarket erneuert
 * die Preisliste einmal am Tag; Bilder laedt der Lauf nur, wenn sie fehlen oder
 * sich aendern. Chris pflegt in der App nichts von Hand — die Daten kommen von selbst.
 */
import { prisma, resolveImageDir } from "./lib/db/client";
import { startImageSync } from "./lib/images/runner";
import { startMarketSync } from "./lib/market/runner";

const DAY_MS = 24 * 60 * 60 * 1000;

function runAll() {
  startImageSync(prisma, resolveImageDir());
  startMarketSync(prisma);
}

if (process.env.NODE_ENV === "production") {
  // Kurz warten, bis der Server steht (Migrationen laufen schon vorher in start-hosted.sh).
  setTimeout(runAll, 60_000);
  setInterval(runAll, DAY_MS);
}
