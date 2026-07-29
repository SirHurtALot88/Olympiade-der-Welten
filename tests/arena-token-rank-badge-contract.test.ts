import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DISCIPLINE_DIR = join(process.cwd(), "app/foundation/discipline-stage/arena/disciplines");
const disciplineFiles = readdirSync(DISCIPLINE_DIR).filter((name) => name.endsWith(".tsx"));
const read = (name: string) => readFileSync(join(DISCIPLINE_DIR, name), "utf8");
/** Nur der gerenderte Code — Fliesstext in Kommentaren darf ueber Kringel reden. */
const readCode = (name: string) =>
  read(name)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/**
 * Der Rang eines Teams steht im Feld an GENAU EINER Stelle: im Rang-Badge unter dem
 * Wappen (TokenChrome, `translate(0 r+13)`), und der erscheint nur fuers eigene Team,
 * fuers Podest oder beim Hover.
 *
 * Tennis hatte zusaetzlich Setzkopf-Kringel (①…⑧) ueber dem Token — eine zweite
 * Rangzahl am selben Wappen. Im Gedraenge des Courts sassen die Kringel obendrein
 * optisch am NACHBAR-Token und lasen sich wie dessen Rang.
 */
describe("Arena-Token: keine zweite Rangzahl ueber dem Wappen", () => {
  it("nutzt in keiner Disziplin die eingekreisten Ziffern als Rang-Marke", () => {
    for (const file of disciplineFiles) {
      expect(readCode(file), file).not.toMatch(/[①②③④⑤⑥⑦⑧⑨⑩]/u);
    }
  });

  it("hat den Setzkopf-Block aus dem Tennis-Court entfernt", () => {
    const tennis = read("tennis.tsx");
    expect(tennis).not.toContain("seedMark");
    expect(tennis).not.toContain("const isSeed");
  });

  it("laesst den Rang-Badge unter dem Token unangetastet — dort gehoert er hin", () => {
    // Position: unter dem Wappen. Sichtbarkeit: eigenes Team, Podest oder Hover.
    const benchmark = read("benchmark.tsx");
    expect(benchmark).toContain("const showBadge = badge && (t.isOwn || t.rank <= 3 || hoverIdx === t.idx);");
    expect(benchmark).toContain("<g transform={`translate(0 ${r + 13})`}>");

    // Die drei Felder mit eigener Token-Schleife tragen denselben Vertrag.
    for (const file of ["shared.tsx", "track.tsx"]) {
      expect(read(file), file).toContain("const showBadge = t.isOwn || t.rank <= 3 || hoverIdx === t.idx;");
      expect(read(file), file).toContain("translate(0 ${r + 13})");
    }
    const lamps = read("lamps.tsx");
    expect(lamps).toContain("const showBadge = t.isOwn || t.rank <= 3 || hoverIdx === t.idx;");
    expect(lamps).toContain("y={r + 15}");
  });

  it("zeichnet ueber dem Token nur Auszeichnungen, keine Zahlen", () => {
    // 🏆/👑/Medaille/Beziehungs-Kuerzel sind Aussagen, die der Badge NICHT macht —
    // die duerfen oben bleiben. Eine Rangzahl waere Doppelung.
    for (const file of disciplineFiles) {
      const text = read(file);
      const aboveTokenTexts = [...text.matchAll(/<text[^>]*y=\{-\((?:r|bannerR|R)\s*\+[^}]*\}[^>]*>\s*([\s\S]{0,80}?)<\/text>/g)];
      for (const [, body] of aboveTokenTexts) {
        expect(body, `${file}: ${body.trim()}`).not.toMatch(/t\.rank|\{seedMark\}|#\{/);
      }
    }
  });
});
