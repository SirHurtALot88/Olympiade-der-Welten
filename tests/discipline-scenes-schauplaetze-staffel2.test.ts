import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DISCIPLINE_SCENES } from "@/lib/foundation/discipline-scenes";

// Zweite Staffel Kulissen-Varianten vom 03.11. (scripts/baue-szenen-varianten-2.py): Chris
// „wirklich andere Settings“ — je Disziplin drei Orte. Die Varianten tauschen NUR eingebettete
// Bilder und haengen eine optische Effekt-Ebene (`window.__fx`) an; Demo-Ablauf, Geometrie und
// Figuren muessen mit der Vorlage identisch bleiben. Genau das prueft dieser Test: das Skript
// jeder Variante ist — ohne Bilder und ohne Effekt-Ebene — Zeichen fuer Zeichen das der Vorlage.
const PUBLIC = path.join(process.cwd(), "public");

const VORLAGE: Record<string, string> = {
  tennis: "court",
  climbing: "wand",
  "speed-schach": "turniersaal",
  "takeshis-castle": "burg",
  showcase: "buehne",
  wettessen: "jahrmarkt",
};

const NEU: Record<string, string[]> = {
  tennis: ["riviera", "dach"],
  climbing: ["fels", "eis"],
  "speed-schach": ["park", "zug"],
  "takeshis-castle": ["eisfestung", "dschungel"],
  showcase: ["festival", "zirkus"],
  wettessen: ["bierzelt"],
};

function skript(id: string, variante: string): string {
  const html = readFileSync(path.join(PUBLIC, "szenen", id, `${variante}.html`), "utf8");
  const teile = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  return teile
    .join("\n")
    // eingebettete JSON-Bloecke normalisieren (Python schreibt Umlaute roh, die Vorlage teils escaped)
    .replace(/^(const \w+ = )(\{.*\});$/gm, (_, kopf: string, json: string) => {
      try {
        return `${kopf}${JSON.stringify(JSON.parse(json))};`;
      } catch {
        return `${kopf}${json};`;
      }
    })
    .replace(/"data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+"/g, '"BILD"')
    .replace(/\nwindow\.__fx = [\s\S]*?\n\};\n$/, "")
    .replace(/\n {2}if \(window\.__fx\) window\.__fx\([^)]*\);/g, "")
    .trimEnd();
}

describe("Pixel-Szenen Staffel 2: andere Schauplaetze, gleiche Szene", () => {
  for (const [id, neu] of Object.entries(NEU)) {
    it(`${id}: drei Orte eingetragen, alle abspielbar`, () => {
      const ids = DISCIPLINE_SCENES[id]!.variants.map((v) => v.id);
      expect(ids).toEqual(expect.arrayContaining([VORLAGE[id], ...neu]));
      expect(ids.length).toBeGreaterThanOrEqual(3);
      expect(DISCIPLINE_SCENES[id]!.variants.every((v) => v.demo)).toBe(true);
    });

    for (const variante of neu) {
      it(`${id}/${variante}: nur Bilder + Effekt-Ebene getauscht, Ablauf identisch zur Vorlage`, () => {
        const html = readFileSync(path.join(PUBLIC, "szenen", id, `${variante}.html`), "utf8");
        expect(html).toContain("window.__fx = ");
        expect(html).not.toMatch(/src="https?:/);
        expect(skript(id, variante)).toBe(skript(id, VORLAGE[id]!));
      });
    }
  }
});
