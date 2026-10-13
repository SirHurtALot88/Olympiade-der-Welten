-- Automatischer Cardmarket-Marktwert aus der oeffentlichen Preisliste (src/lib/market/)
ALTER TABLE "MarketPrice" ADD COLUMN "idProduct" INTEGER;
ALTER TABLE "MarketPrice" ADD COLUMN "matchQuality" TEXT;
ALTER TABLE "MarketPrice" ADD COLUMN "priceMin" REAL;
ALTER TABLE "MarketPrice" ADD COLUMN "priceMax" REAL;
ALTER TABLE "MarketPrice" ADD COLUMN "variants" INTEGER;
CREATE INDEX "MarketPrice_articleId_source_idx" ON "MarketPrice"("articleId", "source");
