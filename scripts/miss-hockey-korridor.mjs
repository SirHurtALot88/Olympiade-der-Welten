// ABNAHME-MESSUNG EISHOCKEY. Misst die Zahlen, gegen die der Hockey-Plan kalibriert:
//
//   Tore je Team      3,5   (Chris' Entscheidung; real NHL 3,0 / DEL 3,02)
//   Abschluesse       26    (was 240 s bei unserer Ereignisdichte hergeben)
//   Trefferquote      13,5 %
//   Fangquote         86,5 % (real .900 bis .905)
//
//   node scripts/miss-hockey-korridor.mjs [spiele]
//
// Gezaehlt wird aus dem Ereignisprotokoll der Live-Engine, nicht aus dem Boxscore: nur
// dort steht, WIE ein Schuss ausging (Tor, Abpraller, festgehalten, vorbei).
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const SPIELE = Number(process.argv[2] || 24);
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const seitenfehler = [];
seite.on("pageerror", (e) => seitenfehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.feldspielProbe, null, { timeout: 30000 });

const w = await seite.evaluate((n) => {
  const x = window.__arena.feldspielProbe("hockey", { n, jeSeite: 6 });
  const summe = { tore: 0, schuesse: 0, saves: 0, gegentore: 0, checks: 0, ballwechsel: 0, verluste: 0, strafen: 0 };
  const staende = [];
  for (const s of x.spiele) {
    summe.tore += s.seiten[0] + s.seiten[1];
    summe.ballwechsel += s.ballwechsel;
    staende.push(s.seiten.slice());
    for (const q of s.spieler) {
      summe.schuesse += q.fga;
      summe.saves += q.saves || 0;
      summe.gegentore += q.gegentore || 0;
      summe.checks += q.checks || 0;
      summe.verluste += q.verluste;
      summe.strafen += (q.strafminuten || 0) / 2;
    }
  }
  return { summe, spiele: x.spiele.length, staende, live: x.live, fehlend: x.fehlend };
}, SPIELE);

const n = w.spiele, jeTeam = (v) => v / n / 2;
const torJeTeam = jeTeam(w.summe.tore);
const schussJeTeam = jeTeam(w.summe.schuesse);
const quote = (100 * w.summe.tore) / Math.max(1, w.summe.schuesse);
const aufsTor = w.summe.saves + w.summe.gegentore;
const fangquote = (100 * w.summe.saves) / Math.max(1, aufsTor);

const zeile = (was, ist, soll, einheit) =>
  `${was.padEnd(26)} ${String(ist).padStart(7)} ${einheit.padEnd(3)}  Ziel ${soll}`;

console.log(`Eishockey-Korridor — ${n} Spiele, Quelle: ${SEITE}\n`);
console.log(zeile("Tore je Team", torJeTeam.toFixed(2), "3,5", ""));
// SCHUSSVERSUCHE gegen SCHUESSE AUFS TOR. Der Plan rechnete mit 26 "Abschluessen" und
// leitete daraus die 13,5 % ab. Die Live-Engine produziert mehr Versuche als die
// Vorab-Rechnung angenommen hatte — der ehrliche Vergleich ist deshalb der mit den
// echten NHL-Zahlen: rund 55 Versuche und rund 29 Schuesse AUFS TOR je Team. Die von
// Chris entschiedene Zahl ist die Torzahl, und die ist die erste Zeile.
console.log(zeile("Schussversuche je Team", schussJeTeam.toFixed(1), "NHL rund 55", ""));
console.log(zeile("Schuesse aufs Tor je Team", (aufsTor / n / 2).toFixed(1), "NHL rund 29", ""));
console.log(zeile("Tore je Schussversuch", quote.toFixed(1), "rund 6 % (NHL)", "%"));
console.log(zeile("Fangquote des Torwarts", fangquote.toFixed(1), "86,5 % (NHL .902)", "%"));
console.log(zeile("Checks je Team", jeTeam(w.summe.checks).toFixed(1), "— (fuenf Feldspieler, nicht 18)", ""));
console.log(zeile("Ballwechsel je Spiel", (w.summe.ballwechsel / n).toFixed(1), "— (Basketball: 102)", ""));
console.log(zeile("Verluste je Team", jeTeam(w.summe.verluste).toFixed(1), "—", ""));
console.log(zeile("Kleine Strafen je Team", jeTeam(w.summe.strafen).toFixed(1), "NHL 3 bis 4", ""));
console.log(`\nErste Endstaende: ${w.staende.slice(0, 8).map((s) => s.join(":")).join("  ")}`);
console.log(`Seitenfehler: ${seitenfehler.length ? seitenfehler.slice(0, 3).join(" | ") : "keine"}`);
await browser.close();
