-- "Erstmal nicht nachbestellen" (Chris, 13.11.2026): Artikel bis zu diesem Zeitpunkt nicht als faellig zeigen.
ALTER TABLE "Article" ADD COLUMN "reorderSnoozeUntil" DATETIME;
