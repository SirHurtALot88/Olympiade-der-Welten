// ===================================================================================
// IST DIE HOEHENKORREKTUR STABIL? — der Wert selbst, nicht aus Pixelhoehen zurueckgerechnet.
//
// `hoehenKorrektur(u)` (battle-mode.engine.js) misst einmal je Figur, wie hoch ihr
// Sprite-Blatt WIRKLICH zeichnet, und skaliert auf HOEHEN_BEZUG. Danach soll die
// Bildschirmhoehe nur noch an `groesse` haengen. Bis 13.09. tat sie das nicht: der
// Messdurchlauf rief ueber zeichneSprite() sich selbst zurueck, lief rund zweitausend Ebenen
// tief in einen Stapelueberlauf, und welcher der beiden Werte des dabei entstehenden
// Zweierzyklus gespeichert wurde, entschied die PARITAET der zufaelligen Ueberlauftiefe.
// Gleiche Figur, gleiche Seite, anderer Wert — s. docs/design/hoehenkorrektur-rekursion-13-09.md.
//
//   node scripts/miss-hoehenkorrektur.mjs
//
// Geprueft wird deshalb nicht "ist der Wert richtig" (das sagt miss-figurgroessen.mjs ueber
// die gerenderte Hoehe), sondern "ist der Wert ueberhaupt EINE Zahl":
//   1. derselbe Name aus verschieden tiefen Aufrufstapeln -> muss immer dasselbe liefern,
//   2. derselbe Name mehrfach frisch gemessen         -> muss immer dasselbe liefern.
// Jede Abweichung ist ein Rueckfall in genau diesen Fehler.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.hoehenKorrProbe, null, { timeout: 30000 });
await seite.waitForTimeout(3000);

const erg = await seite.evaluate(() => {
  const A = window.__arena;
  // n zusaetzliche Rahmen vor dem Aufruf: macht die Paritaets-Abhaengigkeit sichtbar.
  const tief = (k, n) => (k > 0 ? tief(k - 1, n) : A.hoehenKorrProbe(n, true));
  const out = [];
  for (const s of [...A.kader(), ...A.opp()]) {
    const stapel = [0, 1, 2, 3, 17, 200].map((k) => +tief(k, s.n).korr.toFixed(4));
    const wieder = [1, 2, 3, 4, 5].map(() => +A.hoehenKorrProbe(s.n, true).korr.toFixed(4));
    const p = A.hoehenKorrProbe(s.n);
    out.push({ n: s.n, groesse: s.groesse, art: p.vollbild || "Baukasten",
      deckel: p.deckel, stapel, wieder });
  }
  return out;
});
await browser.close();

let uneins = 0, wackelt = 0, amDeckel = 0;
console.log(`Hoehenkorrektur — ${erg.length} Figuren, Quelle: ${SEITE}\n`);
console.log("Name                  groesse  korr    Blattart          stapelfest  wiederholfest");
for (const r of erg.sort((a, b) => a.stapel[0] - b.stapel[0])) {
  const eins = new Set(r.stapel).size === 1;
  const stabil = new Set(r.wieder).size === 1;
  if (!eins) uneins++;
  if (!stabil) wackelt++;
  if (eins && (r.stapel[0] === r.deckel[0] || r.stapel[0] === r.deckel[1])) amDeckel++;
  console.log(`${r.n.padEnd(22)}${String(r.groesse ?? "—").padStart(7)}${r.stapel[0].toFixed(4).padStart(9)}` +
    `  ${String(r.art).padEnd(18)}${(eins ? "ja" : "NEIN " + [...new Set(r.stapel)].join("/")).padEnd(12)}` +
    `${stabil ? "ja" : "NEIN " + [...new Set(r.wieder)].join("/")}`);
}
console.log(`\nStapelabhaengig: ${uneins} von ${erg.length}   zwischen Wiederholungen wackelnd: ${wackelt} von ${erg.length}`);
console.log(`Am Deckel (${erg[0].deckel[0]} bzw. ${erg[0].deckel[1]}): ${amDeckel} — das ist kein Fehler, sondern der`);
console.log(`bestimmungsgemaesse Anschlag fuer besonders flach oder besonders hoch gezeichnete Blaetter.`);
console.log(`\nBEFUND: ${uneins + wackelt === 0 ? "stabil" : "INSTABIL — s. docs/design/hoehenkorrektur-rekursion-13-09.md"}`);
console.log(`Seitenfehler: ${fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"}`);
process.exit(uneins + wackelt === 0 ? 0 : 1);
