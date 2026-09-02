// ===================================================================================
// WER ZIEHT DIE RANGTREUE RUNTER? — dieselbe Frage wie miss-feldspiel-rangtreue.mjs,
// aber je ROLLE getrennt.
//
// Die Rangtreue misst, ob der Spieler mit der hoeheren Eignung auch mehr bewirkt. Faellt
// sie, sagt die eine Zahl nicht, WO es klemmt. Im Eishockey war genau das der Fall: rho
// lag bei 0,587, aber ohne die beiden Torwaerter gerechnet bei 0,830 — die Luecke sass
// vollstaendig in einer Rolle, deren Wertformel eine andere ist als die der Feldspieler.
// Ohne diese Aufteilung haette man am Rezept der Feldspieler gedreht und nichts gefunden.
//
//   node scripts/miss-rangtreue-nach-rolle.mjs [disziplin] [spiele] [saat]
//
// Spearman ueber die je Spieler gemittelten Werte, nicht je Spiel — ein einzelnes Spiel
// ist zu laut, um eine Rangfolge zu tragen.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const DISZIPLIN = process.argv[2] || "hockey";
const SPIELE = Number(process.argv[3] || 24);
const SAAT = Number(process.argv[4] || 1337);
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.feldspielProbe, null, { timeout: 30000 });

const spieler = await seite.evaluate(([d, n, saat]) => {
  const x = window.__arena.feldspielProbe(d, { n, jeSeite: 6, saat0: saat });
  const agg = new Map();
  for (const s of x.spiele)
    for (const q of s.spieler) {
      const a = agg.get(q.n) || { n: q.n, eig: q.eig, wert: 0, tw: 0, spiele: 0,
        punkte: 0, saves: 0, checks: 0, verluste: 0 };
      a.wert += q.wert; a.punkte += q.punkte; a.saves += q.saves || 0;
      a.checks += q.checks || 0; a.verluste += q.verluste;
      a.tw += q.torwart ? 1 : 0; a.spiele++; agg.set(q.n, a);
    }
  return [...agg.values()].map((a) => ({ ...a,
    wert: a.wert / a.spiele, punkte: a.punkte / a.spiele, saves: a.saves / a.spiele,
    checks: a.checks / a.spiele, verluste: a.verluste / a.spiele,
    torwart: a.tw > a.spiele / 2 }));
}, [DISZIPLIN, SPIELE, SAAT]);
await browser.close();

const rho = (rows) => {
  const n = rows.length;
  if (n < 3) return NaN;
  const rang = (key) => {
    const s = [...rows].sort((x, y) => y[key] - x[key]);
    const r = new Map(); s.forEach((v, i) => r.set(v.n, i + 1)); return r;
  };
  const re = rang("eig"), rw = rang("wert");
  let d2 = 0;
  for (const x of rows) { const d = re.get(x.n) - rw.get(x.n); d2 += d * d; }
  return 1 - (6 * d2) / (n * (n * n - 1));
};

const feld = spieler.filter((x) => !x.torwart);
const tw = spieler.filter((x) => x.torwart);
console.log(`Rangtreue nach Rolle — ${DISZIPLIN}, ${SPIELE} Spiele, Saat ${SAAT}\n`);
console.log(`Spieler gesamt ${spieler.length}, davon Torwart ${tw.length}`);
console.log(`rho ueber alle       ${rho(spieler).toFixed(3)}`);
console.log(`rho nur Feldspieler  ${rho(feld).toFixed(3)}`);
console.log(`Luecke durch die Rolle ${(rho(feld) - rho(spieler)).toFixed(3)}\n`);
console.log("Name                  eig  Rang   Wert  Rang   Tore  Saves  Checks  Verl  Rolle");
const re = [...spieler].sort((a, b) => b.eig - a.eig).map((x) => x.n);
const rw = [...spieler].sort((a, b) => b.wert - a.wert).map((x) => x.n);
for (const x of [...spieler].sort((a, b) => b.eig - a.eig)) {
  const z = (v, b, k = 1) => String(typeof v === "number" ? v.toFixed(k) : v).padStart(b);
  console.log(`${x.n.padEnd(21)}${z(x.eig, 5)} ${z(re.indexOf(x.n) + 1, 5, 0)} ${z(x.wert, 6)} ` +
    `${z(rw.indexOf(x.n) + 1, 5, 0)} ${z(x.punkte, 6)} ${z(x.saves, 6)} ${z(x.checks, 7)} ${z(x.verluste, 5)}  ${x.torwart ? "Torwart" : ""}`);
}
console.log(`\nSeitenfehler: ${fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"}`);
