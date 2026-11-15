-- Billbee-Artikel-ID (Product.Id), damit der Drawer direkt in die Billbee-Artikelbearbeitung verlinken kann (Chris, 15.11.2026).
ALTER TABLE "Article" ADD COLUMN "billbeeId" TEXT;
