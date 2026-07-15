-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nameNormalized" TEXT NOT NULL,
    "nameRaw" TEXT NOT NULL,
    "setCode" TEXT,
    "packQty" INTEGER NOT NULL DEFAULT 1,
    "rarity" TEXT,
    "condition" TEXT,
    "edition" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isCard" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ArticleAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nameVariant" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArticleAlias_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SaleWindow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "window" TEXT NOT NULL,
    "windowFrom" DATETIME NOT NULL,
    "windowTo" DATETIME NOT NULL,
    "snapshotDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qty" INTEGER NOT NULL,
    "revenue" REAL NOT NULL,
    "ek" REAL NOT NULL,
    "margeBillbee" REAL NOT NULL,
    "ebayFeeTotal" REAL NOT NULL DEFAULT 0,
    "shippingCost" REAL NOT NULL DEFAULT 0,
    "fixedCostShare" REAL NOT NULL DEFAULT 0,
    "dbI" REAL NOT NULL,
    "dbII" REAL NOT NULL,
    "avgPrice" REAL NOT NULL,
    "rank" INTEGER,
    CONSTRAINT "SaleWindow_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EbayListingFact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT,
    "ebayItemId" TEXT NOT NULL,
    "titleRaw" TEXT NOT NULL,
    "titleNormalized" TEXT NOT NULL,
    "shopCategoryL1" TEXT,
    "shopCategoryL2" TEXT,
    "qtySold" INTEGER NOT NULL,
    "totalRevenueGross" REAL NOT NULL,
    "revenueNetShipping" REAL NOT NULL,
    "shippingPaidByBuyer" REAL NOT NULL,
    "totalSellingCosts" REAL NOT NULL,
    "listingFees" REAL NOT NULL,
    "optionalFees" REAL NOT NULL,
    "salesCommission" REAL NOT NULL,
    "adFeesBasic" REAL NOT NULL,
    "adFeesPremium" REAL NOT NULL,
    "adFeesExpress" REAL NOT NULL,
    "adFeesExternal" REAL NOT NULL,
    "internationalFees" REAL NOT NULL,
    "otherFees" REAL NOT NULL,
    "depositFees" REAL NOT NULL,
    "feeCredits" REAL NOT NULL,
    "shippingLabelCost" REAL NOT NULL,
    "revenueAfterCosts" REAL NOT NULL,
    "avgSellingPrice" REAL NOT NULL,
    "reportFrom" DATETIME NOT NULL,
    "reportTo" DATETIME NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "isCard" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EbayListingFact_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitEk" REAL NOT NULL,
    "buyShipping" REAL NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Purchase_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarketPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "priceFrom" REAL,
    "priceTrend" REAL,
    "priceAvg30" REAL,
    "priceAvg7" REAL,
    "priceAvg1" REAL,
    "available" INTEGER,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" TEXT,
    CONSTRAINT "MarketPrice_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CostSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "buyShippingUnderFive" REAL NOT NULL DEFAULT 1.15,
    "buyShippingFive" REAL NOT NULL DEFAULT 1.30,
    "shippingSingle" REAL NOT NULL DEFAULT 0.67,
    "shippingPack" REAL NOT NULL DEFAULT 0.50,
    "registeredSingle" REAL NOT NULL DEFAULT 0.15,
    "registeredPack" REAL NOT NULL DEFAULT 0.1875,
    "packagingSingle" REAL NOT NULL DEFAULT 0.053,
    "packagingPack" REAL NOT NULL DEFAULT 0.062,
    "fixedYearlyEbayShop" REAL NOT NULL DEFAULT 95,
    "fixedYearlyBillbee" REAL NOT NULL DEFAULT 25,
    "fixedYearlyLexoffice" REAL NOT NULL DEFAULT 60,
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

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "window" TEXT,
    "windowFrom" DATETIME,
    "windowTo" DATETIME,
    "fileName" TEXT,
    "rowCount" INTEGER NOT NULL,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "unmatchedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "nameRaw" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "setCode" TEXT,
    "qty" INTEGER,
    "revenue" REAL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedArticleId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Article_nameNormalized_key" ON "Article"("nameNormalized");

-- CreateIndex
CREATE INDEX "Article_setCode_idx" ON "Article"("setCode");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleAlias_nameVariant_key" ON "ArticleAlias"("nameVariant");

-- CreateIndex
CREATE INDEX "SaleWindow_window_idx" ON "SaleWindow"("window");

-- CreateIndex
CREATE UNIQUE INDEX "SaleWindow_articleId_window_windowFrom_windowTo_key" ON "SaleWindow"("articleId", "window", "windowFrom", "windowTo");

-- CreateIndex
CREATE INDEX "EbayListingFact_titleNormalized_idx" ON "EbayListingFact"("titleNormalized");

-- CreateIndex
CREATE INDEX "EbayListingFact_ebayItemId_idx" ON "EbayListingFact"("ebayItemId");
