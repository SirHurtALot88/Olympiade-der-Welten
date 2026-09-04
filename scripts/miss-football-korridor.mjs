// ABNAHME-MESSUNG FOOTBALL. Misst die Korridor-Zahlen, gegen die diese Kalibrierungs-Runde
// fittet (docs/design/football-rezept-kalibrierung.md, Quellen: docs/design/football-
// rollout-plan.md Abschnitt A.1 plus frische WebSearch-Zahlen fuer Sack-/Interception-/
// Fumble-Rate und Field-Goal-Prozent nach Distanz, dort im Bericht zitiert):
//
//   Completion-Quote        65,3 %   (NFL 2024, StatMuse)
//   Yards je Passversuch    7,1      (NFL 2024, StatMuse)
//   Sack-Quote je Dropback  ~7,0 %   (2,42 Sacks / (29,9 Attempts+2,42 Sacks), NFL 2024)
//   Interception-Quote      ~2,1-2,4 %  (aus Turnover-Gesamt minus Fumbles-lost hergeleitet)
//   Fumbles verloren/Team   ~0,5     (271 Fumbles verloren / 272 Spiele 2024, WebSearch)
//   Punkte je Team          22,9     (NFL 2024, StatMuse)
//
// Gezaehlt wird aus fsFbLog (engine.js, "NUR FOOTBALL — SPIEL-WEITER KORRIDOR-MITSCHNITT"),
// nicht aus dem generischen Boxscore: nur dort stehen Passversuche/Sacks/Fumbles/FGs, die
// der generische Feldspieler-Zaehlersatz nicht hergibt (kein "Passversuch"-Ereignis, kein
// echter Spieler fuer ein Field Goal).
//
//   node scripts/miss-football-korridor.mjs [spiele]
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
  const x = window.__arena.feldspielProbe("football", { n, jeSeite: 6 });
  const summe = { punkte: 0, passAtt: 0, passComp: 0, passInt: 0, sacks: 0, rushAtt: 0,
    fumbles: 0, fumblesLost: 0, tds: 0, fgAtt: 0, fgMade: 0, punts: 0, passYards: 0,
    laufYards: 0, fangYards: 0, verluste: 0 };
  const staende = [];
  for (const s of x.spiele) {
    summe.punkte += s.seiten[0] + s.seiten[1];
    staende.push(s.seiten.slice());
    if (s.football) for (const k in summe) if (k in s.football) summe[k] += s.football[k];
    for (const q of s.spieler) {
      summe.passYards += q.passYards || 0; summe.laufYards += q.laufYards || 0;
      summe.fangYards += q.fangYards || 0; summe.verluste += q.verluste || 0;
    }
  }
  return { summe, spiele: x.spiele.length, staende, fehlend: x.fehlend };
}, SPIELE);

const n = w.spiele, jeTeam = (v) => v / n / 2;
const zeile = (was, ist, soll, einheit) =>
  `${was.padEnd(28)} ${String(ist).padStart(7)} ${einheit.padEnd(3)}  Ziel ${soll}`;

console.log(`Football-Korridor — ${n} Spiele, Quelle: ${SEITE}\n`);
console.log(zeile("Punkte je Team", jeTeam(w.summe.punkte).toFixed(1), "22,9 (NFL 2024)", ""));
console.log(zeile("Touchdowns je Team", jeTeam(w.summe.tds).toFixed(2), "~2,4 (4,69/2, NBC-News 2023)", ""));
console.log(zeile("Passversuche je Team", jeTeam(w.summe.passAtt).toFixed(1), "~29,9 (NFL 2024)", ""));
console.log(zeile("Completion-Quote", (100 * w.summe.passComp / Math.max(1, w.summe.passAtt)).toFixed(1), "65,3 (NFL 2024)", "%"));
console.log(zeile("Yards je Passversuch", (w.summe.passYards / Math.max(1, w.summe.passAtt)).toFixed(2), "7,1 (NFL 2024)", ""));
console.log(zeile("Laufversuche je Team", jeTeam(w.summe.rushAtt).toFixed(1), "27,0 (NFL 2024)", ""));
console.log(zeile("Yards je Laufversuch", (w.summe.laufYards / Math.max(1, w.summe.rushAtt)).toFixed(2), "~4,3 (378/544 aus Plan A.1 abgeleitet)", ""));
console.log(zeile("Sack-Quote je Dropback", (100 * w.summe.sacks / Math.max(1, w.summe.passAtt + w.summe.sacks)).toFixed(1), "~7,0 (NFL 2024, hergeleitet)", "%"));
console.log(zeile("Interception-Quote", (100 * w.summe.passInt / Math.max(1, w.summe.passAtt)).toFixed(1), "~2,1-2,4 (hergeleitet)", "%"));
console.log(zeile("Fumbles verloren je Team", jeTeam(w.summe.fumblesLost).toFixed(2), "~0,5 (271 verloren / 272 Spiele, NFL 2024)", ""));
console.log(zeile("Fumbles gesamt je Team", jeTeam(w.summe.fumbles).toFixed(2), "— (verloren + in eigener Hand behalten)", ""));
console.log(zeile("Field Goals gemacht/versucht je Team", `${jeTeam(w.summe.fgMade).toFixed(2)}/${jeTeam(w.summe.fgAtt).toFixed(2)}`, "~1,72/2,16 (Plan A.1)", ""));
console.log(zeile("Field-Goal-Quote", (100 * w.summe.fgMade / Math.max(1, w.summe.fgAtt)).toFixed(1), "~85 (NFL 2024, alle Distanzen)", "%"));
console.log(zeile("Punts je Team", jeTeam(w.summe.punts).toFixed(2), "~4 (Plan A.1, grobe Naeherung)", ""));
console.log(`\nErste Endstaende: ${w.staende.slice(0, 8).map((s) => s.join(":")).join("  ")}`);
console.log(`Seitenfehler: ${seitenfehler.length ? seitenfehler.slice(0, 3).join(" | ") : "keine"}`);
await browser.close();
