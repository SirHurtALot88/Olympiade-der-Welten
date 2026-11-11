-- Artikel ausblenden (Chris, 11.11.2026) und Bestandsaenderungen je Artikel mitschreiben.
ALTER TABLE "Article" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "before" INTEGER NOT NULL,
    "after" INTEGER NOT NULL,
    CONSTRAINT "StockMovement_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "StockMovement_articleId_at_idx" ON "StockMovement"("articleId", "at");
