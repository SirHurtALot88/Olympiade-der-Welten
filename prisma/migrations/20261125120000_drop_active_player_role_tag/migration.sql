-- Rollen-Etikett „Stammspieler / Bank / Nachwuchs“ entfernt (Chris 25.11., docs/design/vertragswert-bau-25-11.md).
ALTER TABLE "ActivePlayer"
  DROP COLUMN IF EXISTS "roleTag";

DROP TYPE IF EXISTS "ActivePlayerRoleTag";
