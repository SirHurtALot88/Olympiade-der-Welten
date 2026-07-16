BEGIN;

CREATE TYPE "DisciplineCategory_new" AS ENUM ('power', 'speed', 'mental', 'social');

ALTER TABLE "Alliance"
  ALTER COLUMN "bonusFocus" TYPE "DisciplineCategory_new"
  USING (
    CASE "bonusFocus"::text
      WHEN 'strength' THEN 'power'
      WHEN 'precision' THEN 'speed'
      WHEN 'endurance' THEN 'speed'
      WHEN 'tactics' THEN 'mental'
      ELSE "bonusFocus"::text
    END
  )::"DisciplineCategory_new";

ALTER TABLE "Discipline"
  ALTER COLUMN "category" TYPE "DisciplineCategory_new"
  USING (
    CASE "category"::text
      WHEN 'strength' THEN 'power'
      WHEN 'precision' THEN 'speed'
      WHEN 'endurance' THEN 'speed'
      WHEN 'tactics' THEN 'mental'
      ELSE "category"::text
    END
  )::"DisciplineCategory_new";

DROP TYPE "DisciplineCategory";
ALTER TYPE "DisciplineCategory_new" RENAME TO "DisciplineCategory";

COMMIT;
