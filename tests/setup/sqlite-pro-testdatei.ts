/**
 * EIGENE DATENBANK JE TESTDATEI — gegen Zustand, der zwischen Testdateien leckt.
 *
 * BEFUND, gemessen: eine einzige zusaetzliche, voellig LEERE Testdatei machte zwei voellig
 * unbeteiligte Dateien rot (34 -> 36 rote Dateien). Zwei Laeufe auf demselben Baum lieferten
 * dagegen identische Ergebnisse. Die Suite ist also nicht zufaellig instabil — ihr Ergebnis
 * haengt daran, WIE die Dateien auf die Worker verteilt werden.
 *
 * URSACHE: `lib/persistence/sqlite.ts` isolierte pro WORKER
 * (`oly-app.test-${VITEST_POOL_ID}.sqlite`). Vitest setzt fuer jede Testdatei die Modul-
 * Registrierung zurueck, also auch das Singleton `databaseInstance` — die DATEI auf der Platte
 * bleibt aber liegen und wird von allen Testdateien desselben Workers nacheinander benutzt. Was
 * Datei A schreibt, findet Datei B vor. Welche Datei in welchem Worker landet, verschiebt sich,
 * sobald irgendwo eine Testdatei dazukommt oder wegfaellt.
 *
 * Das ist die Sorte Fehler, die eine Suite als Merge-Tor unbrauchbar macht: wer eine neue
 * Testdatei anlegt, faerbt fremde Tests rot und sucht die Ursache bei sich.
 *
 * DIE LOESUNG: `setupFiles` laeuft einmal PRO TESTDATEI, vor deren Import. Hier wird deshalb ein
 * eigener Datenbankpfad gesetzt — `resolveDatabasePath()` bevorzugt `OLY_APP_SQLITE_PATH`, also
 * greift er fuer alles, was danach in dieser Datei laeuft. Kein Zustand mehr zwischen Dateien.
 *
 * Bewusst eine Zufalls-Id statt des Dateinamens: der Name allein waere nicht eindeutig, wenn
 * vitest eine Datei wiederholt (`--retry`), und der Pfad muss innerhalb einer Datei stabil
 * bleiben — er wird genau einmal je Setup-Lauf bestimmt.
 *
 * Tests, die ihre Isolation selbst regeln (`ensureIsolatedLongRunDatabase`), ueberschreiben die
 * Variable danach weiterhin — dieses Setup nimmt ihnen nichts weg, es gibt allen anderen einen
 * sauberen Startzustand.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, afterEach, beforeEach } from "vitest";

import { beendeHintergrundArbeit, hintergrundArbeitAbzug } from "@/lib/hintergrund/hintergrund-arbeit";

const datenbankDatei = path.join(os.tmpdir(), `oly-test-${process.pid}-${randomUUID()}.sqlite`);

// Alle Datenbankdateien, die `getDatabase()` in DIESER Testdatei geoeffnet hat (s. lib/persistence/sqlite.ts).
// Je Testdatei neu (setupFiles laeuft einmal pro Datei); Worker sind getrennte Prozesse/Threads, fremde
// Dateien kommen hier nie hinein.
const geoeffneteDatenbanken = new Set<string>();
(globalThis as { __olyTestDatenbanken?: Set<string> }).__olyTestDatenbanken = geoeffneteDatenbanken;

/** Nur Dateien direkt im Temp-Verzeichnis mit Namen `oly-*.sqlite` (nie ein echter Spielstand); Fehler nie weiterwerfen. */
function loescheTestDb(pfad: string | undefined) {
  if (!pfad) return;
  try {
    if (
      path.dirname(path.resolve(pfad)) !== path.resolve(os.tmpdir()) ||
      !/^oly-.+\.sqlite$/.test(path.basename(pfad))
    ) {
      return;
    }
    for (const endung of ["", "-wal", "-shm"]) fs.rmSync(`${pfad}${endung}`, { force: true });
  } catch {
    // z. B. EBUSY/EPERM: ein liegengebliebenes Testfile darf NIE die Umgebungs-Wiederherstellung unten verhindern.
  }
}

/**
 * ZWEITES LECK, dieselbe Ursache: Umgebungsvariablen.
 *
 * Die Worker sind PROZESSE, die nacheinander mehrere Testdateien abarbeiten. `process.env` ist
 * prozessweit und ueberlebt den Wechsel — eine Datei, die eine Stellschraube setzt und nicht
 * zuruecksetzt (mehrere tun das), veraendert damit still das Verhalten aller danach in
 * DEMSELBEN Worker laufenden Dateien. Welche das sind, verschiebt sich, sobald irgendwo eine
 * Testdatei dazukommt.
 *
 * Deshalb hier ein Abzug der Umgebung je Testdatei statt Einzelkorrekturen in den Verursachern:
 * ein Nachzuegler, der die Regel wieder bricht, kann keinen Schaden mehr anrichten.
 */
const umgebungVorher = { ...process.env };

process.env.OLY_APP_SQLITE_PATH = datenbankDatei;

/**
 * DRITTES LECK (19.11., #1642): Hintergrundarbeit, die ein Test anstoesst und niemand abwartet — v. a. der KI-Liga-Draft nach
 * jedem neuen Spiel (`startRoom`, Neues-Spiel-Route). Sie lief nach Testende weiter, belegte die Event-Loop des Workers und
 * liess einen 6-ms-Test der Folge in den 20-s-Timeout laufen (tests/mehrspieler-1v1-2v2-modi.test.ts: 83 s statt 26 s).
 * Nach jedem Test wird beendet, was IN diesem Test angestossen wurde; Arbeit aus `beforeAll` gehoert der ganzen Datei und
 * endet in `afterAll`. Abgebrochen wird beim naechsten Happen (Draft: zwischen zwei Schreibvorgaengen), der Stand bleibt
 * konsistent.
 */
let hintergrundVorDemTest: ReadonlySet<object> = new Set();
beforeEach(() => {
  hintergrundVorDemTest = hintergrundArbeitAbzug();
});
afterEach(async () => {
  await beendeHintergrundArbeit({ ausser: hintergrundVorDemTest });
});

afterAll(async () => {
  await beendeHintergrundArbeit();

  // EIGENE DATENBANKEN DER TESTDATEI (16.11.): viele Tests setzen `OLY_APP_SQLITE_PATH` selbst
  // (`/tmp/oly-arena-...-<zufall>.sqlite`) und raeumten sie nie weg -- gemessen 673 Dateien = 11 GB nach einer
  // Arbeitssitzung. Zuerst die offene Verbindung schliessen (sonst gibt Linux den Platz erst frei, wenn der GC das
  // better-sqlite3-Objekt abraeumt), dann alles loeschen, was `getDatabase()` in DIESER Datei geoeffnet hat, plus
  // den zuletzt per Env gesetzten Pfad. Fehler werden verschluckt (s. loescheTestDb).
  try {
    (globalThis as { __olySchliesseTestDatenbank?: () => void }).__olySchliesseTestDatenbank?.();
  } catch {
    // schon geschlossen
  }
  loescheTestDb(process.env.OLY_APP_SQLITE_PATH);
  for (const pfad of geoeffneteDatenbanken) loescheTestDb(pfad);
  geoeffneteDatenbanken.clear();

  // Erst die Umgebung zuruecksetzen: hinzugefuegte Schluessel entfernen, veraenderte
  // zuruecksetzen. `delete` UND Zuweisung, weil ein blosses Ueberschreiben neu gesetzte
  // Schluessel stehen liesse.
  for (const schluessel of Object.keys(process.env)) {
    if (!(schluessel in umgebungVorher)) delete process.env[schluessel];
  }
  Object.assign(process.env, umgebungVorher);

  // Ohne Aufraeumen fuellt jeder Lauf das Temp-Verzeichnis mit einer Datei je Testdatei.
  // `-wal` und `-shm` sind die Begleitdateien des WAL-Modus; sie bleiben sonst liegen.
  for (const endung of ["", "-wal", "-shm"]) {
    fs.rmSync(`${datenbankDatei}${endung}`, { force: true });
  }
});
