-- Einkaufspreis-Aenderungen festhalten (Chris, 13.11.2026): wie aktuell ist der EK?
CREATE TABLE "EkChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "before" REAL NOT NULL,
    "after" REAL NOT NULL,
    CONSTRAINT "EkChange_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "EkChange_articleId_at_idx" ON "EkChange"("articleId", "at");
