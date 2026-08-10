/**
 * SPIELSTAND-WECHSEL DARF DEN SPIELSTAND NICHT ZWEIMAL LADEN.
 *
 * GEMELDET VON CHRIS: „kann gerade auch mein altes save nicht wieder aktiv setzen … Da möchte ich
 * wieder rein."
 *
 * `setActiveSave` begann mit `this.getSaveById(saveId)` — nur um zu prüfen, OB es den Spielstand
 * gibt. Das materialisiert aber den kompletten Save: an Chris' Live-Datenbank gemessen rund 2,1 s
 * für 15 MB JSON aus sechs Tabellen. Am Ende steht ein zweites `getSaveById` für den Rückgabewert,
 * und das läuft ebenfalls KALT: die Transaktion dazwischen schreibt `saves.updated_at`, und genau
 * darauf schlägt der Sitzungs-Cache an (`readSaveSessionCache` vergleicht `updated_at` UND
 * `content_signature`). Der eben gefüllte Eintrag ist damit sofort ungültig.
 *
 * Gemessen an der Live-Datenbank: 4166 ms vorher, 2105 ms nachher.
 *
 * DIESE SUITE ZÄHLT LADEVORGÄNGE STATT MILLISEKUNDEN. Eine Zeitmessung wäre auf geteilter CI-Hardware
 * ein Flake-Generator; die Zahl der Materialisierungen ist dagegen exakt und sagt dasselbe aus.
 * Gezählt wird über `readPersistPerfStats` — dieselben Zähler, die auch `OLY_DEBUG_SAVE_TIMING=1`
 * im Betrieb ausgibt.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createSaveRepository, readPersistPerfStats } from "@/lib/persistence/save-repository";
import { invalidateSaveSessionCache } from "@/lib/persistence/save-session-cache";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";

const previousSqlitePath = process.env.OLY_APP_SQLITE_PATH;
const previousTimingFlag = process.env.OLY_DEBUG_SAVE_TIMING;
let tempDirectory = "";

beforeEach(() => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "oly-activate-test-"));
  process.env.OLY_APP_SQLITE_PATH = path.join(tempDirectory, "data", "oly-app.sqlite");
  // Ohne dieses Flag zaehlt die Persistenz nichts mit — die Zaehler sind im Normalbetrieb aus.
  process.env.OLY_DEBUG_SAVE_TIMING = "1";
  (globalThis as { __olyPersistPerf?: unknown }).__olyPersistPerf = undefined;
  resetDatabaseForTests();
});

afterEach(() => {
  resetDatabaseForTests();
  process.env.OLY_APP_SQLITE_PATH = previousSqlitePath;
  if (previousTimingFlag == null) delete process.env.OLY_DEBUG_SAVE_TIMING;
  else process.env.OLY_DEBUG_SAVE_TIMING = previousTimingFlag;
  (globalThis as { __olyPersistPerf?: unknown }).__olyPersistPerf = undefined;
  if (tempDirectory && fs.existsSync(tempDirectory)) {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

/** Volle Materialisierungen aus SQLite seit dem letzten Zuruecksetzen. */
function ladevorgaenge() {
  return readPersistPerfStats()?.readMiss ?? 0;
}

// Ein kompletter Spielstand wird hier zweimal angelegt und mehrfach kalt geladen.
const TIMEOUT_MS = 30_000;

describe("Spielstand aktivieren", () => {
  it(
    "materialisiert den Spielstand genau EINMAL",
    () => {
      const repository = createSaveRepository();
      repository.saveGameState({ saveId: "save-erster", gameState: createSingleplayerGameState() });
      repository.saveGameState({ saveId: "save-zweiter", gameState: createSingleplayerGameState() });

      // Kalter Ausgangspunkt: nichts liegt mehr im Sitzungs-Cache.
      invalidateSaveSessionCache();
      const vorher = ladevorgaenge();

      const aktiviert = repository.setActiveSave("save-erster", "user_local");

      expect(aktiviert?.saveId).toBe("save-erster");
      // GENAU EINS: der Rueckgabewert. Der Existenz-Check davor darf nichts materialisieren.
      expect(ladevorgaenge() - vorher).toBe(1);
    },
    TIMEOUT_MS,
  );

  it(
    "laedt gar nichts, wenn es den Spielstand nicht gibt",
    () => {
      const repository = createSaveRepository();
      repository.saveGameState({ saveId: "save-vorhanden", gameState: createSingleplayerGameState() });
      invalidateSaveSessionCache();
      const vorher = ladevorgaenge();

      expect(repository.setActiveSave("gibt-es-nicht", "user_local")).toBeNull();
      expect(ladevorgaenge() - vorher).toBe(0);
    },
    TIMEOUT_MS,
  );

  it(
    "setzt den Zeiger trotzdem korrekt um",
    () => {
      const repository = createSaveRepository();
      repository.saveGameState({ saveId: "save-erster", gameState: createSingleplayerGameState() });
      repository.saveGameState({ saveId: "save-zweiter", gameState: createSingleplayerGameState() });

      repository.setActiveSave("save-erster", "user_local");
      expect(repository.getActiveSave("user_local")?.saveId).toBe("save-erster");

      repository.setActiveSave("save-zweiter", "user_local");
      expect(repository.getActiveSave("user_local")?.saveId).toBe("save-zweiter");
    },
    TIMEOUT_MS,
  );
});
