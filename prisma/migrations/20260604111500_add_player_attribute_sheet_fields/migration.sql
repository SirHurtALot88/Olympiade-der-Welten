BEGIN;

ALTER TABLE "PlayerAttribute"
  ADD COLUMN "power" DOUBLE PRECISION,
  ADD COLUMN "health" DOUBLE PRECISION,
  ADD COLUMN "stamina" DOUBLE PRECISION,
  ADD COLUMN "intelligence" DOUBLE PRECISION,
  ADD COLUMN "awareness" DOUBLE PRECISION,
  ADD COLUMN "determination" DOUBLE PRECISION,
  ADD COLUMN "speed" DOUBLE PRECISION,
  ADD COLUMN "dexterity" DOUBLE PRECISION,
  ADD COLUMN "charisma" DOUBLE PRECISION,
  ADD COLUMN "will" DOUBLE PRECISION,
  ADD COLUMN "spirit" DOUBLE PRECISION,
  ADD COLUMN "torment" DOUBLE PRECISION,
  ADD COLUMN "powerRating" TEXT,
  ADD COLUMN "healthRating" TEXT,
  ADD COLUMN "staminaRating" TEXT,
  ADD COLUMN "intelligenceRating" TEXT,
  ADD COLUMN "awarenessRating" TEXT,
  ADD COLUMN "determinationRating" TEXT,
  ADD COLUMN "speedRating" TEXT,
  ADD COLUMN "dexterityRating" TEXT,
  ADD COLUMN "charismaRating" TEXT,
  ADD COLUMN "willRating" TEXT,
  ADD COLUMN "spiritRating" TEXT,
  ADD COLUMN "tormentRating" TEXT;

COMMIT;
