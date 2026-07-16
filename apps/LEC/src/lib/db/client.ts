import { PrismaClient } from "@prisma/client";
import path from "node:path";

/**
 * Laufzeit-DB-Pfad kommt aus LEC_SQLITE_PATH (Konvention wie OLY_APP_SQLITE_PATH
 * in der Oly). Default lokal: apps/LEC/data/lec.sqlite (gitignored).
 */
function resolveSqlitePath(): string {
  const configured = process.env.LEC_SQLITE_PATH;
  if (configured && configured.trim().length > 0) {
    // Immer absolut aufloesen (relativ zum cwd) -- siehe scripts/with-db-env.ts:
    // die Prisma-CLI wuerde eine relative "file:"-URL sonst relativ zum
    // prisma/-Ordner statt zum cwd aufloesen, was App und CLI auseinanderlaufen liesse.
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
  }
  return path.join(process.cwd(), "data", "lec.sqlite");
}

function createPrismaClient(): PrismaClient {
  const sqlitePath = resolveSqlitePath();
  return new PrismaClient({
    datasourceUrl: `file:${sqlitePath}`,
  });
}

declare global {
  // eslint-disable-next-line no-var
  var __lecPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient = globalThis.__lecPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__lecPrisma = prisma;
}
