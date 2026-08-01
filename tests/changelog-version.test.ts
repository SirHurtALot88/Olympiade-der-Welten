import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseChangelogDatei, parseChangelogEintrag } from "@/lib/changelog/changelog";

const read = (relativePath: string) => JSON.parse(readFileSync(join(process.cwd(), relativePath), "utf8"));

/**
 * GEWUENSCHT: „kannst du bei so großen patches wie sponsoren die versionsnummer erhöhen auf 1.1?
 * und das dann auch im changelog ablegen der gerade gebaut wird?"
 *
 * Die Versionsnummer markiert den EINSCHNITT, nicht den Alltag. Traegt jeder Bugfix eine, sagt
 * sie nichts mehr aus — deshalb ist das Feld optional, und die Triage-Eintraege (also alle
 * gefixten Bug-Meldungen) setzen es grundsaetzlich nicht.
 */
describe("Changelog: Versionsnummer nur bei grossen Aenderungen", () => {
  it("liest die Version aus einem gepflegten Eintrag", () => {
    const eintrag = parseChangelogEintrag({
      datum: "2026-08-01",
      text: "Grosser Umbau.",
      version: "0.2",
    });
    expect(eintrag?.version).toBe("0.2");
  });

  it("laesst sie weg, wenn keine da ist — und stolpert nicht ueber Leerzeichen", () => {
    expect(parseChangelogEintrag({ datum: "2026-08-01", text: "Kleiner Fix." })?.version).toBeNull();
    expect(parseChangelogEintrag({ datum: "2026-08-01", text: "Kleiner Fix.", version: "   " })?.version).toBeNull();
    expect(parseChangelogEintrag({ datum: "2026-08-01", text: "Kleiner Fix.", version: 11 })?.version).toBeNull();
  });

  it("haelt die Paketversion und die Changelog-Version zusammen", () => {
    const paket = read("package.json") as { version: string };
    const datei = parseChangelogDatei(read("data/changelog/CHANGELOG.json"));
    const versionen = datei.map((eintrag) => eintrag.version).filter((wert): wert is string => Boolean(wert));
    expect(versionen.length).toBeGreaterThan(0);
    // `package.json` traegt drei Stellen (0.2.0), der Changelog zwei (0.2) — die Nummer im
    // Changelog muss ein Praefix der Paketversion sein, sonst behauptet das Spiel eine Version,
    // die es nicht ausliefert.
    //
    // Waehrend 0.x zaehlt die MITTLERE Stelle die Umbauten: das Sponsormodell ist 0.2, ein
    // Bugfix darin waere 0.2.1. Der Sprung auf 1.0 bleibt dem fertigen Spiel vorbehalten.
    for (const version of new Set(versionen)) {
      expect(paket.version.startsWith(version), `Changelog nennt v${version}, package.json ${paket.version}`).toBe(true);
    }
  });

  it("vergibt sie sparsam — Bugfixes aus der Triage tragen keine", () => {
    const datei = parseChangelogDatei(read("data/changelog/CHANGELOG.json"));
    const triageMitVersion = datei.filter((eintrag) => eintrag.quelle === "triage" && eintrag.version);
    expect(triageMitVersion).toHaveLength(0);
  });
});
