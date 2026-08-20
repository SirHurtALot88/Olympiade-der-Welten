/**
 * DIE WÄCHTER MÜSSEN IM PFLICHT-CHECK STEHEN — sonst warnen sie erst nach dem Merge.
 *
 * DER ANLASS: `full-test-suite` ist kein Pflicht-Check. Am 20.08.2026 sind dadurch zwei rote
 * Wächter durchgerutscht — zwei Apron-Zusicherungen (#589) und ein CSS-Ratchet (#595). Beide Tests
 * existierten. Sie liefen nur nicht in dem Job, der das Tor bewacht.
 *
 * DIESER TEST IST DER WÄCHTER ÜBER DEN WÄCHTERN. Er hält drei Dinge fest:
 *   1. Der Pflicht-Job ruft die Auswahl wirklich auf.
 *   2. Die Auswahl wird ERRECHNET, nicht aufgezählt — eine feste Liste veraltet ab dem ersten
 *      neuen Wächter, und genau diese nicht mitwachsende Auswahl war ja die Ursache.
 *   3. Die drei Dateien, an denen es real geklemmt hat, sind wirklich drin. Ohne diese Prüfung
 *      wäre „ist im Tor" eine Behauptung über ein Skript statt über die Fälle.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const WORKFLOW = readFileSync(join(process.cwd(), ".github/workflows/ci.yml"), "utf8");
const PAKET = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

/** Der Abschnitt des PFLICHT-Jobs, abgegrenzt am Beginn des zweiten Jobs. */
const PFLICHT_JOB = WORKFLOW.slice(
  WORKFLOW.indexOf("  test-and-smoke:"),
  WORKFLOW.indexOf("  full-test-suite:"),
);

describe("Die Quelltext-Wächter laufen im Pflicht-Check mit", () => {
  it("der Pflicht-Job ruft sie auf — nicht der Job daneben", () => {
    expect(PFLICHT_JOB).toContain("npm run ci:quelltext-waechter");
    // Abgrenzung: der Abschnitt, den wir hier lesen, ist wirklich der Pflicht-Job und nicht
    // versehentlich die ganze Datei.
    expect(PFLICHT_JOB).toContain("npm run ci:flow-smoke");
    expect(PFLICHT_JOB.length).toBeLessThan(WORKFLOW.length);
  });

  it("das Skript ist verdrahtet", () => {
    expect(PAKET.scripts["ci:quelltext-waechter"]).toBe("tsx scripts/fahre-quelltext-waechter.ts");
  });

  it("die Auswahl wird errechnet, nicht aufgezählt", () => {
    const skript = readFileSync(join(process.cwd(), "scripts/fahre-quelltext-waechter.ts"), "utf8");
    // Es liest die Testdateien und entscheidet an ihrem Inhalt …
    expect(skript).toContain("readdirSync");
    expect(skript).toContain("SIGNATUREN");
    // … und meldet einen Fehler statt „grün", wenn die Erkennung nichts mehr findet. Eine leere
    // Auswahl, die als Erfolg durchgeht, wäre schlimmer als kein Tor.
    expect(skript).toContain("process.exit(1)");
  });
});

describe("Die Fälle, an denen es real geklemmt hat, sind in der Auswahl", () => {
  const SIGNATUREN = ["readFileSync(join(process.cwd()", "readFileSync(path.join(process.cwd()"];
  const istInDerAuswahl = (datei: string) => {
    const inhalt = readFileSync(join(process.cwd(), datei), "utf8");
    return SIGNATUREN.some((signatur) => inhalt.includes(signatur));
  };

  it.each([
    // #589: hielten die zurückgenommene Apron-Bemessung fest und wurden rot, ohne das Tor zu
    // schließen.
    "tests/ki-kennt-die-luxussteuer.test.ts",
    "tests/f4-eine-quelle-pro-groesse.test.ts",
    // #595: der Ratchet auf `color: var(--nl-accent)` in globals.css.
    "tests/nl-accent-text-regel.test.ts",
  ])("%s", (datei) => {
    expect(istInDerAuswahl(datei)).toBe(true);
  });
});
