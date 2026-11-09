import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
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
    for (const d of ["tennis", "fechten", "speed-schach", "showcase", "eiskunstlauf", "breaking", "i-spy", "gewichtheben", "basketball", "football", "hockey"]) {
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
    // Football: Feld W*0.04..W*0.96 x 50..H-50; Hockey: RINK-Rundweg
    expect(motor).toContain("ctx.strokeRect(W*0.04,50,W*0.92,H-100);");
    expect(skript).toContain("FB_FELD = (round(LW * 0.04), 50, round(LW * 0.96), LH - 50)");
    expect(motor).toContain("l:W*0.045, r:W*0.955, o:44, u:H-44,");
    expect(skript).toContain('HK_K = {"l": LW * 0.045, "r": LW * 0.955, "o": 44, "u": LH - 44, "ecke": 64}');
    // Spurt: Bahnband H*0.14..H*0.94; Staffel: Oval aus bahnPfad()
    expect(motor).toContain("const oben=H*0.14, unten=H*0.94;");
    expect(skript).toContain("SP_OBEN, SP_UNTEN = round(LH * 0.14), round(LH * 0.94)");
    expect(motor).toContain("const OVAL_CX=W/2, OVAL_CY=H*0.615;");
    expect(motor).toContain("const OVAL_HL=263;");
    expect(motor).toContain("const OVAL_R_AUSSEN=288;");
    expect(motor).toContain("const OVAL_BAHN_ABSTAND=26;");
    expect(motor).toContain("const OVAL_STAUCH=0.57;");
    expect(skript).toContain("ST_CX, ST_CY, ST_HL, ST_RA, ST_BA, ST_N, ST_ST = LW / 2, LH * 0.615, 263, 288, 26, 6, 0.57");
    expect(kulissen.spurt?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(kulissen.staffel?.length ?? 0).toBeGreaterThanOrEqual(1);
    // Climbing: Wandkachel laeuft mit der Kamera (gleicher Versatz wie die gezeichneten Risse).
    // Kulissen-QS 08.11. (Batch 14): `versatzY` ist seit der Drei-Zonen-Kulisse eine eigene
    // Variable (auch fuer die ferne Parallax-Ebene und die Boden-/Top-out-Zonen gebraucht),
    // bleibt aber wortwoertlich `camViewV().oben*cam.zoom`.
    expect(kulissen.climbing?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(motor).toContain("const kv=camViewV(), versatzY=kv.oben*cam.zoom;");
    expect(motor).toContain("const mitKulisse=kulisseZeichnen(versatzY);");
    // Gewichtheben: Kulisse nur im Hantel-Duell (bodenHeben), der Sandsack-Pfad bleibt aus
    expect(motor).toMatch(/gewichthebenSandsack\s*:\s*0/);
  });

  it("Zeitfahren (Batch 8): alle elf Streckenkarten, Kulisse nur Panorama + Asphalt, Profil aus gelaende", () => {
    // scripts/baue-kulisse-zeitfahren.py: Kopfstreifen bis H*0.14, Asphalt im Bahnband bis H*0.94 —
    // dasselbe Band wie bodenSpurtGerade()/bodenZeitfahren(). Das Hoehenprofil zeichnet allein der
    // Motor aus BAHN_ART["time-trial"].gelaende; das Demo-Profil der Szene kommt nicht mit.
    const varianten = DISCIPLINE_SCENES["time-trial"].variants.map((v) => v.id);
    expect(varianten.length).toBe(11);
    expect((kulissen["time-trial"] ?? []).map((k) => k.id).sort()).toEqual([...varianten].sort());
    for (const id of varianten) {
      const quelle = path.join(wurzel, "data/generated/kulissen-quellen/time-trial", `${id}.png`);
      expect(existsSync(quelle), quelle).toBe(true);
      const png = readFileSync(quelle);
      expect(png.readUInt32BE(16)).toBe(1240);
      expect(png.readUInt32BE(20)).toBe(470);
    }
    const motor = readFileSync(path.join(wurzel, "public/mockups/battle-mode.engine.js"), "utf8");
    const start = motor.indexOf("function bodenZeitfahren(){");
    const koerper = motor.slice(start, motor.indexOf("const ZW_UEBERHANG_MAX", start));
    expect(koerper).toContain("bodenSpurtGerade();");
    expect(koerper).toContain("const oben=H*0.14, unten=H*0.94;");
    expect(koerper).toContain("const zonen=BA().gelaende;");
    const skript = readFileSync(path.join(wurzel, "scripts/baue-kulisse-zeitfahren.py"), "utf8");
    expect(skript).toContain("ZF_OBEN, ZF_UNTEN = round(LH * 0.14), round(LH * 0.94)");
    // Die Physik des Gelaendes kennt keine Kulisse.
    for (const fn of ["function gelaendeFaktor(", "function gelaendeZehrFaktor("]) {
      const i = motor.indexOf(fn);
      expect(i, fn).toBeGreaterThan(-1);
      expect(motor.slice(i, motor.indexOf("\n  }", i))).not.toMatch(/kulisse/i);
    }
  });

  it("Mini-DM-FFA (Batch 9): Vier-Ecken-Leinwand vor der Kulisse, reine Anzeige", () => {
    // mdffaBuehne zeichnet das fertig gerechnete Ereignis (runde.takte) auf #mdffaCv — ohne rr(), ohne
    // Saat, ohne Spielzeit t. Deklariert vor reset(), das sie beim Verlassen von Mini-DM abbaut.
    const motor = readFileSync(path.join(wurzel, "public/mockups/battle-mode.engine.js"), "utf8");
    const start = motor.indexOf("const mdffaBuehne=(()=>{");
    expect(start).toBeGreaterThan(-1);
    expect(start).toBeLessThan(motor.indexOf("  function reset(){"));
    const ende = motor.indexOf("return {einlauf, titel, runde, takt, rundenEnde, punkte, endstand, abbau};", start);
    expect(ende).toBeGreaterThan(start);
    const buehne = motor.slice(start, ende);
    expect(buehne).not.toMatch(/\brr\(/);
    expect(buehne).not.toMatch(/\bseed\b/);
    expect(buehne).not.toMatch(/FORMKARTE|MUTATOREN|spieleMiniDmFfaEvent/);
    for (const aufruf of ["mdffaBuehne.einlauf(", "mdffaBuehne.runde(", "mdffaBuehne.takt(", "mdffaBuehne.endstand(", "mdffaBuehne.abbau("]) {
      expect(motor, aufruf).toContain(aufruf);
    }
    const html = readFileSync(path.join(wurzel, "public/mockups/battle-mode.html"), "utf8");
    expect(html).toContain('id="mdffaCv" width="1240" height="470"');
    expect(kulissen["mini-dm"]?.length ?? 0).toBeGreaterThanOrEqual(2);
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

// PIXELLAB-REQUISITEN UND TAKESHI-BODEN (Batch 10, 08.11.): reiner Asset-Tausch. Der Motor zeichnet
// viele Kacheln mit naturalWidth/naturalHeight oder festen Quell-Ausschnitten; deshalb muss jede
// neue Datei exakt die Pixelmasse der alten LPC/Kenney-Datei haben, und die Ausschnitte im Motor
// bleiben dieselben Zahlen.
const REQUISITEN_MASSE: Record<string, [number, number]> = {
  "arena/hind_huerde.png": [32, 32], "arena/hind_balken.png": [64, 32], "arena/hind_wand.png": [32, 64],
  "arena/hind_seil.png": [64, 32], "arena/hind_wasser_l.png": [32, 32], "arena/hind_wasser_r.png": [32, 32],
  "arena/hind_mauer.png": [40, 32], "arena/hind_heu.png": [64, 32], "arena/hind_feuer.png": [160, 32],
  "arena/falle_tuer.png": [32, 64], "arena/falle_strickleiter.png": [64, 64], "arena/falle_spitzen.png": [96, 128],
  "arena/falle_walze.png": [32, 32], "arena/deko_rad.png": [32, 32], "arena/falle_fass.png": [32, 64],
  "arena/burg_mauer.png": [160, 64], "arena/burg_turm.png": [96, 150], "arena/burg_tor.png": [96, 150],
  "arena/deko_banner.png": [192, 80], "arena/deko_pranger.png": [64, 88], "arena/deko_stock.png": [64, 38],
  "arena/deko_holz.png": [64, 64], "arena/zaun_holz.png": [32, 32], "arena/baum_1.png": [36, 62],
  "arena/baum_2.png": [32, 60], "arena/baum_3.png": [30, 59], "arena/baum_4.png": [30, 42],
  "basketball/korb_topdown.png": [64, 64], "basketball/ball.png": [32, 32],
  "football/ball_football.png": [14, 16], "football/helmet_white1.png": [19, 19],
  "football/helmet_white2.png": [21, 19], "football/helmet_white3.png": [26, 22],
  "buehne/schach_weiss.png": [288, 96], "buehne/schach_schwarz.png": [288, 96],
};
const TAKESHI_BODEN = ["boden_wiese", "boden_wald", "boden_pfad", "boden_kies", "boden_schlamm", "boden_pflaster",
  "boden_see", "boden_hang", "boden_sumpf", "boden_eis"];

function pngMass(datei: string): [number, number] {
  const png = readFileSync(datei);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

describe("PixelLab-Requisiten und Takeshi-Bodenkacheln (Batch 10)", () => {
  it("jede getauschte Datei hat die Pixelmasse der alten und ist in quellen.json als PixelLab belegt", () => {
    for (const [rel, mass] of Object.entries(REQUISITEN_MASSE)) {
      const datei = path.join(wurzel, "public/sprites", rel);
      expect(pngMass(datei), rel).toEqual(mass);
      const [ordner, name] = rel.split("/");
      const quellen = JSON.parse(readFileSync(path.join(wurzel, "public/sprites", ordner, "quellen.json"), "utf8"));
      expect(quellen[name]?.paket, rel).toBe("PixelLab");
    }
  });

  it("die neun Takeshi-Bodenarten (und das Slip-Way-Eis) sind 32er-PixelLab-Draufsicht-Kacheln", () => {
    const quellen = JSON.parse(readFileSync(path.join(wurzel, "public/sprites/arena/quellen.json"), "utf8"));
    for (const n of TAKESHI_BODEN) {
      expect(pngMass(path.join(wurzel, "public/sprites/arena", `${n}.png`)), n).toEqual([32, 32]);
      expect(quellen[`${n}.png`]?.paket, n).toBe("PixelLab");
      expect(quellen[`${n}.png`]?.quelle, n).toMatch(/create-tiles-pro/);
    }
  });

  it("die Bodenkacheln setzen sich nahtlos fort (Randsprung hoechstens doppelt so gross wie innen)", async () => {
    for (const n of TAKESHI_BODEN) {
      const { data, info } = await sharp(path.join(wurzel, "public/sprites/arena", `${n}.png`))
        .removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const w = info.width, h = info.height, px = (x: number, y: number, c: number) => data[(y * w + x) * 3 + c];
      const d = (x1: number, y1: number, x2: number, y2: number) =>
        Math.abs(px(x1, y1, 0) - px(x2, y2, 0)) + Math.abs(px(x1, y1, 1) - px(x2, y2, 1)) + Math.abs(px(x1, y1, 2) - px(x2, y2, 2));
      let innen = 0, rand = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w - 1; x++) innen += d(x, y, x + 1, y) / (h * (w - 1));
      for (let y = 0; y < h - 1; y++) for (let x = 0; x < w; x++) innen += d(x, y, x, y + 1) / ((h - 1) * w);
      for (let y = 0; y < h; y++) rand += d(w - 1, y, 0, y) / h;
      for (let x = 0; x < w; x++) rand += d(x, h - 1, x, 0) / w;
      expect(rand / innen, n).toBeLessThan(2);
    }
  });

  it("der Spurt-Wassergraben ist oben und unten offen und senkrecht nahtlos (durchgehender Graben)", async () => {
    for (const seite of ["l", "r"]) {
      const { data, info } = await sharp(path.join(wurzel, "public/sprites/arena", `hind_wasser_${seite}.png`))
        .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const w = info.width, h = info.height;
      // oberste und unterste Zeile: gleiche Deckung, damit uebereinander gesetzte Felder anschliessen
      for (let x = 0; x < w; x++) {
        expect(data[x * 4 + 3] > 0, `${seite} x=${x}`).toBe(data[((h - 1) * w + x) * 4 + 3] > 0);
      }
    }
  });

  it("der Korbring sitzt dort, wo der Ballflug hinzielt (Ringmitte wie beim alten Korb)", async () => {
    const { data, info } = await sharp(path.join(wurzel, "public/sprites/basketball/korb_topdown.png"))
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let sx = 0, sy = 0, n = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a > 128 && r > 180 && g > 60 && g < 170 && b < 90) { sx += x; sy += y; n++; }
    }
    expect(n).toBeGreaterThan(10);
    expect(Math.abs(sx / n - 31.6)).toBeLessThan(1);
    expect(Math.abs(sy / n - 13.4)).toBeLessThan(1);
  });

  it("die Quell-Ausschnitte im Motor sind unveraendert (kein Mechanik- oder Geometrie-Eingriff)", () => {
    const motor = readFileSync(path.join(wurzel, "public/mockups/battle-mode.engine.js"), "utf8");
    expect(motor).toContain("ctx.drawImage(aBild.falle_spitzen,0,96,32,32,");
    expect(motor).toContain("ctx.drawImage(aBild.falle_strickleiter,8,0,24,64,");
    expect(motor).toContain("ctx.drawImage(m,k*40,8,36,56,");
    expect(motor).toContain("ctx.drawImage(bn,0,0,96,80,");
    expect(motor).toContain("ctx.drawImage(f,fr*32,0,32,32,");
    expect(motor).toContain("ctx.drawImage(bkBild.korb_topdown,-28,-20,56,56)");
    expect(motor).toContain("ctx.drawImage(sbBild[blatt],SCHACH_IDX[p[1]]*48,0,48,48,");
  });
});
