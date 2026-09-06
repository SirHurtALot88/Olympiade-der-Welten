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
  // Hindernis-Stationen der Spurt-Bahn (docs/design/spurt-offene-fragen-plus-optik-plan-05-09.md, 4.2).
  // Koordinaten aus den TSX-Wangsets der Pakete, am 4x-Ausschnitt gegengeprueft.
  ['hind_huerde',   'zaun',     64, 160,  32,  32, false],
  ['hind_balken',   'zaun',     80, 768,  64,  32, false],
  ['hind_wand',     'zaun',    256, 448,  32,  64, false],
  ['hind_seil',     'zaun',    384,  64,  64,  32, false],
  ['hind_wasser_l', 'terrain',  96, 544,  32,  32, false],
  ['hind_wasser_r', 'terrain', 160, 544,  32,  32, false],
  ['hind_mauer',    'zaun',    192, 352,  40,  32, false],
  ['hind_heu',      'deko',      0, 736,  64,  32, false],
  ['hind_feuer',    'deko',    256,1536, 160,  32, false],
  // Takeshi's Castle: zehn Fallen-Typen + Burg-Deko auf vierzehn Stationen (docs/design/
  // takeshi-schach-optik-gameplay-plan-05-09.md, Teil B, Anhang B.3). Koordinaten am
  // gleichen 8x-Raster-Verfahren nachgemessen wie oben (Anhang B), zwei Korrekturen
  // gegenueber dem Plan-Dokument: `deko_pranger`/`deko_stock` sassen dort auf der
  // Wagen-Kachel eine Spalte daneben (x=128 statt 64 bzw. x=256/y=1440 statt 128/1474),
  // `burg_mauer` ist auf 160 statt 256 Breite gekuerzt (die restlichen 96 px sind
  // Fackelhalter-Reste, keine Mauer — beim Kacheln quer ueber den Bildschirm sonst eine
  // sichtbare Luecke).
  ['falle_tuer',         'zaun', 128, 512,  32,  64, false],
  ['falle_strickleiter', 'zaun', 384,  64,  64,  64, false],
  ['falle_spitzen',      'zaun', 288, 224,  96, 128, false],
  ['burg_mauer',         'zaun',   0, 672, 160,  64, false],
  ['burg_turm',          'zaun', 384, 512,  96, 150, false],
  ['burg_tor',           'zaun', 256, 512,  96, 150, false],
  ['deko_rad',           'deko', 416,1440,  32,  32, false],
  ['falle_walze',        'deko', 416, 672,  32,  32, false],
  ['boden_eis',       'terrain', 640, 928,  32,  32, false],
  ['deko_banner',        'deko',   0,1216, 192,  80, false],
  ['deko_pranger',       'deko',  64,1408,  64,  88, false],
  ['deko_stock',         'deko', 128,1474,  64,  38, false],
  ['deko_holz',          'deko', 352, 640,  64,  64, false],
  ['falle_fass',         'deko',  64, 704,  32,  64, false],
  // Takeshi's Castle, die Route durch Midoriyama (docs/design/takeshi-schlammroute-plan-06-09.md,
  // Abschnitt 5): neun Untergruende fuer die fuenf Gelaende-Zonen. Alle aus demselben
  // Terrain-Blatt, das oben schon geladen wird — kein neuer Download, kein neuer Credit.
  // Jeder Terrain-Block in terrain-v7.png ist 96x224 (3 Spalten x 7 Reihen): Reihen 0-1
  // Innenecken, 2-4 der 3x3-Uebergangssatz (Mitte = die "tile"-Koordinate der TSX-Datei),
  // Reihen 5-6 volle Kacheln ohne Rand. Alle neun Schnitte sind Reihe-5-Kacheln
  // (y = tile-y + 64) — dieselbe Reihe, aus der `boden_erde` (Dirt_Brown) stammt.
  ['boden_wiese',     'terrain',  32, 384,  32,  32, false],   // Grass
  ['boden_wald',      'terrain', 224, 384,  32,  32, false],   // Grass_Dark
  ['boden_pfad',      'terrain',  32, 160,  32,  32, false],   // Dirt_Tan
  ['boden_kies',      'terrain', 800, 384,  32,  32, false],   // Gravel_1
  ['boden_schlamm',   'terrain', 896, 160,  32,  32, false],   // Mud_Brown
  ['boden_see',       'terrain', 128, 608,  32,  32, false],   // Water
  ['boden_sumpf',     'terrain',  32, 608,  32,  32, false],   // Water_Shallows_Dirt
  ['boden_hang',      'terrain', 320, 384,  32,  32, false],   // Grass_Dead
  ['boden_pflaster',  'terrain', 704, 832,  32,  32, false],   // Stone_Tan
];

const BLATT = {
  terrain:   'lpc-terrains/terrain-v7.png',
  zaun:      'decoration_medieval/fence_medieval.png',
  deko:      'decoration_medieval/decorations-medieval.png',
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
