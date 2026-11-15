import { existsSync, readFileSync } from "node:fs";
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
  const ZWEI_SCHAUPLAETZE: string[] = ["basketball", "hockey", "football", "eiskunstlauf", "fechten", "battlefield"];
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

  // KEINE DEMOS MEHR (11.11.): im Spiel steht nur die saubere Kulisse, nie die Demo-Seite oder ihr
  // Standbild mit eingebrannten Demo-Figuren. `kulisse` ist entweder eine vorhandene Datei oder
  // bewusst null -- und null nur dort, wo es die Datei wirklich nicht gibt (OHNE_KULISSE exakt).
  for (const scene of Object.values(DISCIPLINE_SCENES)) {
    it(`${scene.disciplineId}: Kulisse je Variante vorhanden bzw. bewusst leer`, () => {
      for (const v of scene.variants) {
        const erwartet = path.join(PUBLIC, "sprites", "kulissen", scene.disciplineId, `${v.id}.jpg`);
        if (v.kulisse) {
          expect(v.kulisse.startsWith("/sprites/kulissen/"), v.kulisse).toBe(true);
          expect(existsSync(path.join(PUBLIC, v.kulisse)), v.kulisse).toBe(true);
        } else {
          expect(existsSync(erwartet), `${erwartet} existiert -- aus OHNE_KULISSE streichen`).toBe(false);
        }
      }
    });
  }

  it("Climbing (Pilot) hat fuer jede Variante eine saubere Kulisse", () => {
    expect(DISCIPLINE_SCENES.climbing!.variants.every((v) => v.kulisse)).toBe(true);
  });

  it("die Pixel-Arena spielt keine Demo-Seite und zeigt kein Demo-Standbild mehr", () => {
    const quelle = readFileSync(
      path.join(process.cwd(), "app", "foundation", "discipline-stage", "DisciplinePixelScene.tsx"),
      "utf8",
    );
    const code = quelle.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/<iframe/);
    expect(code).not.toMatch(/\.demo\b/);
    expect(code).not.toMatch(/\.poster\b/);
    expect(code).not.toMatch(/Demo-Figuren/);
  });
});
