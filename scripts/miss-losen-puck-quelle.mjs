// ===================================================================================
// WORAN HAENGT DER LOSE PUCK — AM KOENNEN ODER AM STANDPLATZ?
//
// Chris' Fund (02.09.): "die gewonnenen losen Pucks tragen 40 Prozent der Wertung und
// haengen an der Aufstellungsposition statt an Attributen. Wer vorm Tor steht, holt sie."
//
// Die Rangtreue-Skripte koennen das nicht beantworten. Sie messen mit zwoelf Spielern,
// und eine Spearman-Rangfolge ueber zehn Feldspieler hat einen Standardfehler von rund
// 0,15 — eine Verschiebung von 0,02 ist darin unsichtbar. Diese Sonde misst deshalb
// nicht die Rangtreue, sondern direkt die URSACHE: haengt die Zahl der gewonnenen losen
// Pucks staerker an ZWEITCHANCE (Koennen) oder an SCHUSS_NAH (Standplatz)?
//
// SCHUSS_NAH ist der Standplatz. Die Slot-Vergabe (zuordneSlots) sortiert nach genau
// diesem Wert: der hoechste SCHUSS_NAH bekommt den Netfront-Slot 78 px vor dem Tor, der
// niedrigste die blaue Linie bei 295 px. Wer also den losen Puck ueber die Aufstellung
// bekommt, bekommt ihn ueber SCHUSS_NAH — obwohl dieses Attribut mit dem Aufsammeln
// eines Abprallers nichts zu tun hat.
//
// Gerechnet wird INNERHALB des Teams (z-Werte je Seite), weil die Slot-Vergabe je Team
// laeuft: gegen die absoluten Werte gerechnet wuerde die Teamstaerke beide Korrelationen
// gleichzeitig aufblasen.
//
//   node scripts/miss-losen-puck-quelle.mjs [spiele] [saat]
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const SPIELE = Number(process.argv[2] || 40);
const SAAT = Number(process.argv[3] || 1337);
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.feldspielProbe, null, { timeout: 30000 });

const roh = await seite.evaluate(([n, saat]) => {
  const x = window.__arena.feldspielProbe("hockey", { n, jeSeite: 6, saat0: saat });
  const agg = new Map();
  for (const s of x.spiele)
    for (const q of s.spieler) {
      const a = agg.get(q.n) || { n: q.n, side: q.side, eig: q.eig, torwart: 0,
        rebounds: 0, spiele: 0, zweit: 0, nah: 0, tempo: 0 };
      a.rebounds += q.rebounds; a.torwart += q.torwart ? 1 : 0; a.spiele++;
      a.zweit += q.ZWEITCHANCE || 0; a.nah += q.SCHUSS_NAH || 0; a.tempo += q.LAUFTEMPO || 0;
      agg.set(q.n, a);
    }
  return [...agg.values()].map((a) => ({ n: a.n, side: a.side, eig: a.eig,
    torwart: a.torwart > a.spiele / 2,
    rebounds: a.rebounds / a.spiele, ZWEITCHANCE: a.zweit / a.spiele,
    SCHUSS_NAH: a.nah / a.spiele, LAUFTEMPO: a.tempo / a.spiele }));
}, [SPIELE, SAAT]);
await browser.close();

const feld = roh.filter((r) => !r.torwart);
if (!feld.length) { console.error("Keine Feldspieler in der Probe."); process.exit(1); }

// z-Werte je Seite: die Slot-Vergabe laeuft je Team, also muss der Vergleich das auch.
const zJeSeite = (key) => {
  const aus = new Map();
  for (const s of [0, 1]) {
    const gruppe = feld.filter((r) => r.side === s);
    const m = gruppe.reduce((a, r) => a + r[key], 0) / gruppe.length;
    const sd = Math.sqrt(gruppe.reduce((a, r) => a + (r[key] - m) ** 2, 0) / gruppe.length) || 1;
    for (const r of gruppe) aus.set(r.n, (r[key] - m) / sd);
  }
  return aus;
};
const pearson = (a, b) => {
  const n = a.length;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; sa += da * da; sb += db * db; }
  return sab / Math.sqrt(sa * sb || 1);
};

const zReb = zJeSeite("rebounds"), zZweit = zJeSeite("ZWEITCHANCE"),
      zNah = zJeSeite("SCHUSS_NAH"), zTempo = zJeSeite("LAUFTEMPO");
const namen = feld.map((r) => r.n);
const v = (m) => namen.map((n) => m.get(n));

const rZweit = pearson(v(zReb), v(zZweit));
const rNah = pearson(v(zReb), v(zNah));
const rTempo = pearson(v(zReb), v(zTempo));

console.log(`Woran haengt der lose Puck? — hockey, ${SPIELE} Spiele, Saat ${SAAT}`);
console.log(`Feldspieler ${feld.length}, z-Werte je Seite\n`);
const rZweitNah = pearson(v(zZweit), v(zNah));
const rZweitTempo = pearson(v(zZweit), v(zTempo));
// PARTIALKORRELATION. Die rohen Zahlen oben reichen nicht: ZWEITCHANCE und SCHUSS_NAH
// haengen selbst zusammen (beide fuehren power), und die Slot-Vergabe sortiert nach
// SCHUSS_NAH. Ein roher Zusammenhang zwischen Standplatz und losem Puck kann deshalb
// vollstaendig ueber das Koennen laufen. Erst die Partialkorrelation — SCHUSS_NAH bei
// festgehaltenem ZWEITCHANCE — beantwortet Chris' Frage: bleibt vom Standplatz etwas
// uebrig, wenn zwei gleich gute Rebounder verschieden weit vorne stehen?
const partial = (rxy, rxz, ryz) =>
  (rxy - rxz * ryz) / Math.sqrt((1 - rxz * rxz) * (1 - ryz * ryz) || 1e-9);
const pNah = partial(rNah, rZweit, rZweitNah);
const pTempo = partial(rTempo, rZweit, rZweitTempo);

console.log(`  ZWEITCHANCE (Koennen)     r = ${rZweit.toFixed(3)}`);
console.log(`  SCHUSS_NAH  (Standplatz)  r = ${rNah.toFixed(3)}   partial (ohne Koennen) = ${pNah.toFixed(3)}`);
console.log(`  LAUFTEMPO   (Wettlauf)    r = ${rTempo.toFixed(3)}   partial (ohne Koennen) = ${pTempo.toFixed(3)}`);
console.log(`  Nebenbei: ZWEITCHANCE vs SCHUSS_NAH r = ${rZweitNah.toFixed(3)}`);
console.log(`\n  Vorsprung Koennen vor Standplatz: ${(rZweit - rNah).toFixed(3)}\n`);

console.log("Name                   Seite   Reb/Sp  ZWEITCH  SCHUSS_NAH  LAUFTEMPO");
for (const r of [...feld].sort((a, b) => b.rebounds - a.rebounds))
  console.log(r.n.padEnd(22) + String(r.side).padStart(5)
    + r.rebounds.toFixed(2).padStart(9) + r.ZWEITCHANCE.toFixed(1).padStart(9)
    + r.SCHUSS_NAH.toFixed(1).padStart(12) + r.LAUFTEMPO.toFixed(1).padStart(11));

console.log("\nSeitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
