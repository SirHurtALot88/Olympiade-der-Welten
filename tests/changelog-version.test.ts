/**
 * GEWUENSCHT: "kannst du bei so grossen patches wie jetzt im anschluss die versionsnummer
 * erhoehen auf z.B: 0.1? und das dann auch im changelog ablegen der gerade gebaut wird?"
 *
 * Der zweite Teil ging still verloren. Das Feld `version` stand in den gepflegten Eintraegen
 * (`data/changelog/eintraege.json`), aber `parseChangelogEintrag` reichte es nicht durch — in der
 * generierten Datei, die der Reiter im Spiel liest, war es nicht mehr da. Die Nummer war totes
 * Datum: gepflegt, nie angezeigt.
 *
 * Die Versionsnummer markiert den EINSCHNITT, nicht den Alltag. Traegt jeder Bugfix eine, sagt sie
 * nichts mehr aus — deshalb ist das Feld optional, und Triage-Eintraege setzen es nie.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseChangelogDatei, parseChangelogEintrag } from "@/lib/changelog/changelog";

const read = (relativePath: string) => JSON.parse(readFileSync(join(process.cwd(), relativePath), "utf8"));

/** Alle gesetzten Versionen aus der generierten Datei — der, die der Reiter im Spiel liest. */
const versionenAusDatei = () =>
  parseChangelogDatei(read("data/changelog/CHANGELOG.json"))
    .map((eintrag) => eintrag.version)
    .filter((wert): wert is string => Boolean(wert));

/** Stellenweise numerisch, damit 0.10 groesser ist als 0.9 — als Text waere es kleiner. */
const alsZahlen = (wert: string) => wert.split(".").map((teil) => Number(teil) || 0);

function vergleicheVersionen(links: string, rechts: string) {
  const a = alsZahlen(links);
  const b = alsZahlen(rechts);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const differenz = (a[i] ?? 0) - (b[i] ?? 0);
    if (differenz !== 0) return differenz;
  }
  return 0;
}

describe("Changelog: die Versionsnummer kommt im Spiel an", () => {
  it("reicht die Version aus einem gepflegten Eintrag durch", () => {
    // Genau das ging vorher verloren.
    expect(parseChangelogEintrag({ datum: "2026-08-01", text: "Grosser Umbau.", version: "0.2" })?.version).toBe("0.2");
  });

  it("laesst sie weg, wenn keine da ist — und stolpert nicht ueber Muell", () => {
    expect(parseChangelogEintrag({ datum: "2026-08-01", text: "Kleiner Fix." })?.version).toBeNull();
    expect(parseChangelogEintrag({ datum: "2026-08-01", text: "Kleiner Fix.", version: "   " })?.version).toBeNull();
    // Eine Zahl ist keine Version: 0.2 als Number waere 0.2, aber "0.20" und "0.2" liessen sich
    // nicht mehr unterscheiden — deshalb nur Strings.
    expect(parseChangelogEintrag({ datum: "2026-08-01", text: "Kleiner Fix.", version: 11 })?.version).toBeNull();
  });

  it("ueberlebt den Weg durch die generierte Datei", () => {
    // Der Reiter liest NICHT die gepflegten Eintraege, sondern die generierte CHANGELOG.json.
    // Genau auf diesem Weg fiel die Version vorher heraus.
    const datei = parseChangelogDatei(read("data/changelog/CHANGELOG.json"));
    const mitVersion = datei.filter((eintrag) => eintrag.version);
    expect(mitVersion.length).toBeGreaterThan(0);
  });

  it("die HOECHSTE Changelog-Version passt zur Paketversion", () => {
    // `package.json` traegt drei Stellen (0.3.0), der Changelog zwei (0.3) — die Patch-Stelle
    // unterscheidet Fixes, und die gehoeren hier gerade nicht hin. Die hoechste Changelog-Nummer
    // muss deshalb ein Praefix der Paketversion sein, sonst behauptet das Spiel eine Version, die
    // es nicht gibt.
    //
    // Bewusst NUR die hoechste: der Changelog ist eine HISTORIE. Aeltere Eintraege tragen
    // legitim aeltere Nummern (v0.2 neben Paket 0.3.0) — eine Pruefung ueber alle Eintraege
    // waere beim naechsten Versionssprung reihenweise rot geworden, ohne dass etwas kaputt ist.
    //
    // Und bewusst die hoechste NUMMER statt des juengsten Datums: zwei Umbauten koennen am
    // selben Tag landen (v0.2 und v0.3 taten das), dann sagt die Datumssortierung nichts.
    const paket = read("package.json") as { version: string };
    const hoechste = versionenAusDatei().sort(vergleicheVersionen).at(-1);

    expect(hoechste, "kein einziger Eintrag traegt eine Version").toBeTruthy();
    expect(
      paket.version === hoechste || paket.version.startsWith(`${hoechste}.`),
      `Changelog nennt zuletzt v${hoechste}, package.json steht auf ${paket.version}`,
    ).toBe(true);
  });

  it("keine Changelog-Version liegt VOR der Paketversion", () => {
    // Die Gegenrichtung: eine Nummer groesser als das, was ausgeliefert wird, verspricht dem
    // Spieler etwas, das es nicht gibt. Fiele beim Nachziehen der Version leicht auf — beim
    // Vergessen des Nachziehens gar nicht.
    const paket = read("package.json") as { version: string };
    for (const version of versionenAusDatei()) {
      expect(
        vergleicheVersionen(version, paket.version) <= 0,
        `Changelog nennt v${version}, ausgeliefert ist erst ${paket.version}`,
      ).toBe(true);
    }
  });

  it("die Oberflaeche zeigt sie auch an", () => {
    // Ohne diesen Weg waere die Version zwar geparst, aber weiterhin unsichtbar — der
    // urspruengliche Fehler in neuer Form. Der Reiter gruppiert nach Version und setzt eine
    // Ueberschrift je Gruppe; geprueft wird deshalb die Gruppierung UND die Beschriftung.
    const host = readFileSync(join(process.cwd(), "app/foundation/changelog/FoundationChangelogHost.tsx"), "utf8");
    expect(host).toContain("gruppiereChangelogNachVersion");
    expect(host).toContain("Ohne Versionsangabe");
  });

  it("Eintraege ohne Version verschwinden nicht — sie bekommen eine ehrliche Ueberschrift", () => {
    // Der aeltere Bestand traegt keine Nummer, weil nachtraeglich nicht mehr feststellbar ist,
    // welche Version ihn enthielt. Eine geratene Zuordnung waere eine Falschaussage; die
    // Sammelueberschrift ist die ehrliche Variante. Faellt sie weg, verschwaende der halbe
    // Changelog aus dem Reiter.
    const ohneVersion = parseChangelogDatei(read("data/changelog/CHANGELOG.json")).filter(
      (eintrag) => !eintrag.version,
    );
    expect(ohneVersion.length).toBeGreaterThan(0);
    for (const eintrag of ohneVersion) {
      expect(eintrag.text.length).toBeGreaterThan(0);
    }
  });
});
