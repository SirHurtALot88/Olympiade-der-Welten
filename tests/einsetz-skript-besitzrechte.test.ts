/**
 * GEMELDET: nach dem Einsetzen des reparierten Spielstands brach „Neue Saison starten" ab mit
 *
 *     attempt to write a readonly database
 *
 * Die Datei war da, der Inhalt stimmte, gelesen wurde sie auch — der Spielstand sah voellig gesund
 * aus. Nur schreiben ging nicht mehr, und damit war das Spiel eingefroren.
 *
 * URSACHE, mit Zeile: `deploy/hetzner/pull-repaired-save.sh` setzt die Datei mit
 * `docker compose cp` ein, und das schreibt als ROOT in den Container. Der Dienst laeuft aber als
 * `oly` (`Dockerfile:67` legt den Benutzer an, `Dockerfile:82` schaltet darauf um), und
 * `Dockerfile:80` setzt beim Bauen eigens `chown -R oly:nodejs /app/data`. Nach dem Einsetzen
 * gehoerte die Datei root — lesen ja, schreiben nein.
 *
 * Das Skript hat die Besitzrechte nie zurueckgesetzt. Genau das tut es jetzt, und zwar auf BEIDEN
 * Wegen: einsetzen und `--zurueck` teilen sich dieselbe Funktion.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SKRIPT_PFAD = join(process.cwd(), "deploy/hetzner/pull-repaired-save.sh");
const SKRIPT = readFileSync(SKRIPT_PFAD, "utf8");

/** Der Rumpf von `einsetzen()` — beide Richtungen laufen hier durch. */
const EINSETZEN = SKRIPT.slice(SKRIPT.indexOf("einsetzen() {"), SKRIPT.indexOf("\n}", SKRIPT.indexOf("einsetzen() {")));

describe("Einsetz-Skript: der Spielstand bleibt beschreibbar", () => {
  it("setzt die Besitzrechte nach dem Kopieren zurueck", () => {
    // Ohne diese Zeile gehoert die Datei root, und die App kann nur noch lesen.
    expect(EINSETZEN).toContain("chown oly:nodejs");
  });

  it("tut das als root — sonst darf es niemand", () => {
    // Der Standardbenutzer des Images ist `oly`; der kann eine root-Datei nicht uebereignen.
    expect(EINSETZEN).toContain("--user 0");
  });

  it("setzt die Rechte NACH dem Kopieren, nicht davor", () => {
    const kopieAt = EINSETZEN.indexOf('compose cp "$quelle"');
    const chownAt = EINSETZEN.indexOf("chown oly:nodejs");
    expect(kopieAt).toBeGreaterThan(-1);
    expect(chownAt).toBeGreaterThan(kopieAt);
  });

  it("gilt auch fuer den Rueckweg", () => {
    // `--zurueck` ruft dieselbe Funktion auf — sonst waere die Sicherung nach dem Zurueckdrehen
    // ebenfalls nur lesbar, und der Rueckweg fuehrte in denselben Zustand.
    const zurueckBlock = SKRIPT.slice(SKRIPT.indexOf('if [ "$ZURUECK" = "1" ]'));
    expect(zurueckBlock).toContain('einsetzen "$TMP_DB"');
  });

  it("bricht nicht ab, wenn der Benutzer im Image fehlt", () => {
    // Ein Image ohne `oly` soll das alte Verhalten behalten statt den ganzen Lauf zu stoppen —
    // `set -euo pipefail` wuerde sonst genau hier aussteigen.
    const chownZeile = EINSETZEN.slice(EINSETZEN.indexOf("chown oly:nodejs"));
    expect(chownZeile).toContain("|| true");
  });

  it("das Skript bleibt syntaktisch gueltig", () => {
    expect(() => execFileSync("bash", ["-n", SKRIPT_PFAD])).not.toThrow();
  });
});
