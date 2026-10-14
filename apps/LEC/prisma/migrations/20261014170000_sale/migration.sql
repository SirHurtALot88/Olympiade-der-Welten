-- Einzelverkaeufe aus der Billbee-API (src/lib/billbee/sync.ts)
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "soldAt" DATETIME NOT NULL,
    "qty" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "orderRef" TEXT,
    "source" TEXT NOT NULL,
    CONSTRAINT "Sale_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Sale_articleId_soldAt_idx" ON "Sale"("articleId", "soldAt");
