// SPIEGELTEST GEWICHTHEBEN — Beilage zu gewichtheben-duell-reihenfolge-plan-06-09.md.
//
// Identischer Sechser-Kader (Deep-Clone im Browser) gegen sich selbst, ueber N Saaten, gezaehlt
// wird das ECHTE Spielergebnis (gewonnene Duelle via window.__arena.spieleBuehneHeben, dieselbe
// Zahl wie updateHudBuehne) und die Zweikampf-Kilogramm je Seite. Ein fairer Motor muss hier
// nahe 50:50 liegen. Dieselbe Methode wie scripts/miss-arena-buehne-spiegel.mjs aus PR #820,
// nur auf Gewichtheben verengt und mit Duell-Summe ueber alle Spiele.
//
//   node docs/design/gewichtheben-duell-reihenfolge-spiegel-06-09.mjs <pfad/battle-mode.html> [N]
//
// Optional drittes Argument: Liste von Reihenfolge-Modi (fest,zufall,hinten,iwf), die ueber
// window.__hebenReihenfolge gesetzt werden. Das greift NUR in der Mess-Fassung des Motors, die
// fuer den Plan gebaut wurde (Abschnitt 5 des Plans) — der Prototyp-Diff kennt keinen Schalter,
// dort liefern alle Modi dieselbe Zahl (die der IWF-Regel).
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";

const seitePfad = process.argv[2];
if (!seitePfad || !existsSync(seitePfad)) { console.error("Mockup nicht gefunden: " + seitePfad); process.exit(1); }
const N = Number(process.argv[3] || 300);
const modi = (process.argv[4] || "fest").split(",");
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
try {
  const page = await browser.newPage();
  const fehler = [];
  page.on("pageerror", (e) => fehler.push(String(e)));
  await page.addInitScript((kader) => {
    window.__olyArenaKader = { heim: kader, gast: JSON.parse(JSON.stringify(kader)) };
  }, KADER);
  await page.goto(pathToFileURL(seitePfad).href);
  await page.waitForFunction(() => Boolean(window.__arena && window.__arena.spieleBuehneHeben), null, { timeout: 15000 });
  console.log(`Seite: ${seitePfad}, N=${N}`);
  console.log("Modus      Spiele H:G:U     Duelle H:G     kg H      kg G    Abw%");
  for (const m of modi) {
    const r = await page.evaluate(({ m, n }) => {
      window.__hebenReihenfolge = m;
      let sh = 0, sg = 0, su = 0, dh = 0, dg = 0, kh = 0, kg = 0;
      for (let i = 0; i < n; i++) {
        const e = window.__arena.spieleBuehneHeben("gewichtheben", 100000 + i * 977);
        const [l, re] = e.seiten;
        dh += l; dg += re; kh += e.gesamtKg[0]; kg += e.gesamtKg[1];
        if (l > re) sh++; else if (re > l) sg++; else su++;
      }
      return { sh, sg, su, dh, dg, kh, kg };
    }, { m, n: N });
    const abw = (100 * (r.kh - r.kg) / ((r.kh + r.kg) / 2)).toFixed(2);
    console.log(m.padEnd(10) + `${r.sh}:${r.sg}:${r.su}`.padStart(13) + `${r.dh}:${r.dg}`.padStart(15)
      + String(r.kh).padStart(9) + String(r.kg).padStart(9) + abw.padStart(7));
  }
  if (fehler.length) { console.error("Seitenfehler:", fehler.slice(0, 3)); process.exit(1); }
} finally { await browser.close(); }
