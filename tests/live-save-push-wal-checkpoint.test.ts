/**
 * GEMELDET: „boah du weißt doch was mein save ist, dann sag mir das nicht SONDERN FIX DAS ENDLICH
 * DASS DER SAVE IM GIT LANDET"
 *
 * BEFUND: Der Cron lief. Er pushte alle 10 Minuten brav einen Schnappschuss — und der war jedes
 * Mal derselbe veraltete Stand, ohne dass irgendwo ein Fehler auftauchte.
 *
 * URSACHE, mit Zeile: die App laeuft mit `journal_mode = WAL` (`lib/persistence/sqlite.ts:234`).
 * Frische Schreibvorgaenge liegen dabei in der Seitendatei `oly-app.sqlite-wal`, bis ein
 * Checkpoint sie in die Hauptdatei einarbeitet. `deploy/hetzner/push-live-save.sh` kopierte aber
 * ausschliesslich `oly-app.sqlite` — alles seit dem letzten Checkpoint fehlte.
 *
 * Der erste Test unten weist den Mechanismus praktisch nach, statt ihn zu behaupten: dieselbe
 * Datenbank, einmal ohne und einmal mit Checkpoint kopiert.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import Database from "better-sqlite3";
import { afterAll, describe, expect, it } from "vitest";

const arbeitsordner = mkdtempSync(join(tmpdir(), "wal-nachweis-"));

afterAll(() => {
  rmSync(arbeitsordner, { recursive: true, force: true });
});

describe("Live-Save-Push: ohne WAL-Checkpoint fehlt der halbe Spielstand", () => {
  it("eine Kopie ohne Checkpoint sieht die letzten Schreibvorgaenge NICHT", () => {
    const quelle = join(arbeitsordner, "live.sqlite");
    const db = new Database(quelle);
    db.pragma("journal_mode = WAL");
    db.exec("CREATE TABLE saves (id TEXT, updated_at TEXT)");
    db.prepare("INSERT INTO saves VALUES (?, ?)").run("alt", "2026-08-05T18:55");
    // Bis hierhin ist alles eingearbeitet — das ist der Stand, den der Push tagelang lieferte.
    db.pragma("wal_checkpoint(TRUNCATE)");

    // Und das hier ist „Chris spielt weiter": landet in der WAL, nicht in der Hauptdatei.
    db.prepare("INSERT INTO saves VALUES (?, ?)").run("neu", "2026-08-06T18:00");

    const ohneCheckpoint = join(arbeitsordner, "ohne-checkpoint.sqlite");
    copyFileSync(quelle, ohneCheckpoint);
    const gesehenOhne = new Database(ohneCheckpoint, { readonly: true })
      .prepare("SELECT id FROM saves ORDER BY id")
      .all()
      .map((row) => (row as { id: string }).id);

    // GENAU das gemeldete Symptom: der Schnappschuss haengt auf dem alten Zeitstempel fest.
    expect(gesehenOhne).toEqual(["alt"]);

    // Mit Checkpoint ist der frische Stand drin — der Unterschied ist der ganze Fix.
    db.pragma("wal_checkpoint(TRUNCATE)");
    const mitCheckpoint = join(arbeitsordner, "mit-checkpoint.sqlite");
    copyFileSync(quelle, mitCheckpoint);
    const gesehenMit = new Database(mitCheckpoint, { readonly: true })
      .prepare("SELECT id FROM saves ORDER BY id")
      .all()
      .map((row) => (row as { id: string }).id);
    expect(gesehenMit).toEqual(["alt", "neu"]);

    db.close();
  });

  it("das Push-Skript arbeitet die WAL ein, BEVOR es kopiert", () => {
    const skript = readFileSync(join(process.cwd(), "deploy/hetzner/push-live-save.sh"), "utf8");
    const checkpointAt = skript.indexOf("wal_checkpoint");
    const kopieAt = skript.indexOf("docker compose -f \"$COMPOSE\" cp");
    expect(checkpointAt, "kein WAL-Checkpoint im Push-Skript").toBeGreaterThan(-1);
    expect(kopieAt).toBeGreaterThan(-1);
    expect(checkpointAt, "der Checkpoint muss VOR dem Kopieren laufen").toBeLessThan(kopieAt);
  });

  it("und bricht ab, statt einen veralteten Stand zu pushen", () => {
    // Der eigentliche Schaden war nicht der fehlende Checkpoint, sondern dass es LEISE passierte:
    // ein veralteter Schnappschuss sieht aus wie ein aktueller. Schlaegt der Checkpoint fehl, darf
    // nichts gepusht werden.
    const skript = readFileSync(join(process.cwd(), "deploy/hetzner/push-live-save.sh"), "utf8");
    const block = skript.slice(skript.indexOf("wal_checkpoint"), skript.indexOf("Live-Save aus dem Container"));
    expect(block).toContain("exit 1");
  });

  it("das Skript bleibt syntaktisch gueltig", () => {
    // `bash -n` parst ohne auszufuehren — faengt Tippfehler im Shell-Code, den keine CI sonst laedt.
    expect(() =>
      execFileSync("bash", ["-n", join(process.cwd(), "deploy/hetzner/push-live-save.sh")]),
    ).not.toThrow();
  });
});
