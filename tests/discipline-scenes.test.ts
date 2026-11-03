import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DISCIPLINE_SCENES } from "@/lib/foundation/discipline-scenes";

// Jede eingetragene Szenen-Variante muss als Datei unter public/ liegen — sonst zeigt die
// Pixel-Arena ein kaputtes Standbild bzw. ein leeres iframe.
const PUBLIC = path.join(process.cwd(), "public");

describe("Pixel-Szenen-Registry", () => {
  it("deckt alle 20 Disziplinen ab", () => {
    expect(Object.keys(DISCIPLINE_SCENES)).toHaveLength(20);
  });

  it("jede Disziplin hat mindestens eine abspielbare Szene (Spurt seit 03.11. auch)", () => {
    for (const scene of Object.values(DISCIPLINE_SCENES)) {
      expect(scene.variants.some((v) => v.demo), scene.disciplineId).toBe(true);
    }
  });

  // Gestaffelter Ausbau vom 03.11. (Chris: „wirklich andere Settings“, nicht nur Tag/Nacht):
  // diese Disziplinen tragen neben der Original-Kulisse einen zweiten Schauplatz.
  const ZWEI_SCHAUPLAETZE: string[] = ["basketball", "hockey", "football", "eiskunstlauf"];
  for (const id of ZWEI_SCHAUPLAETZE) {
    it(`${id}: zweiter Schauplatz eingetragen`, () => {
      const scene = DISCIPLINE_SCENES[id]!;
      expect(scene.variants.length).toBeGreaterThanOrEqual(2);
      expect(scene.variants.every((v) => v.demo)).toBe(true);
    });
  }

  for (const scene of Object.values(DISCIPLINE_SCENES)) {
    it(`${scene.disciplineId}: Varianten eindeutig, Dateien vorhanden`, () => {
      const ids = scene.variants.map((v) => v.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const v of scene.variants) {
        expect(existsSync(path.join(PUBLIC, v.poster)), v.poster).toBe(true);
        if (v.demo) expect(existsSync(path.join(PUBLIC, v.demo)), v.demo).toBe(true);
      }
    });
  }
});
