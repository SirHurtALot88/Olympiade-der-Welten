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

  it("Buehnen-Kulissen (Batch 2/3) passen zur Motor-Geometrie (Tennis-Trapez, Eis-Rundweg, I-Spy-Steg)", () => {
    // scripts/baue-kulisse-buehnen.py rechnet mit tennisPlatzGeometrie() (topY=H*0.17, botY=H*0.615,
    // halbe Breite W*0.145..W*0.30). Aendert sich die Motor-Geometrie, muss die Kulisse neu gebaut werden.
    for (const d of ["tennis", "fechten", "speed-schach", "showcase", "eiskunstlauf", "breaking", "i-spy", "gewichtheben", "basketball"]) {
      expect(kulissen[d]?.length ?? 0, d).toBeGreaterThanOrEqual(2);
    }
    const motor = readFileSync(path.join(wurzel, "public/mockups/battle-mode.engine.js"), "utf8");
    expect(motor).toContain("const topY=H*0.17, botY=H*0.615, netY=(topY+botY)/2;");
    expect(motor).toContain("const topHalfAus=W*0.145, botHalfAus=W*0.30;");
    const skript = readFileSync(path.join(wurzel, "scripts/baue-kulisse-buehnen.py"), "utf8");
    expect(skript).toContain("T_TOP, T_BOT = LH * 0.17, LH * 0.615");
    expect(skript).toContain("T_HALB_TOP, T_HALB_BOT = LW * 0.145, LW * 0.30");
    // Eiskunstlauf: das Eis der Kulisse liegt im eisRundweg(k) aus kuerFlaeche()
    expect(motor).toContain("return {cx:W*0.5, cy:H*0.5, ax:W*0.35, ay:H*0.28};");
    expect(motor).toContain("const k={l:F.cx-F.ax*1.18,r:F.cx+F.ax*1.18,o:F.cy-F.ay*1.34,u:F.cy+F.ay*1.34,ecke:56};");
    // I-Spy: die beiden Raeume enden am Steg W*0.465 / W*0.535
    expect(motor).toContain("const stegX0=W*0.465, stegX1=W*0.535;");
    // Basketball: das Feld der Kulisse liegt auf W*0.06..W*0.94 x 60..H-60
    expect(motor).toContain("ctx.fillRect(W*0.06,60,W*0.88,H-120);");
    expect(skript).toContain("BB_FELD = (round(LW * 0.06), 60, round(LW * 0.94), LH - 60)");
    // Gewichtheben: Kulisse nur im Hantel-Duell (bodenHeben), der Sandsack-Pfad bleibt aus
    expect(motor).toMatch(/gewichthebenSandsack\s*:\s*0/);
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
