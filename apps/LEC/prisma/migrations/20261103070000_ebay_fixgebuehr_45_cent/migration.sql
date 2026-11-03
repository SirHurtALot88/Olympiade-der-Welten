-- eBay berechnet seit Herbst 2026 0,45 EUR je Bestellung (vorher 0,35 EUR), Chris 03.11.2026.
-- Spalten-Default anheben (Schema und TypeScript-Default muessen uebereinstimmen) und gespeicherte
-- Kostensaetze, die noch den alten Standardwert tragen, mitziehen; eigene Werte bleiben.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CostSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "buyShippingUnderFive" REAL NOT NULL DEFAULT 1.15,
    "buyShippingFive" REAL NOT NULL DEFAULT 1.30,
    "buyShippingShareFactor" REAL NOT NULL DEFAULT 0.5,
    "shippingSingle" REAL NOT NULL DEFAULT 0.67,
    "shippingPack" REAL NOT NULL DEFAULT 0.50,
    "registeredCostPerShipment" REAL NOT NULL DEFAULT 2.35,
    "registeredThreshold" REAL NOT NULL DEFAULT 30,
    "registeredStampsPerYear" REAL NOT NULL DEFAULT 100,
    "packagingSingle" REAL NOT NULL DEFAULT 0.053,
    "packagingPack" REAL NOT NULL DEFAULT 0.062,
    "fixedYearlyEbayShop" REAL NOT NULL DEFAULT 1140,
    "fixedYearlyBillbee" REAL NOT NULL DEFAULT 840,
    "fixedYearlyLexoffice" REAL NOT NULL DEFAULT 360,
    "fixedYearlyPackagingLicense" REAL NOT NULL DEFAULT 50,
    "fixedYearlyOther" REAL NOT NULL DEFAULT 1839,
    "ebayCommissionRate" REAL NOT NULL DEFAULT 0.11,
    "ebayCommissionVat" REAL NOT NULL DEFAULT 0.19,
    "ebayCommissionFixed" REAL NOT NULL DEFAULT 0.45,
    "adFeeRateSingle" REAL NOT NULL DEFAULT 0.09,
    "adFeeRateMin" REAL NOT NULL DEFAULT 0.09,
    "adFeeRateGood" REAL NOT NULL DEFAULT 0.10,
    "marginMinMultiplier" REAL NOT NULL DEFAULT 1.33,
    "marginGoodMultiplier" REAL NOT NULL DEFAULT 1.66,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_CostSettings" ("id", "version", "active", "buyShippingUnderFive", "buyShippingFive", "buyShippingShareFactor", "shippingSingle", "shippingPack", "registeredCostPerShipment", "registeredThreshold", "registeredStampsPerYear", "packagingSingle", "packagingPack", "fixedYearlyEbayShop", "fixedYearlyBillbee", "fixedYearlyLexoffice", "fixedYearlyPackagingLicense", "fixedYearlyOther", "ebayCommissionRate", "ebayCommissionVat", "ebayCommissionFixed", "adFeeRateSingle", "adFeeRateMin", "adFeeRateGood", "marginMinMultiplier", "marginGoodMultiplier", "createdAt") SELECT "id", "version", "active", "buyShippingUnderFive", "buyShippingFive", "buyShippingShareFactor", "shippingSingle", "shippingPack", "registeredCostPerShipment", "registeredThreshold", "registeredStampsPerYear", "packagingSingle", "packagingPack", "fixedYearlyEbayShop", "fixedYearlyBillbee", "fixedYearlyLexoffice", "fixedYearlyPackagingLicense", "fixedYearlyOther", "ebayCommissionRate", "ebayCommissionVat", CASE WHEN "ebayCommissionFixed" = 0.35 THEN 0.45 ELSE "ebayCommissionFixed" END, "adFeeRateSingle", "adFeeRateMin", "adFeeRateGood", "marginMinMultiplier", "marginGoodMultiplier", "createdAt" FROM "CostSettings";
DROP TABLE "CostSettings";
ALTER TABLE "new_CostSettings" RENAME TO "CostSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
