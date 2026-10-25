-- Kartenname laut Set-Code, zum Pruefen der Titel (src/lib/market/names.ts)
ALTER TABLE "Article" ADD COLUMN "codeNameEn" TEXT;
ALTER TABLE "Article" ADD COLUMN "codeNameDe" TEXT;
ALTER TABLE "Article" ADD COLUMN "codeHint" TEXT;
