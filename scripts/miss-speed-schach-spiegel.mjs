// SPIEGELTEST SPEZIFISCH FUER SPEED-SCHACH (Chris' Verdacht 06.09.: "glaube aktuell gewinnt
// weiss immer oder?"). Gleiche Methode wie miss-arena-feldspiel-spiegel.mjs: ZWEI IDENTISCHE
// Kader (Deep-Clone) gegeneinander ueber viele Saaten. Bei einem fairen Motor darf keine Seite
// strukturell bevorzugt sein -- der Brett-Sieganteil (spieleBuehneDuell, dieselbe Zaehlung wie
// updateHudBuehne()) muss nahe 50:50 liegen.
//
// Aufruf:
//   node scripts/miss-speed-schach-spiegel.mjs            -> 300 Laeufe
//   node scripts/miss-speed-schach-spiegel.mjs 500
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const N = Number(process.argv[2] || 300);
const hier = dirname(fileURLToPath(import.meta.url));
const seitePfad = process.argv[3] || resolve(hier, "..", "public", "mockups", "battle-mode.html");
if (!existsSync(seitePfad)) {
  console.error("Mockup nicht gefunden: " + seitePfad);
  process.exit(1);
}

// Sechs Spieler mit unterschiedlichen, aber plausiblen Speed-Schach-Attributen (Matrix:
// intelligence 28, awareness 21, determination 14, will 14, speed 10, dexterity 7, charisma 6).
// Welche Attribute sie tragen ist irrelevant -- es geht nur um Seiten-Bias bei IDENTISCHEM Kader.
const D0 = { tdm: 50, spurt: 50, "speed-schach": 50 };
const KADER = [
  { n: "Spieler A", c: "Mage", r: "Human", sub: [], tp: [], tn: [], row: 0, d: { ...D0 }, a: { power: 40, health: 55, stamina: 50, intelligence: 82, awareness: 70, determination: 60, speed: 45, dexterity: 50, charisma: 40, will: 62, spirit: 50, torment: 30 } },
  { n: "Spieler B", c: "Bard", r: "Elf", sub: [], tp: [], tn: [], row: 0, d: { ...D0 }, a: { power: 35, health: 50, stamina: 55, intelligence: 75, awareness: 68, determination: 55, speed: 50, dexterity: 55, charisma: 65, will: 58, spirit: 55, torment: 28 } },
  { n: "Spieler C", c: "Overseer", r: "Human", sub: [], tp: [], tn: [], row: 1, d: { ...D0 }, a: { power: 42, health: 52, stamina: 48, intelligence: 78, awareness: 72, determination: 58, speed: 48, dexterity: 52, charisma: 45, will: 60, spirit: 52, torment: 32 } },
  { n: "Spieler D", c: "Tank", r: "Construct", sub: [], tp: [], tn: [], row: 1, d: { ...D0 }, a: { power: 60, health: 70, stamina: 45, intelligence: 55, awareness: 50, determination: 65, speed: 35, dexterity: 40, charisma: 30, will: 55, spirit: 35, torment: 45 } },
  { n: "Spieler E", c: "Rogue", r: "Lizard", sub: [], tp: [], tn: [], row: 2, d: { ...D0 }, a: { power: 45, health: 48, stamina: 58, intelligence: 60, awareness: 55, determination: 50, speed: 65, dexterity: 60, charisma: 35, will: 48, spirit: 30, torment: 40 } },
  { n: "Spieler F", c: "Hero", r: "Human", sub: [], tp: [], tn: [], row: 2, d: { ...D0 }, a: { power: 48, health: 55, stamina: 50, intelligence: 65, awareness: 58, determination: 62, speed: 52, dexterity: 50, charisma: 60, will: 55, spirit: 48, torment: 38 } },
];

const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const page = await browser.newPage();
const fehler = [];
page.on("pageerror", (e) => fehler.push(String(e)));

await page.addInitScript((kader) => {
  window.__olyArenaKader = { heim: kader, gast: JSON.parse(JSON.stringify(kader)) };
}, KADER);

await page.goto(pathToFileURL(seitePfad).href);
await page.waitForFunction(() => Boolean(window.__arena), null, { timeout: 15000 });

const hatDuell = await page.evaluate(() => typeof window.__arena.spieleBuehneDuell === "function");
if (!hatDuell) {
  console.error("window.__arena.spieleBuehneDuell fehlt auf dieser Seite -- alte Engine-Version?");
  await browser.close();
  process.exit(1);
}

const ergebnisse = await page.evaluate((n) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(window.__arena.spieleBuehneDuell("speed-schach", 200000 + i * 733));
  }
  return out;
}, N);

await browser.close();

if (fehler.length) {
  console.error("Seitenfehler:", fehler.slice(0, 5));
}

let siegeHeim = 0, siegeGast = 0, remis = 0;
let bretterHeim = 0, bretterGast = 0;
let boxHeim = 0, boxGast = 0;

for (const r of ergebnisse) {
  const [h, g] = r.seiten;
  bretterHeim += h; bretterGast += g;
  if (h > g) siegeHeim++; else if (g > h) siegeGast++; else remis++;
  const haelfte = r.boxscore.length / 2;
  for (let i = 0; i < haelfte; i++) boxHeim += r.boxscore[i].wert;
  for (let i = haelfte; i < r.boxscore.length; i++) boxGast += r.boxscore[i].wert;
}

const n = ergebnisse.length;
console.log(`Laeufe: ${n}`);
console.log(`Disziplinsiege heim (SQUAD): ${siegeHeim}, gast (OPP): ${siegeGast}, unentschieden: ${remis}`);
console.log(`Brett-Siege im Schnitt: heim ${(bretterHeim / n).toFixed(2)}, gast ${(bretterGast / n).toFixed(2)} (von je 6)`);
console.log(`Boxscore-Summe im Schnitt: heim ${(boxHeim / n).toFixed(2)}, gast ${(boxGast / n).toFixed(2)}`);
console.log(`Abweichung Boxscore: ${(100 * (boxHeim - boxGast) / ((boxHeim + boxGast) / 2)).toFixed(1)}%`);
