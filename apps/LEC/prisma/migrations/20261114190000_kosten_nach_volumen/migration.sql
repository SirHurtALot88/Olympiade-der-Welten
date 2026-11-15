-- Kosten nach Volumen (Chris, 14.11.2026): Versand, Verpackung und Einkaufs-Versand als Jahreskosten / verkaufte Stueck
ALTER TABLE "CostSettings" ADD COLUMN "volumeBasedCosts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CostSettings" ADD COLUMN "shippingDomesticLow" REAL NOT NULL DEFAULT 0.95;
ALTER TABLE "CostSettings" ADD COLUMN "shippingDomesticHigh" REAL NOT NULL DEFAULT 1.1;
ALTER TABLE "CostSettings" ADD COLUMN "shippingHighShare" REAL NOT NULL DEFAULT 0.15;
ALTER TABLE "CostSettings" ADD COLUMN "itemsPerOrder" REAL NOT NULL DEFAULT 1.72;
ALTER TABLE "CostSettings" ADD COLUMN "packagingYearly" REAL NOT NULL DEFAULT 217;
ALTER TABLE "CostSettings" ADD COLUMN "buyOrdersPerYear" REAL NOT NULL DEFAULT 904;
