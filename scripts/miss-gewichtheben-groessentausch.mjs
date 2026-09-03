// GEWICHTHEBEN S5 — GROESSENTAUSCH-TEST (Plan Abschnitt 8.1): dieselbe Saat mit
// vertauschten Groessen darf KEIN Ergebnis aendern, nur die Anzeige-kg (Sinclair rueckwaerts,
// Plan 6.3). Manipuliert SQUAD/OPP direkt ueber window.__arena.kader() (dieselbe Referenz,
// die bauBuehne liest) und vergleicht spiele("gewichtheben", saat).protokoll vor/nach dem
// Tausch — alles AUSSER groesse/anzeigeKg muss zeichengleich sein.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SAAT = Number(process.argv[2] || 1337);

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.spiele, null, { timeout: 30000 });

const vorher = await seite.evaluate((saat) => window.__arena.spiele("gewichtheben", saat).protokoll, SAAT);

// Groessen vertauschen: erster <-> letzter Heber je Seite (extremer Kontrast, damit ein
// etwaiger Effekt nicht im Rauschen untergeht) — direkt im Kader, derselbe Weg wie eine
// echte Umbesetzung der Groessen-Zuordnung im Datensatz.
const tausch = await seite.evaluate(() => {
  const k = window.__arena.kader();
  const a = k[0], b = k[k.length - 1];
  const tmp = a.groesse; a.groesse = b.groesse; b.groesse = tmp;
  return { a: a.n, b: b.n, agroesse: a.groesse, bgroesse: b.groesse };
});
const nachher = await seite.evaluate((saat) => window.__arena.spiele("gewichtheben", saat).protokoll, SAAT);
await browser.close();

const byName = (prot) => new Map(prot.map((u) => [u.n, u]));
const v = byName(vorher), n = byName(nachher);
let mechanikGleich = true, anzeigeGeaendert = false;
const abweichungen = [];
for (const [name, uv] of v) {
  const un = n.get(name);
  if (!un) { abweichungen.push(`${name}: fehlt nachher`); mechanikGleich = false; continue; }
  // Mechanik-Felder: alles, was das ERGEBNIS ist, nicht die Anzeige.
  const mechFelder = ["summe", "zweikampf", "nullwertung", "duellGewonnen", "eig", "LAST", "TECHNIK", "NERVEN", "ANSAGE", "ERHOLUNG"];
  for (const f of mechFelder) {
    if (JSON.stringify(uv[f]) !== JSON.stringify(un[f])) {
      mechanikGleich = false;
      abweichungen.push(`${name}.${f}: ${JSON.stringify(uv[f])} -> ${JSON.stringify(un[f])}`);
    }
  }
  const rundenGleich = JSON.stringify(uv.runden.map((r) => ({ kg: r.kg, gueltig: r.gueltig }))) ===
    JSON.stringify(un.runden.map((r) => ({ kg: r.kg, gueltig: r.gueltig })));
  if (!rundenGleich) { mechanikGleich = false; abweichungen.push(`${name}.runden (kg/gueltig): unterschiedlich`); }
  if (uv.anzeigeKg !== un.anzeigeKg) anzeigeGeaendert = true;
}

console.log(`Groessentausch-Test — Saat ${SAAT}, getauscht: ${tausch.a} <-> ${tausch.b} ` +
  `(neue Groessen ${tausch.agroesse}/${tausch.bgroesse})\n`);
console.log(`Mechanik (summe/zweikampf/nullwertung/duellGewonnen/eig/Subskills/Versuchsprotokoll) ` +
  `identisch: ${mechanikGleich ? "JA" : "NEIN"}`);
if (abweichungen.length) { console.log("Abweichungen:"); for (const a of abweichungen.slice(0, 20)) console.log("  " + a); }
console.log(`Anzeige-kg (anzeigeKg) hat sich fuer die getauschten Heber geaendert: ${anzeigeGeaendert ? "JA (erwartet)" : "NEIN (unerwartet)"}`);
console.log(`\nAbnahme: ${mechanikGleich && anzeigeGeaendert ? "BESTANDEN — Groesse wirkt nur auf die Anzeige." : "NICHT bestanden."}`);
console.log("\nSeitenfehler: " + (fehler.length ? fehler.join(" | ") : "keine"));
