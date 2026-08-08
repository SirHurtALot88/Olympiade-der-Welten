/**
 * GEMELDET: „bitte darauf achten, dass die schwarze schrift auf schwarzem background weg ist,
 * hier in der spieler liste zb müsste schrift weiß sein bei PPs!" und „MVS bitte die überschrift
 * nicht transaparent!"
 *
 * Zwei verschiedene Fehler, beide in den Kennzahl-Spalten der Spielerliste:
 *
 * 1. KÖRPERZELLEN. Die Spaltenfarbe (`--nl-accent` / `--nl-gold` / `--nl-bronze`) überschrieb den
 *    `background` der `.heat-band-N`-Klasse — deren `color` aber nicht. `.heat-band-N` setzt eine
 *    DUNKLE Schrift, weil sie für ihren eigenen HELLEN Heat-Grund gedacht ist
 *    (`--heat-elite-text: #101929`). Auf dem dunklen Spalten-Ton blieb Schwarz auf Schwarz stehen.
 *    Im Browser gemessen: PPs 11 von 40 Zellen unter 4,5:1, die schlechtesten bei 1,19:1.
 *
 * 2. KOPFZEILE. Sie ist `position: sticky` und bekam ihren Ton als `color-mix(…, transparent)` —
 *    also mit Loch. Beim Scrollen liefen die Zeilen darunter durch die Beschriftung; im
 *    gemeldeten Screenshot stand „23,9 / #28" mitten im Wort MVS.
 *
 * Dazu fiel beim Messen die aktive Sortierspalte auf: ihr Kopf steht auf dem VOLLEN hellen Blau
 * (dunkle Schrift richtig), ihre Zellen nahmen davon aber nur 45 % — mittleres Schiefergrau,
 * dieselbe dunkle Schrift, gemessene 2,8:1.
 *
 * Nach dem Fix im Browser gemessen (Spielerliste, 45 sichtbare Zeilen je Spalte):
 *   Köpfe   PPs 4,85 · OVR 6,70 · MVS 6,81
 *   Zellen  PPs min 14,19 · MVS min 14,19 · OVR min 4,98 — keine einzige unter 4,5:1.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const CSS = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

/** Regelrumpf zu einem Selektor — sonst prüft man die Nachbarregeln mit. */
function regel(selektor: string): string {
  const start = CSS.indexOf(`${selektor} {`);
  expect(start, `Regel fehlt: ${selektor}`).toBeGreaterThanOrEqual(0);
  return CSS.slice(start, CSS.indexOf("}", start));
}

describe("Kopfzeilen der Kennzahl-Spalten sind deckend", () => {
  const koepfe = [
    [".is-new-look .nl-players-th.is-highlight-pps", "--nl-accent"],
    [".is-new-look .nl-players-th.is-highlight-ovr", "--nl-gold"],
    [".is-new-look .nl-players-th.is-highlight-mvs", "--nl-bronze"],
  ] as const;

  it.each(koepfe)("%s mischt über das Panel statt über transparent", (selektor) => {
    const rumpf = regel(selektor);
    expect(rumpf).toContain("var(--nl-panel-2)");
    // Ein `transparent` im Hintergrund wäre exakt das gemeldete Loch.
    expect(rumpf).not.toMatch(/background:[^;]*transparent/);
  });

  it("hellt Bronze für die Beschriftung auf — der Grundton trägt als 10px-Versalie nicht", () => {
    expect(regel(".is-new-look .nl-players-th.is-highlight-mvs")).toContain(
      "color-mix(in srgb, var(--nl-bronze) 62%, #ffffff)",
    );
  });
});

describe("Körperzellen setzen ihre Schriftfarbe selbst", () => {
  const zellen = [
    ".is-new-look td.nl-players-td-metric.nl-players-td-pps",
    ".is-new-look td.nl-players-td-metric.nl-ptable-ovr-cell",
    ".is-new-look td.nl-players-td-metric.nl-ptable-mvs-cell",
  ];

  it.each(zellen)("%s setzt eine helle Schrift", (selektor) => {
    // Ohne diese Zeile bleibt die dunkle `.heat-band-N`-Schrift stehen — der gemeldete Fehler.
    expect(regel(selektor)).toContain("color: var(--nl-ink);");
  });

  it("die Heat-Bänder setzen weiterhin ihre eigene dunkle Schrift", () => {
    // Nicht dort reparieren: die Klasse ist anderswo mit ihrem hellen Grund korrekt.
    expect(regel(".heat-band-8,\n.heat-elite")).toContain("color: var(--heat-best-text)");
  });
});

describe("Die aktive Sortierspalte trägt ihre dunkle Schrift", () => {
  it("wäscht hell genug, dass dunkle Schrift darauf gilt", () => {
    const rumpf = regel(".is-new-look td.is-active-sort");
    expect(rumpf).toContain("color: #0b1220;");
    expect(rumpf).toContain("#7fa2d1) 78%");
    // 45 % ergaben ein mittleres Schiefergrau — dort war dieselbe Schrift bei 2,8:1.
    expect(rumpf).not.toContain("45%");
  });

  it("hält Kopf und Zellen beim selben Wasch, statt sie auseinanderlaufen zu lassen", () => {
    // Fünf Stellen wiederholen den Wasch (generisch + die drei Kennzahl-Spalten +
    // T3: PPs/MVS im "Saison noch leer"-Zustand, aktiv sortiert — derselbe Wasch
    // statt eines sechsten, eigenen Tons, damit "aktiv sortiert" immer dasselbe
    // Signal bleibt, auch wenn die Spalte gerade noch leer ist).
    expect(CSS.split("#7fa2d1) 78%").length - 1).toBe(5);
    expect(CSS).not.toContain("#7fa2d1) 45%");
  });
});
