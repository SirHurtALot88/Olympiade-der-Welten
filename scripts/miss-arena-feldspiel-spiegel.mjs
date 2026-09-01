// SPIEGELTEST FUER FELDSPIEL (Basketball) — dieselbe Methode, mit der das Kampf-Chassis
// seinen "Zwei Bauwege"-Bug fand (docs/BATTLE_ARENA_UEBERGABE.md, "Was in dieser Sitzung
// fertig wurde", Fehler #1): ZWEI IDENTISCHE Kader (byte-identische Spielerobjekte,
// gleiche Reihenfolge, per JSON-Deep-Clone) treten ueber viele Seeds gegeneinander an.
// Bei einem fairen Motor darf keine der beiden Team-Seiten strukturell bevorzugt sein —
// der Sieganteil muss nahe 50:50 liegen und die mittleren Boxscore-Summen beider Seiten
// muessen (bis auf Zufallsrauschen) identisch sein. Jede Abweichung kann dann nur aus dem
// BAUWEG kommen (welche Formel eine Seite durchlaeuft), nie aus unterschiedlichen Spielern
// — die gibt es in diesem Test per Konstruktion nicht.
//
// Hintergrund (23.09., Chris' Verdacht "das gabs schonmal"): eine 10-Spiele-Stichprobe mit
// zwei fast gleich starken, aber VERSCHIEDENEN Basketball-Spielern auf den beiden Seiten
// zeigte einen 54%-Unterschied im mittleren Impact. Dieser Spiegeltest trennt die Frage
// "liegt es an den zwei Spielern" von "liegt es an der Seite" — mit identischen Kadern auf
// beiden Seiten kann nur noch Letzteres uebrig bleiben.
//
// Fund: bauFeldspiel() (public/mockups/battle-mode.engine.js) hatte genau den Fehler, der
// im Kampf (baueEinheit) und auf der Bahn (bauSpurt) bereits gefunden und behoben wurde
// (dortiger Kommentar: "derselbe Fehler, der im TDM die 0:6 in 24 von 24 Kaempfen
// verursacht hat") — nur im Feldspiel stand er noch: `istGegner` schaltete Slot-Aufschlag,
// den Aufgabe-3-Positions-Modifier (BASKETBALL_POS_MOD) UND die Intensitaets-Stufe fuer die
// Gegnerseite komplett ab, unsere Seite bekam sie immer. Behoben, indem beide Seiten jetzt
// exakt denselben bauSpieler()-Aufruf durchlaufen (kein `istGegner`-Sonderfall mehr).
//
// Aufruf:
//   node scripts/miss-arena-feldspiel-spiegel.mjs                → 48 Laeufe, Basketball
//   node scripts/miss-arena-feldspiel-spiegel.mjs 200             → 200 Laeufe
//   node scripts/miss-arena-feldspiel-spiegel.mjs 48 /pfad/zu/battle-mode.html
//                                                                  → gegen einen eingefrorenen
//                                                                    Entwurf messen (Vorher/
//                                                                    Nachher-Vergleich)
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const N = Number(process.argv[2] || 48);
const hier = dirname(fileURLToPath(import.meta.url));
const seitePfad = process.argv[3] || resolve(hier, "..", "public", "mockups", "battle-mode.html");
if (!existsSync(seitePfad)) {
  console.error("Mockup nicht gefunden: " + seitePfad);
  process.exit(1);
}

// Sechs Spieler mit unterschiedlichen, aber plausiblen Basketball-Attributen — WELCHE
// Attribute sie tragen, ist fuer den Test irrelevant (siehe oben: es geht nicht um die
// Spieler). Wichtig ist nur, dass heim und gast per Deep-Clone exakt dieselben Objekte in
// derselben Reihenfolge bekommen.
const D0 = { tdm: 50, spurt: 50, basketball: 50 };
const KADER = [
  { n: "Spieler A", c: "Warlord", r: "Human", sub: [], tp: [], tn: [], row: 0, d: { ...D0 }, a: { power: 70, health: 70, stamina: 60, intelligence: 55, awareness: 60, determination: 65, speed: 65, dexterity: 60, charisma: 50, will: 55, spirit: 50, torment: 40 } },
  { n: "Spieler B", c: "Bard", r: "Elf", sub: [], tp: [], tn: [], row: 0, d: { ...D0 }, a: { power: 50, health: 55, stamina: 65, intelligence: 70, awareness: 68, determination: 55, speed: 72, dexterity: 66, charisma: 60, will: 60, spirit: 58, torment: 35 } },
  { n: "Spieler C", c: "Mage", r: "Human", sub: [], tp: [], tn: [], row: 1, d: { ...D0 }, a: { power: 45, health: 50, stamina: 55, intelligence: 80, awareness: 75, determination: 50, speed: 58, dexterity: 70, charisma: 55, will: 65, spirit: 62, torment: 30 } },
  { n: "Spieler D", c: "Tank", r: "Construct", sub: [], tp: [], tn: [], row: 1, d: { ...D0 }, a: { power: 85, health: 90, stamina: 50, intelligence: 40, awareness: 45, determination: 70, speed: 40, dexterity: 45, charisma: 35, will: 60, spirit: 40, torment: 55 } },
  { n: "Spieler E", c: "Berserker", r: "Lizard", sub: [], tp: [], tn: [], row: 2, d: { ...D0 }, a: { power: 75, health: 65, stamina: 70, intelligence: 35, awareness: 50, determination: 60, speed: 68, dexterity: 55, charisma: 40, will: 50, spirit: 35, torment: 60 } },
  { n: "Spieler F", c: "Hero", r: "Human", sub: [], tp: [], tn: [], row: 2, d: { ...D0 }, a: { power: 60, health: 60, stamina: 58, intelligence: 60, awareness: 62, determination: 68, speed: 60, dexterity: 58, charisma: 70, will: 65, spirit: 55, torment: 45 } },
];

const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const page = await browser.newPage();
const fehler = [];
page.on("pageerror", (e) => fehler.push(String(e)));

// Deep-Clone IM Browser (nicht davor in Node) — derselbe Weg, den arena-headless-runner.ts
// fuer heim/gast nimmt: zwei komplett unabhaengige Objektbaeume, kein geteilter Zustand.
await page.addInitScript((kader) => {
  window.__olyArenaKader = { heim: kader, gast: JSON.parse(JSON.stringify(kader)) };
}, KADER);

await page.goto(pathToFileURL(seitePfad).href);
await page.waitForFunction(() => Boolean(window.__arena), null, { timeout: 15000 });

const ergebnisse = await page.evaluate((n) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(window.__arena.spieleFeldspiel("basketball", 100000 + i * 977));
  }
  return out;
}, N);

await browser.close();

if (fehler.length) {
  console.error("Seitenfehler:", fehler.slice(0, 5));
}

let siegeLinks = 0, siegeRechts = 0, unentschieden = 0;
let summeLinks = 0, summeRechts = 0;
let boxLinks = 0, boxRechts = 0;

for (const r of ergebnisse) {
  const [l, re] = r.seiten;
  summeLinks += l; summeRechts += re;
  if (l > re) siegeLinks++; else if (re > l) siegeRechts++; else unentschieden++;
  // boxscore = namenVon()-Reihenfolge = [...FSTEAM[0], ...FSTEAM[1]] — bei gleich grossen
  // Kadern sind die ersten n Eintraege links (heim/SQUAD), der Rest rechts (gast/OPP).
  const haelfte = r.boxscore.length / 2;
  for (let i = 0; i < haelfte; i++) boxLinks += r.boxscore[i].wert;
  for (let i = haelfte; i < r.boxscore.length; i++) boxRechts += r.boxscore[i].wert;
}

const n = ergebnisse.length;
console.log(`Laeufe: ${n}`);
console.log(`Siege links (heim/SQUAD): ${siegeLinks}, rechts (gast/OPP): ${siegeRechts}, unentschieden: ${unentschieden}`);
console.log(`Punkte im Schnitt: links ${(summeLinks / n).toFixed(2)}, rechts ${(summeRechts / n).toFixed(2)}`);
console.log(`Boxscore-Summe im Schnitt: links ${(boxLinks / n).toFixed(2)}, rechts ${(boxRechts / n).toFixed(2)}`);
console.log(`Abweichung Punkte: ${(100 * (summeLinks - summeRechts) / ((summeLinks + summeRechts) / 2)).toFixed(1)}%`);
console.log(`Abweichung Boxscore: ${(100 * (boxLinks - boxRechts) / ((boxLinks + boxRechts) / 2)).toFixed(1)}%`);
