// ===================================================================================
// RANGTREUE FUER "DIE HATZ" — Spurt im neuen Format (08.11., s.
// docs/design/spurt-format-die-hatz-08-11.md). Dasselbe Verfahren wie
// scripts/miss-alle-disziplinen.mjs (Kader-FAMILIE, Median + Spannweite statt einer
// einzelnen Ziehung, s. dessen Kopfkommentar/docs/design/messgrundlage-kaderfest.md) --
// nur auf "spurt" verdrahtet und VOR jedem Spiel-Durchlauf das neue Format ueber
// window.__arena.bahnFlags({spurtFormat:"hatz"}) angefordert.
//
// WARUM NICHT EINFACH miss-alle-disziplinen.mjs spurt: dessen Spiele laufen alle ohne
// Format-Parameter (Pflicht, s. CLAUDE.md/Auftrag: `pruefe-wertung-fingerabdruck.mjs`
// misst GENAU so und darf sich durch dieses Format-Fundament nicht aendern). Die
// Pflichtpruefung fuer "Die Hatz" selbst braucht deshalb eine eigene, kleine Messung,
// die den Schalter explizit setzt -- disziplinMessen() (scripts/lib/rangtreue-messung.mjs)
// bleibt dieselbe Rechnung wie fuer jede andere Disziplin.
//
//   node scripts/miss-spurt-hatz-rangtreue.mjs [spiele]
//   node scripts/miss-spurt-hatz-rangtreue.mjs 24
//
// Schranke (CLAUDE.md): rho je Spiel (Median ueber die Kader-Familie) > 0,80, angestrebt
// 0,85 -- EINES Spiels, nicht der Saison.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
import { disziplinMessen, ladeKaderFamilieAusDatei, baueSynthetischeKaderFamilie } from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE
  || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const SPIELE = Number(process.argv[2] || 24);

let kaderQuelle, kaderFamilie;
const geladen = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
if (geladen) { kaderFamilie = geladen.familie; kaderQuelle = geladen.quelle; }

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
let zeile, zeileKlassisch, fehler = [];
try {
  const seite = await browser.newPage();
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.disziplinProbe && window.__arena.bahnFlags, null, { timeout: 30000 });

  if (!kaderFamilie) {
    const gebaut = await baueSynthetischeKaderFamilie(seite);
    kaderFamilie = gebaut.familie;
    kaderQuelle = gebaut.quelle + " (Kopfkommentar dieses Skripts erklaert, wann das greift)";
  }

  // KLASSISCH ALS KONTROLLWERT: dieselbe Kader-Familie, derselbe Code, nur ohne den
  // Schalter -- zeigt, dass die beiden Formate wirklich unterschiedliche Zahlen liefern
  // und nicht aus Versehen denselben Pfad messen.
  await seite.evaluate(() => window.__arena.bahnFlags({ spurtFormat: "klassisch" }));
  zeileKlassisch = await disziplinMessen(seite, "spurt", { n: SPIELE, kaderFamilie });

  await seite.evaluate(() => window.__arena.bahnFlags({ spurtFormat: "hatz" }));
  zeile = await disziplinMessen(seite, "spurt", { n: SPIELE, kaderFamilie });
  // Schalter zuruecksetzen, bevor die Seite geschlossen wird -- reine Hygiene, falls
  // dieses Skript je mit einer schon laufenden Seite wiederverwendet wird.
  await seite.evaluate(() => window.__arena.bahnFlags({ spurtFormat: "klassisch" }));
} finally {
  await browser.close();
}

console.log(`Spurt "Die Hatz" — Rangtreue, ${SPIELE} Spiele je Kader-Variante, ${kaderFamilie.length} Varianten`);
console.log(`Kader-Quelle: ${kaderQuelle}\n`);
console.log("Format      Teiln.  rho je Spiel (Median)  Spannweite  rho Saison (Median)  Spannweite   Abnahme");
for (const [label, z] of [["klassisch", zeileKlassisch], ["hatz", zeile]]) {
  if (z.fehler) { console.log(label.padEnd(12) + "— " + z.fehler); continue; }
  const ok = z.spielMed >= 0.80 ? "bestanden" : z.spielMed >= 0.70 ? "knapp" : "durchgefallen";
  console.log(label.padEnd(12)
    + String(z.teilnehmer).padStart(5)
    + z.spielMed.toFixed(3).padStart(23) + z.spielSpan.toFixed(3).padStart(12)
    + z.saisonMed.toFixed(3).padStart(21) + z.saisonSpan.toFixed(3).padStart(12)
    + "   " + ok);
}
console.log("\nSchranke: rho je Spiel (Median ueber die Kader-Familie) ueber 0,80, angestrebt 0,85 (CLAUDE.md).");
console.log("Seitenfehler: " + (fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"));
