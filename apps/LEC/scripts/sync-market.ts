/** Marktwert-Lauf von Hand (z. B. im Container): npx tsx scripts/sync-market.ts */
import { prisma } from "../src/lib/db/client";
import { syncMarketPrices } from "../src/lib/market/sync";

syncMarketPrices(prisma)
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
