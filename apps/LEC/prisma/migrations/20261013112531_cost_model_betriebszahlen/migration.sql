/*
  Warnings:

  - You are about to drop the column `registeredPack` on the `CostSettings` table. All the data in the column will be lost.
  - You are about to drop the column `registeredSingle` on the `CostSettings` table. All the data in the column will be lost.

*/
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
    "ebayCommissionFixed" REAL NOT NULL DEFAULT 0.35,
    "adFeeRateSingle" REAL NOT NULL DEFAULT 0.09,
    "adFeeRateMin" REAL NOT NULL DEFAULT 0.09,
    "adFeeRateGood" REAL NOT NULL DEFAULT 0.10,
    "marginMinMultiplier" REAL NOT NULL DEFAULT 1.33,
    "marginGoodMultiplier" REAL NOT NULL DEFAULT 1.66,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_CostSettings" ("active", "adFeeRateGood", "adFeeRateMin", "adFeeRateSingle", "buyShippingFive", "buyShippingUnderFive", "createdAt", "ebayCommissionFixed", "ebayCommissionRate", "ebayCommissionVat", "fixedYearlyBillbee", "fixedYearlyEbayShop", "fixedYearlyLexoffice", "id", "marginGoodMultiplier", "marginMinMultiplier", "packagingPack", "packagingSingle", "shippingPack", "shippingSingle", "version") SELECT "active", "adFeeRateGood", "adFeeRateMin", "adFeeRateSingle", "buyShippingFive", "buyShippingUnderFive", "createdAt", "ebayCommissionFixed", "ebayCommissionRate", "ebayCommissionVat", "fixedYearlyBillbee", "fixedYearlyEbayShop", "fixedYearlyLexoffice", "id", "marginGoodMultiplier", "marginMinMultiplier", "packagingPack", "packagingSingle", "shippingPack", "shippingSingle", "version" FROM "CostSettings";
DROP TABLE "CostSettings";
ALTER TABLE "new_CostSettings" RENAME TO "CostSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Datenkorrektur (Chris' bestaetigte Betriebszahlen, 13.10.2026): Die gespeicherten Fixkosten
-- standen als MONATSpreise in Jahresfeldern (95 / 25 / 60 statt 1140 / 840 / 360) und kannten
-- nur drei der acht EUeR-Fixkostenposten (neu: Sammelfeld "Sonstige" 1839 laut EUeR). Kostensaetze
-- sind versioniert -> die aktive Version bleibt als Historie erhalten, die korrigierte Fassung
-- wird als NEUE aktive Version angelegt. Alle uebrigen Saetze werden unveraendert uebernommen;
-- die neuen Felder (Einkaufs-Versand-Anteil 50 %, Einschreiben 2,35 EUR ab 30 EUR bei 100 Marken,
-- Verpackungslizenz 50, Sonstige 1839) greifen ueber ihre Spalten-Defaults. Ohne gespeicherte Version tut dieser
-- Block nichts (die App nutzt dann DEFAULT_COST_SETTINGS).
INSERT INTO "CostSettings" ("id", "version", "active", "buyShippingUnderFive", "buyShippingFive", "shippingSingle", "shippingPack", "packagingSingle", "packagingPack", "fixedYearlyEbayShop", "fixedYearlyBillbee", "fixedYearlyLexoffice", "fixedYearlyPackagingLicense", "ebayCommissionRate", "ebayCommissionVat", "ebayCommissionFixed", "adFeeRateSingle", "adFeeRateMin", "adFeeRateGood", "marginMinMultiplier", "marginGoodMultiplier")
SELECT lower(hex(randomblob(12))), (SELECT MAX("version") FROM "CostSettings") + 1, 1, "buyShippingUnderFive", "buyShippingFive", "shippingSingle", "shippingPack", "packagingSingle", "packagingPack", 1140, 840, 360, 50, "ebayCommissionRate", "ebayCommissionVat", "ebayCommissionFixed", "adFeeRateSingle", "adFeeRateMin", "adFeeRateGood", "marginMinMultiplier", "marginGoodMultiplier"
FROM "CostSettings" WHERE "active" = 1 ORDER BY "version" DESC LIMIT 1;

UPDATE "CostSettings" SET "active" = 0 WHERE "active" = 1 AND "version" < (SELECT MAX("version") FROM "CostSettings");
