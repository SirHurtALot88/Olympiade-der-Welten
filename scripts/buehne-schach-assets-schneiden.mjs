// Schneidet die Schachfiguren-Kacheln fuer das Speed-Schach-Buehnenbild aus dem
// Catacomb-Chess-Blatt (OpenGameArt, CC0) und legt sie nach public/sprites/buehne/.
// Reproduzierbar: das Skript laedt die Quelle selbst und schneidet an festen,
// aus dem Alphakanal abgelesenen Koordinaten (Toleranz 20 gegen den Hintergrundton
// (169,156,152) — s. docs/design/takeshi-schach-optik-gameplay-plan-05-09.md A.2).
//
//   node scripts/buehne-schach-assets-schneiden.mjs
//
// Ergebnis: schach_weiss.png (288x96, Zeile 0 = Bauer/Turm/Springer/Laeufer/Dame/
// Koenig als 48x48-Zellen unten buendig zentriert, Zeile 1 = die zweite Zeichnungs-
// variante des Blatts, von der Engine ungenutzt) und schach_schwarz.png (dieselbe
// Zeichnung, Cremefuellung auf Dunkelgrau umgefaerbt).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const ZIEL = 'public/sprites/buehne';
const QUELLE_URL = 'https://opengameart.org/sites/default/files/chess_clean.png';
const BG = [169, 156, 152];
const TOL = 20;
const ZELLE = 48;

// [Figur, SCHACH_IDX] — Reihenfolge, in der die Engine sie im Blatt erwartet
// (schachStellung() liest 'p','r','n','b','q','k').
const FIGUREN = ['p', 'r', 'n', 'b', 'q', 'k'];
// Spalten im Blatt (x0..x1), aus dem Alphakanal gelesen (nicht geschaetzt).
const SPALTEN = [
  [246, 288], // Bauer
  [297, 339], // Turm
  [348, 390], // Springer
  [401, 443], // Laeufer
  [454, 496], // Dame
  [507, 549], // Koenig
];
// Zwei Zeilen im Blatt: Reihe 1 (die von der Engine gezeichnete Zeichnung),
// Reihe 2 (Alternativvariante, mitgeschnitten, aber ungenutzt).
const ZEILEN = [
  [15, 75],
  [78, 140],
];

function istHintergrund(r, g, b) {
  return Math.abs(r - BG[0]) <= TOL && Math.abs(g - BG[1]) <= TOL && Math.abs(b - BG[2]) <= TOL;
}

async function main() {
  const arbeit = mkdtempSync(join(tmpdir(), 'buehne-schach-'));
  console.log('Arbeitsordner:', arbeit);
  const quelle = join(arbeit, 'chess_clean.png');
  execFileSync('curl', ['-sS', '-o', quelle, QUELLE_URL], { stdio: 'inherit' });

  const bild = sharp(quelle).ensureAlpha();
  const { data, info } = await bild.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Hintergrund -> transparent (Toleranz 20), sonst unveraendert.
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    if (istHintergrund(r, g, b)) data[o + 3] = 0;
  }

  // Zwei Zielblaetter (weiss/schwarz), je 288x96 = 6 Spalten x 2 Zeilen zu 48x48,
  // transparent vorbelegt.
  const zielW = FIGUREN.length * ZELLE, zielH = ZEILEN.length * ZELLE;
  const weiss = Buffer.alloc(zielW * zielH * 4, 0);
  const schwarz = Buffer.alloc(zielW * zielH * 4, 0);

  const getPx = (x, y) => {
    const o = (y * width + x) * channels;
    return [data[o], data[o + 1], data[o + 2], data[o + 3]];
  };
  const setPx = (buf, x, y, r, g, b, a) => {
    const o = (y * zielW + x) * 4;
    buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = a;
  };

  ZEILEN.forEach(([y0, y1], zeile) => {
    SPALTEN.forEach(([x0, x1], spalte) => {
      // Bounding-Box der undurchsichtigen Pixel in dieser Zelle (aus dem Alphakanal
      // nach dem Freistellen oben) — Auto-Trim statt Augenmass.
      let minx = x1, maxx = x0, miny = y1, maxy = y0, gefunden = false;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const [, , , a] = getPx(x, y);
          if (a > 10) { gefunden = true; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
        }
      }
      if (!gefunden) return;
      const bw = maxx - minx + 1, bh = maxy - miny + 1;
      // Unten buendig, horizontal zentriert in der 48x48-Zelle (Figuren stehen auf
      // einem Sockel — der soll auf derselben Linie wie die anderen Figuren sitzen).
      const dx0 = Math.max(0, Math.floor((ZELLE - bw) / 2));
      const dy0 = Math.max(0, ZELLE - bh - 2);
      for (let y = 0; y < bh && dy0 + y < ZELLE; y++) {
        for (let x = 0; x < bw && dx0 + x < ZELLE; x++) {
          const [r, g, b, a] = getPx(minx + x, miny + y);
          if (a <= 10) continue;
          const zx = spalte * ZELLE + dx0 + x, zy = zeile * ZELLE + dy0 + y;
          setPx(weiss, zx, zy, r, g, b, a);
          // Schwarz-Umfaerbung: nur die Cremefuellung (helles R/G, wie die Vorlage
          // beschreibt), Umriss/Schattierung bleiben dunkel und damit gleich.
          if (r > 150 && g > 140) setPx(schwarz, zx, zy, 62, 58, 54, a);
          else setPx(schwarz, zx, zy, r, g, b, a);
        }
      }
    });
  });

  if (!existsSync(ZIEL)) mkdirSync(ZIEL, { recursive: true });
  for (const [name, buf] of [['schach_weiss', weiss], ['schach_schwarz', schwarz]]) {
    const info = await sharp(buf, { raw: { width: zielW, height: zielH, channels: 4 } })
      .png().toFile(join(ZIEL, `${name}.png`));
    console.log(`  ${name}.png  ${info.width}x${info.height}`);
  }
}

main();
