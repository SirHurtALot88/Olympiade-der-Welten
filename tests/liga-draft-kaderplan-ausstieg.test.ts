/**
 * KADERPLAN, Review S4: scheitert im Einzelschritt-Draft der Kauf selbst (40 Fehlversuche oder ein teamweiter Grund des
 * Kaufwegs), steigt das Team mit `kauf_blockiert`/`nichts_leistbar` aus. Frueher ohne Kaderplan-Protokoll und still; jetzt
 * traegt auch dieser Ausstieg den Grund der Kadergroesse, den gescheiterten Kauf, `unter_minimum` als Notweg, und warnt laut.
 *
 * Gegen einen echten Wegwerf-Spielstand (frische Saison 1, eigene SQLite); der Kaufweg ist gemockt und lehnt jeden Kauf ab.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { PersistenceService } from "@/lib/persistence/types";

vi.mock("@/lib/market/transfermarkt-local-service", async (original) => {
  const echt = await original<typeof import("@/lib/market/transfermarkt-local-service")>();
  return {
    ...echt,
    executeLocalTransfermarktBuy: () => ({ transferCreated: false, transferId: null, blockingReasons: ["vorstand_abgelehnt"] }),
  };
});

const DB = path.join(os.tmpdir(), `oly-liga-draft-kaderplan-${process.pid}-${Date.now()}.sqlite`);

let persistence: PersistenceService;
let saveId = "";
let dienst: typeof import("@/lib/draft/liga-draft-dienst");

beforeAll(async () => {
  process.env.OLY_APP_SQLITE_PATH = DB;
  process.env.OLY_LIGA_DRAFT_MODUS = "einzelschritt";
  delete process.env.OLY_KI_KADERPLAN;
  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  dienst = await import("@/lib/draft/liga-draft-dienst");
  persistence = createPersistenceService();
  saveId = persistence.createFreshSeasonOneSave({ name: "liga-draft-kaderplan" }).saveId;
}, 120_000);

afterAll(() => {
  delete process.env.OLY_LIGA_DRAFT_MODUS;
  for (const endung of ["", "-wal", "-shm"]) fs.rmSync(`${DB}${endung}`, { force: true });
});

describe("Einzelschritt-Draft mit Kaderplan (Standard in Saison 1): Ausstieg nach gescheitertem Kauf", () => {
  it("bucht den Ausstieg mit Kaderplan-Protokoll, gescheitertem Kauf und `unter_minimum`, und warnt", () => {
    dienst.starteLigaDraft({ persistence, saveId, regeln: { maxRunden: 1, maxPicksJeTeam: 1 } });
    const warnungen: string[] = [];
    const spion = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      warnungen.push(args.map(String).join(" "));
    });
    try {
      const ergebnis = dienst.laufeKiZuege({ persistence, saveId, maxPicks: 1 });
      expect(ergebnis.eintraege).toHaveLength(1);
      const eintrag = ergebnis.eintraege[0]!;
      expect(eintrag.art).not.toBe("pick");
      expect(eintrag.grund).toMatch(/kaderplan:unter_opt_rahmen_erschoepft/);
      expect(eintrag.grund).toMatch(/kaderplan_notwege:[a-z_,]*unter_minimum/);
      expect(eintrag.grund).toMatch(/kauf_gescheitert:blockiert\/vorstand_abgelehnt/);
      expect(warnungen.some((w) => w.includes("[kaderplan] AUSSTIEG") && w.includes(eintrag.teamId))).toBe(true);
    } finally {
      spion.mockRestore();
    }
  }, 180_000);
});
