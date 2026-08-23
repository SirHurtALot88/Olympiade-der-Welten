// Schneidet die Hintergrund-Bausteine der Battle Arena aus den Original-Blaettern
// von OpenGameArt heraus. Reproduzierbar: das Skript laedt die Quellen selbst,
// schneidet an festen Koordinaten und schreibt nach public/sprites/arena/.
//
//   node scripts/arena-assets-schneiden.mjs
//
// Die Koordinaten sind NICHT geraten. Fuer jede Flaechenkachel wurde im Blatt die
// Stelle gesucht, an der eine 32x32-Kachel voll deckend ist, Textur traegt und sich
// ohne sichtbare Kante wiederholen laesst (Mass: Sprung zwischen rechter und linker
// Kante gegen den mittleren Sprung im Inneren). Jede Wahl ist danach als 3x3-Kachelung
// angesehen worden — die Zahl allein haette zweimal Wasser statt Sand ausgewaehlt.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const ZIEL = 'public/sprites/arena';

const QUELLEN = [
  { datei: 'lpc-terrains.zip',        url: 'https://opengameart.org/sites/default/files/lpc-terrains.zip' },
  { datei: 'decoration_medieval.zip', url: 'https://opengameart.org/sites/default/files/decoration_medieval.zip' },
  { datei: 'lpc-conifers.zip',        url: 'https://opengameart.org/sites/default/files/lpc-conifers.zip' },
  { datei: 'animated_torch.png',      url: 'https://opengameart.org/sites/default/files/animated_torch.png' },
  { datei: 'bird_2_eagle.png',        url: 'https://opengameart.org/sites/default/files/bird_2_eagle.png' },
];

// [Zielname, Quellblatt, x, y, Breite, Hoehe, trimmen?]
// Die Baum-Kaesten sind nicht nach Augenmass gesetzt, sondern aus dem Alphakanal
// gelesen: Spalten und Zeilen mit Deckung, Gruppen dazwischen getrennt.
const SCHNITTE = [
  ['boden_sand',   'terrain',   542, 384,  32,  32, false],
  ['boden_stein',  'terrain',   384, 160,  32,  32, false],
  ['boden_erde',   'terrain',    96, 160,  32,  32, false],
  ['bahn_ocker',   'terrain',   712, 786,  32,  32, false],
  ['rasen',        'terrain',    33, 384,  32,  32, false],
  ['mauer_ziegel', 'zaun',       88, 660,  32,  32, false],
  ['zaun_holz',    'zaun',       96, 160,  32,  32, false],
  ['baum_1',       'nadelbaum', 240, 162,  36,  62, false],
  ['baum_2',       'nadelbaum', 288, 162,  32,  60, false],
  ['baum_3',       'nadelbaum', 321, 163,  30,  59, false],
  ['baum_4',       'nadelbaum', 353, 170,  30,  42, false],
];

const BLATT = {
  terrain:   'lpc-terrains/terrain-v7.png',
  zaun:      'decoration_medieval/fence_medieval.png',
  nadelbaum: 'lpc-conifers/conifers.png',
};

const arbeit = mkdtempSync(join(tmpdir(), 'arena-assets-'));
console.log('Arbeitsordner:', arbeit);

for (const q of QUELLEN) {
  execFileSync('curl', ['-sS', '-o', join(arbeit, q.datei), q.url], { stdio: 'inherit' });
  if (q.datei.endsWith('.zip')) execFileSync('unzip', ['-qo', join(arbeit, q.datei), '-x', '__MACOSX/*', '-d', arbeit]);
  console.log('  geladen:', q.datei);
}

if (!existsSync(ZIEL)) mkdirSync(ZIEL, { recursive: true });

for (const [name, blatt, left, top, width, height, trimmen] of SCHNITTE) {
  let bild = sharp(join(arbeit, BLATT[blatt])).extract({ left, top, width, height });
  if (trimmen) bild = bild.trim();
  const info = await bild.png().toFile(join(ZIEL, `${name}.png`));
  console.log(`  ${name}.png  ${info.width}x${info.height}`);
}

// Fackel und Adler kommen unveraendert ins Ziel — sie sind schon fertige Blaetter.
for (const [name, datei] of [['fackel', 'animated_torch.png'], ['vogel_adler', 'bird_2_eagle.png']]) {
  const info = await sharp(join(arbeit, datei)).png().toFile(join(ZIEL, `${name}.png`));
  console.log(`  ${name}.png  ${info.width}x${info.height}`);
}
