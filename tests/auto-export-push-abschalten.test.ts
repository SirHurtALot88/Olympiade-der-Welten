/**
 * GEMELDET: „fix den auto export endlich mal".
 *
 * BEFUND aus dem Server-Log, alle 180 Sekunden, ueber Wochen:
 *
 *     [online-saves] exportiert: 15 Save(s) → /app/data/online-saves
 *     [online-saves] Auto-Export-Fehler: Command failed: git add -- data/online-saves data/bug-reports
 *     fatal: not a git repository (or any of the parent directories): .git
 *
 * `git` ist inzwischen im Image — das war die frueher vermutete Ursache und ist behoben. Der Rest
 * bleibt aber unmoeglich: `/app` ist ein Build-Ergebnis, kein Checkout. Kein Repository, keine
 * Zugangsdaten. Der Push aus dem Container kann prinzipiell nicht gelingen.
 *
 * Der Zyklus versuchte es trotzdem endlos weiter. Ein Fehler im Minutentakt ist nach dem dritten Mal
 * keine Meldung mehr, sondern Tapete — er stand wochenlang da und wurde nicht mehr gelesen.
 *
 * Deshalb: aussichtslose Fehler legen den Push still (einmal deutlich melden), voruebergehende
 * nicht. Der Export in den Ordner laeuft in beiden Faellen weiter.
 */
import { describe, expect, it } from "vitest";

import { istPushInDieserUmgebungAussichtslos } from "@/lib/persistence/online-save-auto-export";

describe("Auto-Export unterscheidet aussichtslos von voruebergehend", () => {
  it("kein Repository im Container ist aussichtslos", () => {
    // Wortwoertlich aus dem Log des laufenden Servers.
    expect(
      istPushInDieserUmgebungAussichtslos(
        "Command failed: git add -- data/online-saves data/bug-reports\nfatal: not a git repository (or any of the parent directories): .git",
      ),
    ).toBe(true);
  });

  it("fehlendes git ist aussichtslos", () => {
    expect(istPushInDieserUmgebungAussichtslos("Command failed: git add\n/bin/sh: 1: git: not found")).toBe(true);
  });

  it("ein weitergelaufener Remote ist NICHT aussichtslos — das gehoert wiederholt", () => {
    expect(
      istPushInDieserUmgebungAussichtslos("! [rejected] HEAD -> main (non-fast-forward)"),
    ).toBe(false);
  });

  it("ein Netzfehler ist NICHT aussichtslos", () => {
    expect(
      istPushInDieserUmgebungAussichtslos("fatal: unable to access 'https://github.com/...': Could not resolve host"),
    ).toBe(false);
  });

  it("eine Index-Sperre ist NICHT aussichtslos", () => {
    expect(istPushInDieserUmgebungAussichtslos("fatal: Unable to create '.git/index.lock': File exists.")).toBe(false);
  });
});
