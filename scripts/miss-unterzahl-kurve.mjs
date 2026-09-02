// Misst die UNTERZAHL-KURVE: ein Heimteam mit k gesetzten Spielern (k = 6..1) gegen ein
// immer vollstaendiges Gastteam. Erwartung: je weniger Spieler, desto weniger Punkte —
// und zwar OHNE Beule. Genau das war kaputt (s. PR "Unterzahl-Strafe wieder monoton"):
// ein einzelner Spieler kam auf 54,1 Punkte und schlug damit die volle Sechserbesetzung
// mit 37,9. Wer das Verhalten anfasst, misst hier vorher und nachher.
//
//   node scripts/miss-unterzahl-kurve.mjs [spiele]
//
// Gemessen wird ueber feldspielProbe (dieselbe Quelle wie miss-feldspiel-rangtreue.mjs),
// die Aufstellung kommt ueber window.__olyArenaKader.aufstellung — also ueber genau den
// Weg, den die Produktion nimmt (arena-aufstellung-adapter.ts).
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const SPIELE = Number(process.argv[2] || 24);
const SLOTS = ["floorgeneral", "rimpressure", "perimeter", "helpdefense", "clutchshot", "fastbreak"];
const HEIM = ["Draco", "Lava Golem", "Krolach", "Johanna", "King Arlen Morgolor", "Gram"];

const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});

async function lauf(k) {
  const aufstellung = {};
  for (let i = 0; i < k; i++) aufstellung[HEIM[i]] = { d: "basketball", slot: SLOTS[i] };
  const seite = await browser.newPage();
  await seite.addInitScript((a) => { window.__olyArenaKader = { aufstellung: a }; }, aufstellung);
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.feldspielProbe, null, { timeout: 30000 });
  const wert = await seite.evaluate((n) => {
    const x = window.__arena.feldspielProbe("basketball", { n, jeSeite: 6 });
    let hp = 0, gp = 0, fga = 0, fgm = 0, bw = 0, to = 0;
    for (const s of x.spiele) {
      hp += s.seiten[0]; gp += s.seiten[1]; bw += s.ballwechsel;
      for (const q of s.spieler.filter((z) => z.side === 0)) { fga += q.fga; fgm += q.fgm; to += q.verluste; }
    }
    const m = x.spiele.length;
    // Streuung der Heimpunkte je Spiel, nicht nur ihr Mittel (Overseer-Auflage): bei rund
    // 10 Punkten Standardabweichung je Spiel ist ein Abstand von vier Punkten aus 24
    // Spielen nicht belastbar — ohne diese Spalte meldet das Skript irgendwann eine Beule,
    // die nur Rauschen ist. Der Standardfehler des Mittels ist s/sqrt(n).
    const heimJeSpiel = x.spiele.map((s) => s.seiten[0]);
    const mittel = hp / m;
    const varianz = heimJeSpiel.reduce((a, v) => a + (v - mittel) ** 2, 0) / Math.max(1, m - 1);
    return {
      heim: +mittel.toFixed(1), gast: +(gp / m).toFixed(1),
      sd: +Math.sqrt(varianz).toFixed(1), sem: +(Math.sqrt(varianz) / Math.sqrt(m)).toFixed(1),
      fga: +(fga / m).toFixed(1), fgq: +((100 * fgm) / Math.max(1, fga)).toFixed(1),
      ballw: +(bw / m).toFixed(1), to: +(to / m).toFixed(1),
    };
  }, SPIELE);
  await seite.close();
  return wert;
}

console.log(`Unterzahl-Kurve — ${SPIELE} Spiele je Groesse, Quelle: ${SEITE}\n`);
console.log("gesetzt   Heim  +/-SEM   Gast  Differenz    FGA    FG%   Ballw.     TO");
let vorher = null, beule = [], unklar = [];
for (const k of [6, 5, 4, 3, 2, 1]) {
  const r = await lauf(k);
  if (vorher !== null && r.heim > vorher.heim) {
    // Nur was ausserhalb der doppelten Standardfehler beider Messungen liegt, ist eine
    // Beule; alles darunter heisst "nicht unterscheidbar", nicht "in Ordnung".
    const schranke = 2 * Math.hypot(r.sem, vorher.sem);
    (r.heim - vorher.heim > schranke ? beule : unklar).push(k);
  }
  vorher = r;
  const z = (v, b) => String(v).padStart(b);
  console.log(`${z(k, 7)} ${z(r.heim, 6)} ${z("+-" + r.sem, 7)} ${z(r.gast, 6)} ${z(+(r.heim - r.gast).toFixed(1), 10)} ${z(r.fga, 6)} ${z(r.fgq, 6)} ${z(r.ballw, 8)} ${z(r.to, 6)}`);
}
console.log(beule.length
  ? `\nBEULE bei gesetzt=${beule.join(",")}: weniger Spieler, aber signifikant MEHR Punkte.`
  : "\nMonoton: weniger Spieler heisst durchgehend nicht mehr Punkte.");
if (unklar.length)
  console.log(`Nicht unterscheidbar bei gesetzt=${unklar.join(",")}: hoeher als der Schritt davor, aber innerhalb der Streuung. Mehr Spiele fahren.`);
await browser.close();
