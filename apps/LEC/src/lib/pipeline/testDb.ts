import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Test-Helfer: legt eine frische, isolierte SQLite-DB in einem Temp-Verzeichnis
 * an und wendet das Prisma-Schema ueber die Migrations-SQL an (ohne die
 * Prisma-CLI zu spawnen -- schnell und deterministisch fuer Vitest). Nur fuer
 * Tests gedacht.
 */
export interface TestDb {
  prisma: PrismaClient;
  cleanup: () => Promise<void>;
}

function findMigrationSql(): string {
  // Von src/lib/pipeline/ aus zwei Ebenen hoch nach apps/LEC/prisma/migrations.
  const migrationsDir = path.resolve(__dirname, "..", "..", "..", "prisma", "migrations");
  const dirs = fs
    .readdirSync(migrationsDir)
    .filter((d) => fs.statSync(path.join(migrationsDir, d)).isDirectory())
    .sort();
  if (dirs.length === 0) {
    throw new Error("Keine Prisma-Migration gefunden.");
  }
  const latest = dirs[dirs.length - 1];
  return fs.readFileSync(path.join(migrationsDir, latest, "migration.sql"), "utf-8");
}

export async function createTestDb(): Promise<TestDb> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lec-test-"));
  const dbPath = path.join(dir, "test.sqlite");
  const prisma = new PrismaClient({ datasourceUrl: `file:${dbPath}` });

  const sql = findMigrationSql();
  // Statements sind einfache CREATE TABLE/INDEX-Anweisungen (kein ";" innerhalb).
  // Kommentarzeilen (-- ...) vor dem Split entfernen, dann an ";" trennen.
  const statements = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
  }

  return {
    prisma,
    cleanup: async () => {
      await prisma.$disconnect();
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}
