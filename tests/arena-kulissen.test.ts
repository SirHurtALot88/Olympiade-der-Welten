import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { DISCIPLINE_SCENES } from "@/lib/foundation/discipline-scenes";

// ARENA-KULISSEN (03.11.): public/mockups/battle-mode.kulissen.js ist aus der Szenen-Registry
// generiert (scripts/baue-arena-kulissen.py). Dieser Test haelt fest, dass die eingecheckte Liste
// zur Registry passt, jedes Bild existiert und die Battle-Mode-Huelle die Datei VOR dem Motor laedt
// (der Motor liest window.__ARENA_KULISSEN beim Start).

const wurzel = process.cwd();

function ladeKulissen(): Record<string, { id: string; label: string; bild: string; dunkel: number }[]> {
  const code = readFileSync(path.join(wurzel, "public/mockups/battle-mode.kulissen.js"), "utf8");
  const fenster: { __ARENA_KULISSEN?: unknown } = {};
  new Function("window", code)(fenster);
  return fenster.__ARENA_KULISSEN as Record<string, { id: string; label: string; bild: string; dunkel: number }[]>;
}

describe("Arena-Kulissen fuer die Battle Arena", () => {
  const kulissen = ladeKulissen();

  it("TDM und Mini-DM haben mehrere Kulissen", () => {
    expect(kulissen.tdm?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(kulissen["mini-dm"]?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("Battlefield hat Kulissen in Leinwandgroesse aus der eigenen Quelle (Landmarken auf den Motor-Orten)", () => {
    // scripts/bestelle-kulisse-battlefield.py: Szene auf den Ortsabstand des Motors skaliert
    // (ARENA_DOMINATION.battlefield.orte bei y=85/235/385), Quelle 1240x470 verlustfrei.
    expect(kulissen.battlefield?.length ?? 0).toBeGreaterThanOrEqual(2);
    for (const k of kulissen.battlefield ?? []) {
      const quelle = path.join(wurzel, "data/generated/kulissen-quellen/battlefield", `${k.id}.png`);
      expect(existsSync(quelle), quelle).toBe(true);
      const png = readFileSync(quelle);
      expect(png.readUInt32BE(16)).toBe(1240);
      expect(png.readUInt32BE(20)).toBe(470);
    }
    const motor = readFileSync(path.join(wurzel, "public/mockups/battle-mode.engine.js"), "utf8");
    expect(motor).toContain('orte:[{name:"Nord",fy:85/470},{name:"Mitte",fy:0.5},{name:"Süd",fy:385/470}]');
  });

  it("jede Kulisse ist eine Variante der Szenen-Registry, und ihr Bild liegt unter public/", () => {
    for (const [dId, liste] of Object.entries(kulissen)) {
      const varianten = DISCIPLINE_SCENES[dId]?.variants.map((v) => v.id) ?? [];
      for (const k of liste) {
        expect(varianten, `${dId}/${k.id}`).toContain(k.id);
        expect(existsSync(path.join(wurzel, "public", k.bild)), k.bild).toBe(true);
        expect(k.dunkel).toBeGreaterThanOrEqual(0);
        expect(k.dunkel).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it("die Huelle laedt die Kulissen vor dem Motor", () => {
    const html = readFileSync(path.join(wurzel, "public/mockups/battle-mode.html"), "utf8");
    const kulisse = html.indexOf('src="battle-mode.kulissen.js"');
    const motor = html.indexOf('src="battle-mode.engine.js"');
    expect(kulisse).toBeGreaterThan(-1);
    expect(kulisse).toBeLessThan(motor);
  });

  it("der Motor waehlt ohne rr() und faellt ohne Liste auf den alten Boden zurueck", () => {
    const motor = readFileSync(path.join(wurzel, "public/mockups/battle-mode.engine.js"), "utf8");
    const start = motor.indexOf("function kulisseWaehlen(");
    const ende = motor.indexOf("function kulisseZeichnen(");
    expect(start).toBeGreaterThan(-1);
    const waehlen = motor.slice(start, ende);
    expect(waehlen).not.toMatch(/\brr\(/);
    expect(waehlen).not.toMatch(/\bseed\b/);
    expect(motor).toContain("window.__ARENA_KULISSEN&&typeof window.__ARENA_KULISSEN===\"object\"");
  });
});
