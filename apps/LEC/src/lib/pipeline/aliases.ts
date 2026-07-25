import type { PrismaClient } from "@prisma/client";
import type { AliasMap } from "../matching/engine";

/**
 * Laedt die gelernten Aliasse (ArticleAlias) als AliasMap fuer die
 * Matching-Engine: nameVariant (normalisiert) -> nameNormalized des
 * Ziel-Artikels. Die Matching-Engine wendet die Map auf beide Seiten an
 * (Billbee + eBay), sodass eine gelernte Zuordnung in beide Richtungen greift.
 */
export async function loadAliasMap(prisma: PrismaClient): Promise<AliasMap> {
  const aliases = await prisma.articleAlias.findMany({
    include: { article: true },
  });
  const map: AliasMap = new Map();
  for (const alias of aliases) {
    map.set(alias.nameVariant, alias.article.nameNormalized);
  }
  return map;
}
