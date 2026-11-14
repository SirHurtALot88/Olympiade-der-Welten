-- Artikel je Bestellung laut Billbee-Auswertung 14.11.2026: 2.481 Stueck / 1.658 Bestellungen = 1,50 (vorher 1,72 aus aelteren Zahlen).
-- Bereits gespeicherte Kostensaetze mit dem alten Standardwert werden nachgezogen; der SQL-Spaltenstandard bleibt 1.72 (SQLite kann ihn nicht
-- aendern), Prisma setzt beim Anlegen den Standard aus schema.prisma (1.5).
UPDATE "CostSettings" SET "itemsPerOrder" = 1.5 WHERE "itemsPerOrder" = 1.72;
