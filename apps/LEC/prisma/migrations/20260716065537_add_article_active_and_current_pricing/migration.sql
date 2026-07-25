-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nameNormalized" TEXT NOT NULL,
    "nameRaw" TEXT NOT NULL,
    "setCode" TEXT,
    "packQty" INTEGER NOT NULL DEFAULT 1,
    "rarity" TEXT,
    "condition" TEXT,
    "edition" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "currentVk" REAL,
    "currentEk" REAL,
    "isCard" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Article" ("condition", "createdAt", "edition", "id", "isCard", "nameNormalized", "nameRaw", "packQty", "rarity", "setCode", "stock", "updatedAt") SELECT "condition", "createdAt", "edition", "id", "isCard", "nameNormalized", "nameRaw", "packQty", "rarity", "setCode", "stock", "updatedAt" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE UNIQUE INDEX "Article_nameNormalized_key" ON "Article"("nameNormalized");
CREATE INDEX "Article_setCode_idx" ON "Article"("setCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
