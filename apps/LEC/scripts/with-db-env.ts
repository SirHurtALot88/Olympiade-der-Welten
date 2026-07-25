/**
 * Wrapper um `prisma <args>`, der DATABASE_URL immer als ABSOLUTEN Pfad aus
 * LEC_SQLITE_PATH ableitet — genau wie src/lib/db/client.ts zur Laufzeit.
 *
 * Hintergrund: Prisma loest eine relative "file:./data/lec.sqlite"-URL in
 * schema.prisma relativ zum prisma/-Ordner auf (nicht zum cwd), waehrend ein
 * an PrismaClient uebergebenes datasourceUrl anders aufgeloest werden kann.
 * Ohne diesen Wrapper wuerden CLI (migrate/db push/studio) und App-Runtime
 * versehentlich zwei verschiedene SQLite-Dateien verwenden. Mit einem stets
 * absoluten Pfad ist die Aufloesung eindeutig.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { loadDotEnv } from "./_env";

loadDotEnv();

function resolveSqlitePath(): string {
  const configured = process.env.LEC_SQLITE_PATH;
  if (configured && configured.trim().length > 0) {
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
  }
  return path.join(process.cwd(), "data", "lec.sqlite");
}

const sqlitePath = resolveSqlitePath();
const databaseUrl = `file:${sqlitePath}`;

const args = process.argv.slice(2);
const result = spawnSync("npx", ["prisma", ...args], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: databaseUrl },
});

process.exit(result.status ?? 1);
