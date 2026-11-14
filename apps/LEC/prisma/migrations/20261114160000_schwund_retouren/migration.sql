-- CreateTable
CREATE TABLE "StockLoss" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitEk" REAL,
    "note" TEXT,
    CONSTRAINT "StockLoss_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StockLoss_articleId_at_idx" ON "StockLoss"("articleId", "at");
