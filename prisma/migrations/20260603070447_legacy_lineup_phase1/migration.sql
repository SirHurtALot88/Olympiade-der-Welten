ALTER TYPE "LineupStatus" ADD VALUE IF NOT EXISTS 'resolved';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisciplineSide') THEN
    CREATE TYPE "DisciplineSide" AS ENUM ('d1', 'd2');
  END IF;
END $$;

ALTER TABLE "LineupSlot"
ADD COLUMN IF NOT EXISTS "activePlayerId" TEXT,
ADD COLUMN IF NOT EXISTS "disciplineSide" "DisciplineSide" NOT NULL DEFAULT 'd1';

ALTER TABLE "LineupSlot"
ALTER COLUMN "disciplineSide" DROP DEFAULT;

DROP INDEX IF EXISTS "LineupSlot_lineupId_disciplineId_slotIndex_key";

CREATE UNIQUE INDEX IF NOT EXISTS "LineupSlot_lineupId_disciplineId_disciplineSide_slotIndex_key"
ON "LineupSlot"("lineupId", "disciplineId", "disciplineSide", "slotIndex");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'LineupSlot_activePlayerId_fkey'
  ) THEN
    ALTER TABLE "LineupSlot"
    ADD CONSTRAINT "LineupSlot_activePlayerId_fkey"
    FOREIGN KEY ("activePlayerId") REFERENCES "ActivePlayer"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
