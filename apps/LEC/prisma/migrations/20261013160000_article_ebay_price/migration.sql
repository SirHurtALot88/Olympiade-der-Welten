-- Aktueller VK live aus dem eBay-Shop (src/lib/images/sync.ts)
ALTER TABLE "Article" ADD COLUMN "ebayPrice" REAL;
ALTER TABLE "Article" ADD COLUMN "ebayPriceAt" DATETIME;
