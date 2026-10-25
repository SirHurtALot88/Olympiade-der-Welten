/**
 * Bilderlauf von Hand (z. B. auf dem Server im Container):
 *   npx tsx scripts/sync-images.ts            fehlende/geaenderte Bilder holen
 *   npx tsx scripts/sync-images.ts --force    alles neu laden
 */
import { prisma, resolveImageDir } from "../src/lib/db/client";
import { syncArticleImages } from "../src/lib/images/sync";

async function main() {
  const report = await syncArticleImages(prisma, { imageDir: resolveImageDir(), force: process.argv.includes("--force") });
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
