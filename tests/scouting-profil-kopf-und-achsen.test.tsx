/**
 * GEFRAGT: „bitte das bild auf dem transfermarkt größer machen und die Kacheln daneben nur in
 * 2 zeilen / Das Pow spe men soc kannst du sicher auch hübscher und mehr im velo style
 * darstellen!"
 *
 * Alle drei Punkte sind Layout-Aussagen, und Layout ist genau das, was `tsc` nicht sieht. Die
 * eigentliche Prüfung war der Browser (gemessen: Portrait 240px, Kacheln in 2 Zeilen, kein
 * abgeschnittener Wert bei 1680/1440/1280). Diese Suite hält fest, was daran im Quelltext
 * nachprüfbar ist — damit die Zusagen nicht beim nächsten Umbau still zurückgedreht werden.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { VeloAxisRail } from "@/components/foundation/velo-ui/VeloAxisRail";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");
const css = () => quelle("app/globals.css");
const markt = () => quelle("app/foundation/transfermarkt-v2/TransfermarktV2NewLook.tsx");

/**
 * Der Regelblock GENAU dieses Selektors — nicht der einer Gruppenregel, in der er nur
 * mitläuft. `.nl-market-focus-portrait` steht z. B. zweimal in globals.css: einmal in der
 * gemeinsamen 48px-Basis mit der Listenkachel, einmal als eigene Regel. Eine simple Suche
 * nach „Selektor {" fände die Basis und prüfte damit die falschen 48 Pixel.
 */
function regel(text: string, selektor: string): string {
  for (let start = text.indexOf(`${selektor} {`); start >= 0; start = text.indexOf(`${selektor} {`, start + 1)) {
    // Die komplette Selektorliste dieser Regel: alles seit der vorigen Klammer, ohne Kommentare.
    const grenze = Math.max(text.lastIndexOf("}", start), text.lastIndexOf("{", start));
    const liste = text
      .slice(grenze + 1, start + selektor.length)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .trim();
    if (liste === selektor) {
      return text.slice(start, text.indexOf("}", start));
    }
  }
  throw new Error(`Keine eigene Regel für ${selektor}`);
}

describe("Das Portrait im Scouting-Profil ist größer", () => {
  it("misst 240px statt der alten 196px", () => {
    const block = regel(css(), ".is-new-look .nl-market-focus-portrait");
    expect(block).toContain("width: 240px");
    expect(block).toContain("height: 240px");
    expect(block).not.toContain("196px");
  });

  it("fordert das Bild auch in 240px an, statt eine 196er-Datei hochzuskalieren", () => {
    expect(markt()).toContain('width={240} height={240} className="nl-market-portrait-img"');
  });

  it("hat ein Kürzel, das im großen Kasten nicht verloren wirkt", () => {
    // 13px in einem 240px-Quadrat wäre ein Fleck in der Mitte.
    const block = regel(css(), ".is-new-look .nl-market-focus-portrait .nl-market-portrait-initials");
    expect(block).toContain("font-size: 34px");
  });
});

describe("Die Kacheln daneben stehen in genau zwei Zeilen", () => {
  it("liegen in einem 3-Spalten-Raster — bei fünf Kacheln sind das zwei Zeilen", () => {
    const block = regel(css(), ".is-new-look .nl-market-focus-stats");
    expect(block).toContain("display: grid");
    expect(block).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    // Kein freies Umbrechen mehr: genau das ergab je nach Zahlenlänge drei oder vier Zeilen.
    expect(block).not.toContain("flex-wrap");
  });

  it("lässt die fünfte Kachel den Rest der zweiten Zeile füllen", () => {
    expect(regel(css(), ".is-new-look .nl-market-focus-stats > *:nth-child(5)")).toContain("grid-column: span 2");
  });

  it("gibt der Kachelspalte den Platz neben dem Portrait wirklich", () => {
    // Ohne `flex` schrumpft die Spalte auf ihre Inhaltsbreite — gemessen 233px statt 313px,
    // und dann bricht „11,6 Mio" aus der Kachel.
    expect(regel(css(), ".is-new-look .nl-market-focus-copy")).toContain("flex: 1 1 auto");
  });

  it("schneidet einen unerwartet langen Wert ab, statt das Raster zu sprengen", () => {
    const block = regel(css(), ".is-new-look .nl-market-focus-stats .nl-stat-chip-value");
    expect(block).toContain("white-space: nowrap");
    expect(block).toContain("text-overflow: ellipsis");
  });

  /**
   * Die Umbruchgrenze hängt an der Breite der KARTE, nicht an der des Fensters: derselbe
   * Bildschirm zeigt das Profil in Standard, Breit und Cinema unterschiedlich breit. Eine
   * Media-Query träfe deshalb regelmäßig die falsche Karte.
   */
  it("stellt den Kopf hochkant, wenn die Karte zu schmal wird — per Container-Query", () => {
    const text = css();
    expect(regel(text, ".is-new-look .nl-market-focus-column")).toContain("container-type: inline-size");
    expect(text).toContain("@container nl-focus (max-width: 570px)");
    const block = text.slice(text.indexOf("@container nl-focus (max-width: 570px)"));
    expect(block.slice(0, 700)).toContain("flex-direction: column");
  });
});

describe("POW/SPE/MEN/SOC laufen über die Velo-Achsen-Rail", () => {
  const ACHSEN = [
    { axis: "pow", value: 71, reference: 55 },
    { axis: "spe", value: 42, reference: 50 },
    { axis: "men", value: 28, reference: 44 },
    { axis: "soc", value: 12, reference: 39 },
  ] as const;

  const markup = () =>
    renderToStaticMarkup(<VeloAxisRail entries={[...ACHSEN]} max={100} referenceLabel="Team Top-6 Ø" />);

  it("zeigt alle vier Achsen mit Wert und Note", () => {
    const html = markup();
    for (const label of ["POW", "SPE", "MEN", "SOC"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain(">71<");
    // 71 → S, 42 → C, 28 → D, 12 → F (getCoreStatGrade, an der gemessenen Verteilung verankert).
    expect(html).toContain("is-grade-s");
    expect(html).toContain("is-grade-c");
    expect(html).toContain("is-grade-d");
    expect(html).toContain("is-grade-f");
  });

  it("füllt das Meter am Wert, nicht an der Note", () => {
    // Zwei getrennte Kanäle: die Farbe sagt „wie gut", die Länge „wie viel".
    expect(markup()).toContain("width:71%");
  });

  it("setzt die Kader-Referenz als Marke — dieselbe Zahl, die der Radar als Ghost zeichnet", () => {
    const html = markup();
    expect(html).toContain("velo-axis-rail-mark");
    expect(html).toContain("left:55%");
  });

  it("nennt den Abstand zum Kader im Klartext, nicht nur als Bild", () => {
    const html = markup();
    expect(html).toContain("Team Top-6 Ø 55, +16");
    expect(html).toContain("Team Top-6 Ø 39, −27");
  });

  it("lässt eine fehlende Referenz einfach weg, statt 0 zu zeichnen", () => {
    const html = renderToStaticMarkup(<VeloAxisRail entries={[{ axis: "pow", value: 50 }]} />);
    expect(html).not.toContain("velo-axis-rail-mark");
    expect(html).toContain("POW");
  });

  it("verschwindet ganz, wenn kein einziger Wert freigescoutet ist", () => {
    expect(renderToStaticMarkup(<VeloAxisRail entries={[]} />)).toBe("");
  });

  it("trägt jede Achse ihre eigene Farbe — das ist der Velo-Teil", () => {
    const html = markup();
    for (const achse of ["is-pow", "is-spe", "is-men", "is-soc"]) {
      expect(html).toContain(achse);
    }
    const text = css();
    expect(regel(text, ".velo-axis-rail-row.is-pow")).toContain("--velo-axis");
    expect(regel(text, ".velo-axis-rail-row.is-soc")).toContain("--velo-axis");
  });

  it("ersetzt die flachen Tier-Pillen, statt neben ihnen zu stehen", () => {
    // Zwei Darstellungen derselben vier Zahlen wären genau die Doppelung, die die Karte
    // vorher unruhig gemacht hat.
    expect(markt()).toContain("<VeloAxisRail");
    expect(markt()).not.toContain("nl-market-attr-chip");
    expect(css()).not.toContain(".nl-market-attr-chip");
  });
});
