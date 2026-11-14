-- Aenderungen des Listen-VK je Artikel mitschreiben (Chris, 11.11.2026).
CREATE TABLE "PriceChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "before" REAL NOT NULL,
    "after" REAL NOT NULL,
    CONSTRAINT "PriceChange_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PriceChange_articleId_at_idx" ON "PriceChange"("articleId", "at");
