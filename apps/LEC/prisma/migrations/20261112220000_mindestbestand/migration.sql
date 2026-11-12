-- Mindest- und Soll-Bestand aus Billbee (Chris, 12.11.2026): Grundlage fuer "Nachbestellen faellig".
ALTER TABLE "Article" ADD COLUMN "minStock" INTEGER;
ALTER TABLE "Article" ADD COLUMN "desiredStock" INTEGER;
