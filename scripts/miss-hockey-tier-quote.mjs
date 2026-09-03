// TREFFERQUOTE JE DISTANZSTUFE (Hockey) — Zwischenwerkzeug fuer den korrektur-Fit von
// FELDSPIEL_ART.hockey.kurve (Aufbau, docs/design/hockey-eigene-erfolgskurve.md).
//
// Liefert Ist-Trefferquote je Tier (dunk/nah/mit/fern) aus dem echten Wurfprotokoll,
// damit korrektur[tier] = logit(Soll) - logit(Ist) gerechnet werden kann — Zeichen fuer
// Zeichen dieselbe Methode wie Basketballs MAKE_KORREKTUR (s. battle-mode.engine.js,
// JENSEN-KORREKTUR-Kommentar).
//
//   node scripts/miss-hockey-tier-quote.mjs [spiele]
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
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.feldspielProbe, null, { timeout: 30000 });

const daten = await seite.evaluate((n) => window.__arena.feldspielProbe("hockey", { n }), SPIELE);
await browser.close();

const tiere = ["dunk", "nah", "mit", "fern"];
const agg = Object.fromEntries(tiere.map((t) => [t, { v: 0, m: 0 }]));
let gesamtV = 0, gesamtM = 0;
for (const g of daten.spiele) for (const p of g.spieler) {
  const t = p.fgTier || {};
  for (const tier of tiere) {
    const z = t[tier]; if (!z) continue;
    const v = z.offenV + z.engV, m = z.offenT + z.engT;
    agg[tier].v += v; agg[tier].m += m; gesamtV += v; gesamtM += m;
  }
}
const logit = (p) => Math.log(p / (1 - p));
console.log(`Hockey Trefferquote je Distanzstufe — ${daten.spiele.length} Spiele, n=${gesamtV} Versuche\n`);
console.log("Tier   Versuche   Treffer   Quote     logit(Quote)");
for (const tier of tiere) {
  const z = agg[tier];
  const q = z.v ? z.m / z.v : NaN;
  console.log(`${tier.padEnd(6)}${String(z.v).padStart(9)}${String(z.m).padStart(10)}` +
    `${z.v ? (100 * q).toFixed(1).padStart(9) + "%" : "     —  "}` +
    `${z.v && q > 0 && q < 1 ? logit(q).toFixed(3).padStart(14) : "        —".padStart(14)}`);
}
console.log(`\nGesamt: ${gesamtV} Versuche, ${gesamtM} Treffer, Quote ${(100 * gesamtM / gesamtV).toFixed(1)}%`);
console.log("\nSeitenfehler: " + (fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"));
