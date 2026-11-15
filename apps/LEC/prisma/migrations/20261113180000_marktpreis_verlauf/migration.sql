-- Verlauf der Cardmarket-Preise je Artikel (Chris, 13.11.2026)
CREATE TABLE "MarketPriceHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "at" DATETIME NOT NULL,
    "priceFrom" REAL,
    "priceTrend" REAL,
    "priceAvg1" REAL,
    "priceAvg7" REAL,
    "priceAvg30" REAL,
    CONSTRAINT "MarketPriceHistory_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "MarketPriceHistory_articleId_at_idx" ON "MarketPriceHistory"("articleId", "at");
