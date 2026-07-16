BEGIN;

ALTER TABLE "Player"
  ADD COLUMN "referenceClass" TEXT,
  ADD COLUMN "imageSource" TEXT,
  ADD COLUMN "bracketLabel" TEXT;

ALTER TABLE "PlayerAttribute"
  ADD COLUMN "displayMarketValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "displaySalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "cost" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "upkeepBase" INTEGER NOT NULL DEFAULT 0;

UPDATE "PlayerAttribute"
SET
  "displayMarketValue" = "marketValue",
  "displaySalary" = "salaryDemand",
  "cost" = "marketValue",
  "upkeepBase" = "salaryDemand";

ALTER TABLE "PlayerAttribute"
  ALTER COLUMN "displayMarketValue" DROP DEFAULT,
  ALTER COLUMN "displaySalary" DROP DEFAULT,
  ALTER COLUMN "cost" DROP DEFAULT,
  ALTER COLUMN "upkeepBase" DROP DEFAULT;

COMMIT;
