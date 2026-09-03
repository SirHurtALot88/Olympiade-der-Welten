// SKILL_MITTEL-AEQUIVALENT FUER HOCKEYS EIGENE KURVE — eine Messung, keine Handzahl.
//
// FB().kurve.skillMittel MUSS laut Auftrag "Ausgabe der Sonde sein (gewichtetes Mittel
// der eigenen skillTerme ueber den echten Kader), niemals handgesetzt" — exakt wie
// Basketballs SKILL_MITTEL=0,2917 einmal gegen 1074 echte Feldwuerfe gemessen wurde
// (s. battle-mode.engine.js, KURVE_BASKETBALL-Kommentar).
//
// Hockeys skillTerme sind (nach Streichung von TEAMGEIST, s. Auftrag Punkt 2) genau EIN
// Term: {feld:"SCHUSS_TIER", koeff:X} — schussSkillFuer(u,tier) waehlt SCHUSS_NAH bei
// dunk/nah, sonst SCHUSS_FERN. skillMittel ist damit koeff * (mit Schussversuchen
// gewichteter Mittelwert von schussSkillFuer ueber ALLE genommenen Schuesse).
//
// Diese Messung braucht KEINEN eigenen kurve-Block: die Verteilung der Schuesse auf
// dunk/nah/mit/fern haengt an der Aufstellung/Distanz/Schwelle, nicht an der
// Erfolgsformel selbst — sie laesst sich also gegen den heutigen (Basketball-Rueckfall-)
// Stand messen, genau wie Basketballs Messwert gegen den "eingefrorenen Vorher-Stand"
// gemessen wurde (kein Zirkelschluss).
//
//   node scripts/miss-hockey-skillmittel.mjs [spiele] [koeff]
//
// Ohne koeff wird nur der ROHE gewichtete Mittelwert von schussSkillFuer ausgegeben;
// mit koeff zusaetzlich skillMittel = koeff * roh, fertig zum Einsetzen in den
// kurve-Block.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const SPIELE = Number(process.argv[2] || 24);
const KOEFF = process.argv[3] != null ? Number(process.argv[3]) : null;
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const seite = await browser.newPage();
const fehler = [];
seite.on("pageerror", (e) => fehler.push(String(e)));
await seite.goto(SEITE, { waitUntil: "networkidle" });
await seite.waitForFunction(() => window.__arena && window.__arena.feldspielProbe, null, { timeout: 30000 });

const daten = await seite.evaluate((n) => window.__arena.feldspielProbe("hockey", { n }), SPIELE);
await browser.close();

if (!daten.live) {
  console.error("hockey faehrt den VORAB-Pfad, keine Wurfprotokoll-Daten. Fehlend: " + (daten.fehlend || []).join(", "));
  process.exit(1);
}

// Gewichteter Mittelwert von schussSkillFuer ueber ALLE Schussversuche: dunk+nah
// zaehlen mit SCHUSS_NAH des Schuetzen, mit+fern mit SCHUSS_FERN — exakt die Weiche,
// die schussSkillFuer(u,tier) im Motor selbst trifft.
let summeGewichtet = 0, summeVersuche = 0;
const nachTier = { dunk: { v: 0, s: 0 }, nah: { v: 0, s: 0 }, mit: { v: 0, s: 0 }, fern: { v: 0, s: 0 } };
for (const g of daten.spiele) {
  for (const p of g.spieler) {
    const t = p.fgTier || {};
    for (const tier of ["dunk", "nah"]) {
      const v = t[tier] ? t[tier].offenV + t[tier].engV : 0;
      if (!v) continue;
      nachTier[tier].v += v; nachTier[tier].s += v * (p.SCHUSS_NAH || 0);
      summeVersuche += v; summeGewichtet += v * (p.SCHUSS_NAH || 0);
    }
    for (const tier of ["mit", "fern"]) {
      const v = t[tier] ? t[tier].offenV + t[tier].engV : 0;
      if (!v) continue;
      nachTier[tier].v += v; nachTier[tier].s += v * (p.SCHUSS_FERN || 0);
      summeVersuche += v; summeGewichtet += v * (p.SCHUSS_FERN || 0);
    }
  }
}
const roh = summeVersuche ? summeGewichtet / summeVersuche : NaN;

console.log(`Hockey SCHUSS_TIER-Mittel — ${daten.spiele.length} Spiele, n=${summeVersuche} Schussversuche\n`);
console.log("Tier   Versuche   Anteil   Mittel(SCHUSS_NAH/FERN je nach Tier)");
for (const tier of ["dunk", "nah", "mit", "fern"]) {
  const z = nachTier[tier];
  console.log(`${tier.padEnd(6)}${String(z.v).padStart(9)}${z.v ? (100 * z.v / summeVersuche).toFixed(1).padStart(8) + "%" : "    —  "}${z.v ? (z.s / z.v).toFixed(2).padStart(10) : "        —"}`);
}
console.log(`\nGewichteter Mittelwert schussSkillFuer ueber alle Versuche: ${roh.toFixed(4)}`);
if (KOEFF != null) console.log(`skillMittel bei koeff=${KOEFF}: ${(KOEFF * roh).toFixed(4)}`);
console.log("\nSeitenfehler: " + (fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"));
