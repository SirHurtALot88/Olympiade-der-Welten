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
  // ALLE Migrationen in chronologischer Reihenfolge anwenden (nicht nur die
  // letzte!) -- neuere Migrationen sind i. d. R. inkrementelle ALTER-Schritte
  // (siehe add_article_active_and_current_pricing), die ohne die vorherige
  // init-Migration keine vollstaendige Tabellenstruktur ergeben.
  const migrationsDir = path.resolve(__dirname, "..", "..", "..", "prisma", "migrations");
  const dirs = fs
    .readdirSync(migrationsDir)
    .filter((d) => fs.statSync(path.join(migrationsDir, d)).isDirectory())
    .sort();
  if (dirs.length === 0) {
    throw new Error("Keine Prisma-Migration gefunden.");
  }
  return dirs.map((d) => fs.readFileSync(path.join(migrationsDir, d, "migration.sql"), "utf-8")).join("\n");
}

/**
 * Macht CREATE TABLE/INDEX-Anweisungen idempotent (IF NOT EXISTS). Noetig,
 * weil mehrere Migrationen inkrementell dieselben Index-Namen neu anlegen
 * (RedefineTable-Pattern bei SQLite-Spaltenaenderungen, z. B.
 * add_article_active_and_current_pricing legt Article_setCode_idx erneut an,
 * nachdem die alte Tabelle inkl. Index gedroppt wurde) -- ohne IF NOT EXISTS
 * kam es dabei vereinzelt zu "already exists"-Fehlern beim Testaufbau.
 */
function makeIdempotent(stmt: string): string {
  if (/^CREATE UNIQUE INDEX /i.test(stmt)) {
    return stmt.replace(/^CREATE UNIQUE INDEX /i, "CREATE UNIQUE INDEX IF NOT EXISTS ");
  }
  if (/^CREATE INDEX /i.test(stmt)) {
    return stmt.replace(/^CREATE INDEX /i, "CREATE INDEX IF NOT EXISTS ");
  }
  if (/^CREATE TABLE /i.test(stmt)) {
    return stmt.replace(/^CREATE TABLE /i, "CREATE TABLE IF NOT EXISTS ");
  }
  return stmt;
}

export async function createTestDb(): Promise<TestDb> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lec-test-"));
  const dbPath = path.join(dir, "test.sqlite");
  // connection_limit=1: mit mehreren gepoolten SQLite-Verbindungen kam es beim
  // sequenziellen Ausfuehren der Migrations-DDL-Statements (CREATE/DROP/RENAME
  // TABLE) vereinzelt zu Ordnungs-Race-Conditions ("already exists"/"no such
  // table"), weil einzelne Statements offenbar ueber unterschiedliche
  // Verbindungen liefen. Eine einzige Verbindung erzwingt die Reihenfolge.
  const prisma = new PrismaClient({ datasourceUrl: `file:${dbPath}?connection_limit=1` });

  const sql = findMigrationSql();
  // Statements sind einfache CREATE TABLE/INDEX-Anweisungen (kein ";" innerhalb).
  // Kommentarzeilen (-- ...) vor dem Split entfernen, dann an ";" trennen.
  const statements = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(makeIdempotent);

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
