// SPIEGELTEST FUER BUEHNE — dieselbe Methode wie miss-arena-feldspiel-spiegel.mjs: ZWEI
// IDENTISCHE Kader (byte-identische Spielerobjekte, gleiche Reihenfolge, per Deep-Clone)
// treten ueber viele Seeds gegeneinander an. Bei einem fairen Motor darf keine der beiden
// Seiten strukturell bevorzugt sein — die Summe der Durchgangspunkte (u.summe, dieselbe
// Groesse, die MOTOREN[d].wert() liest) muss je Seite nahe beieinanderliegen und die
// Heimsiegquote nahe 50:50.
//
// Fund (Opus-Review auf PR #818): bauBuehne() gab der Gastseite weder Slot-Aufschlag noch
// Stufenwert (`istGegner?null:slotFuer(...)`, `formVon(p.n)+(istGegner?0:stufenWert())`)
// und las ihre Aufstellung nie (`OPP.slice(0,n)` statt der echten `place[p.n]`-Aufstellung)
// — derselbe "Fehler #1" aus docs/BATTLE_ARENA_UEBERGABE.md, der im Kampf/auf der Bahn/im
// Feldspiel bereits behoben war, hier aber nie.
//
// Aufruf:
//   node scripts/miss-arena-buehne-spiegel.mjs                          -> 60 Laeufe je Disziplin
//   node scripts/miss-arena-buehne-spiegel.mjs 200                       -> 200 Laeufe je Disziplin
//   node scripts/miss-arena-buehne-spiegel.mjs 60 speed-schach showcase  -> nur diese Disziplinen
//   node scripts/miss-arena-buehne-spiegel.mjs 60 "" /pfad/zu/battle-mode.html
//                                                                         -> gegen einen
//                                                                            eingefrorenen Entwurf
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const args = process.argv.slice(2);
const N = Number(args[0] || 60);
const disziplinen = args[1] ? args[1].split(",").filter(Boolean) : ["speed-schach", "showcase", "gewichtheben"];
const hier = dirname(fileURLToPath(import.meta.url));
const seitePfad = args[2] || resolve(hier, "..", "public", "mockups", "battle-mode.html");
if (!existsSync(seitePfad)) {
  console.error("Mockup nicht gefunden: " + seitePfad);
  process.exit(1);
}

// Sechs Spieler mit unterschiedlichen, aber plausiblen Attributen — WELCHE Attribute sie
// tragen, ist fuer den Test irrelevant (es geht nicht um die Spieler, sondern um die Seite).
// Wichtig ist nur, dass heim und gast per Deep-Clone exakt dieselben Objekte in derselben
// Reihenfolge bekommen.
const D0 = { tdm: 50, spurt: 50 };
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

// Deep-Clone IM Browser (nicht davor in Node) — derselbe Weg wie im Feldspiel-Spiegeltest.
await page.addInitScript((kader) => {
  window.__olyArenaKader = { heim: kader, gast: JSON.parse(JSON.stringify(kader)) };
}, KADER);

await page.goto(pathToFileURL(seitePfad).href);
await page.waitForFunction(() => Boolean(window.__arena), null, { timeout: 15000 });

let gesamtFehlgeschlagen = 0;

for (const d of disziplinen) {
  // ECHTES SPIELERGEBNIS, NICHT NUR DIE ROHE PUNKTESUMME. Was ein Spiel gewinnt, ist je
  // Buehnen-Typ verschieden (s. updateHudBuehne()): Gewichtheben zaehlt gewonnene Duelle
  // (spieleBuehneHeben), die Duell-Buehnen (Speed-Schach/I-Spy) zaehlen gewonnene Bretter
  // (spieleBuehneDuell), alle anderen die rohe Punktesumme (window.__arena.spiele().
  // protokoll[].summe, side 0 gegen side 1). Der Spiegeltest muss dieselbe Zahl lesen wie
  // die App selbst — sonst misst er ein Artefakt seiner eigenen Metrik statt den Motor.
  const ergebnisse = await page.evaluate(({ d, n }) => {
    const out = [];
    for (let i = 0; i < n; i++) {
      const saat = 100000 + i * 977;
      let seiten;
      const viaHeben = window.__arena.spieleBuehneHeben(d, saat);
      if (viaHeben) { seiten = viaHeben.seiten; }
      else {
        const viaDuell = window.__arena.spieleBuehneDuell(d, saat);
        if (viaDuell) { seiten = viaDuell.seiten; }
        else {
          const r = window.__arena.spiele(d, saat);
          let l = 0, re = 0;
          for (const t of r.protokoll) { if (t.seite === 0) l += t.summe; else re += t.summe; }
          seiten = [l, re];
        }
      }
      out.push(seiten);
    }
    return out;
  }, { d, n: N });

  let siegeLinks = 0, siegeRechts = 0, unentschieden = 0;
  let summeLinks = 0, summeRechts = 0;

  for (const [l, re] of ergebnisse) {
    if (l == null || re == null) { gesamtFehlgeschlagen++; continue; }
    summeLinks += l; summeRechts += re;
    if (l > re) siegeLinks++; else if (re > l) siegeRechts++; else unentschieden++;
  }

  const n = ergebnisse.length;
  const abw = (100 * (summeLinks - summeRechts) / ((summeLinks + summeRechts) / 2 || 1)).toFixed(1);
  console.log(`\n=== ${d} (${n} Laeufe) ===`);
  console.log(`Siege links (heim/SQUAD): ${siegeLinks}, rechts (gast/OPP): ${siegeRechts}, unentschieden: ${unentschieden}`);
  console.log(`Punktestand im Schnitt: links ${(summeLinks / n).toFixed(2)}, rechts ${(summeRechts / n).toFixed(2)}`);
  console.log(`Abweichung: ${abw}%`);
}

await browser.close();

if (fehler.length) {
  console.error("\nSeitenfehler:", fehler.slice(0, 5));
  process.exit(1);
}
if (gesamtFehlgeschlagen) {
  console.error(`\n${gesamtFehlgeschlagen} Laeufe ohne Protokoll — Motor-Fehler?`);
  process.exit(1);
}
