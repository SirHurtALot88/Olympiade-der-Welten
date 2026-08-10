/**
 * GEMELDET: Chris fuehrt `pull-repaired-save.sh --pruefen` auf dem Server aus. Statt einer
 * Zusammenfassung des reparierten Spielstands bricht Schritt [2/5] ab:
 *
 *     SqliteError: attempt to write a readonly database
 *     code: 'SQLITE_READONLY_DIRECTORY'
 *
 * Ausgerechnet der Schritt, der VOR dem Einsetzen Sicherheit geben soll, war der einzige, der nie
 * durchlief — der Spielstand liess sich damit ueberhaupt nicht zurueckspielen.
 *
 * URSACHE, mit Zeile: `deploy/hetzner/pull-repaired-save.sh:154` kopierte die Pruefdatei nach
 * `oly-app:/tmp-pruefen.sqlite`. Das ist keine Datei IN `/tmp`, sondern eine Datei namens
 * `tmp-pruefen.sqlite` direkt im Wurzelverzeichnis — ein fehlender Schraegstrich. `/` gehoert root,
 * der Dienst laeuft laut Dockerfile aber als `oly`.
 *
 * Dass reines Lesen daran scheitert, ist der unintuitive Teil: die App faehrt mit
 * `journal_mode = WAL` (`lib/persistence/sqlite.ts:234`). Beim Oeffnen einer WAL-Datenbank legt
 * SQLite die Seitendateien `-shm` und `-wal` NEBEN der Datei an — auch bei `readonly: true`, weil
 * der Shared-Memory-Index sonst fehlt. Ist der Ordner nicht beschreibbar, endet schon das erste
 * `prepare()` mit SQLITE_READONLY_DIRECTORY.
 *
 * Der erste Test weist genau diesen Mechanismus nach, statt ihn zu behaupten.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterAll, describe, expect, it } from "vitest";

const arbeitsordner = mkdtempSync(join(tmpdir(), "pruefpfad-"));

afterAll(() => {
  rmSync(arbeitsordner, { recursive: true, force: true });
});

const SKRIPT = join(process.cwd(), "deploy/hetzner/pull-repaired-save.sh");

describe("pull-repaired-save.sh: die Pruefdatei braucht einen beschreibbaren Ordner", () => {
  it("schon ein LESENDER Zugriff auf eine WAL-Datenbank schreibt in den Ordner daneben", () => {
    const ordner = mkdtempSync(join(arbeitsordner, "wal-"));
    const datei = join(ordner, "abbild.sqlite");

    const db = new Database(datei);
    db.pragma("journal_mode = WAL");
    db.exec("CREATE TABLE saves (name TEXT, updated_at TEXT)");
    db.prepare("INSERT INTO saves VALUES (?, ?)").run("Chris' Spiel", "2026-08-07T08:00");
    db.close();

    // Nach dem Schliessen liegt nur die Hauptdatei da — so kommt sie auch aus dem gzip.
    expect(readdirSync(ordner)).toEqual(["abbild.sqlite"]);

    // Und jetzt der Kern: NUR lesen, exakt wie das Skript es tut.
    const nurLesen = new Database(datei, { readonly: true });
    expect(nurLesen.prepare("SELECT COUNT(*) AS n FROM saves").get()).toEqual({ n: 1 });
    nurLesen.close();

    // Trotzdem sind Seitendateien entstanden. Genau deshalb reicht Leserecht auf die Datei nicht —
    // der ORDNER muss beschreibbar sein. In `/` war er das fuer den Benutzer `oly` nicht.
    const entstanden = readdirSync(ordner).filter((n) => n !== "abbild.sqlite");
    expect(entstanden.length, "eine WAL-Datenbank legt beim Lesen Seitendateien an").toBeGreaterThan(0);
    expect(entstanden.some((n) => n.endsWith("-shm"))).toBe(true);
  });

  it("das Skript legt die Pruefdatei deshalb IN einen Ordner, nicht ins Wurzelverzeichnis", () => {
    const skript = readFileSync(SKRIPT, "utf8");

    // Alle Container-Ziele einsammeln, die das Skript beschreibt.
    const ziele = [...skript.matchAll(/oly-app:(\/[^"'\s]+)/g)].map((treffer) => treffer[1]);
    expect(ziele.length, "keine Container-Ziele im Skript gefunden").toBeGreaterThan(0);

    for (const ziel of ziele) {
      // Ein Pfad wie `/tmp-pruefen.sqlite` hat nach dem fuehrenden Schraegstrich keinen weiteren:
      // er liegt damit direkt in `/`. Das ist der gemeldete Fehler.
      expect(
        ziel.slice(1).includes("/"),
        `'${ziel}' liegt direkt im Wurzelverzeichnis — dort darf der Container-Benutzer nicht schreiben`,
      ).toBe(true);

      expect(
        ziel.startsWith("/tmp/") || ziel.startsWith("/app/data/"),
        `'${ziel}' liegt in keinem als beschreibbar bekannten Ordner`,
      ).toBe(true);
    }
  });

  it("und raeumt die Seitendateien wieder weg", () => {
    // Sonst bleibt nach jedem Lauf ein -shm/-wal-Paar im Container liegen.
    const skript = readFileSync(SKRIPT, "utf8");
    const aufraeumen = skript.slice(skript.indexOf("rm -f /tmp/"));
    expect(aufraeumen).toContain("-shm");
    expect(aufraeumen).toContain("-wal");
  });

  it("das Skript bleibt syntaktisch gueltig", () => {
    expect(() => execFileSync("bash", ["-n", SKRIPT])).not.toThrow();
  });
});
