// ZIEHT DIE FRISCHEN ZIELWERTE fuer HK_TW_BASIS/HK_TW_REF (docs/design/hockey-opus-review-
// nhl.md Abschnitt 2). Misst zwei Groessen, beide unabhaengig von den beiden Konstanten
// selbst:
//
//   HK_TW_BASIS  Mittelwert von feldspielWert(u,"hockey") ueber alle NICHT-Torwart-
//                Feldspieler (die Formel dort liest HK_TW_* gar nicht).
//   HK_TW_REF    Fangquote der Liga = saves / (saves+gegentore) ueber alle Torwart-Zeilen.
//
// Beide Werte je EINZELKADER (SQUAD/OPP wie sie battle-mode.engine.js hartkodiert) und je
// KADER-FAMILIE (data/generated/kaderfamilie-live-save.json, dieselbe Quelle wie
// miss-alle-disziplinen.mjs) — die Familie ist die fuer die CI-Schranke massgebliche Zahl.
//
//   node scripts/miss-hockey-torwart-konstanten.mjs [spiele]
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const SPIELE = Number(process.argv[2] || 24);
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE
  || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const fehler = [];
let ergebnis;
try {
  const seite = await browser.newPage();
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.feldspielProbe, null, { timeout: 30000 });

  const aggregiereEineProbe = async () => {
    return seite.evaluate((n) => {
      const x = window.__arena.feldspielProbe("hockey", { n, jeSeite: 6 });
      let feldSumme = 0, feldN = 0, saves = 0, gegentore = 0;
      for (const s of x.spiele) for (const q of s.spieler) {
        if (q.torwart) { saves += q.saves || 0; gegentore += q.gegentore || 0; }
        else { feldSumme += q.wert; feldN++; }
      }
      return { feldSumme, feldN, saves, gegentore };
    }, SPIELE);
  };

  const einzelkader = await aggregiereEineProbe();

  let familieRoh = null;
  if (existsSync(KADERFAMILIE_PFAD)) familieRoh = JSON.parse(readFileSync(KADERFAMILIE_PFAD, "utf8"));

  let familie = null;
  if (familieRoh) {
    const teile = [];
    for (const v of familieRoh.varianten) {
      await seite.evaluate((kader) => window.__arena.kaderSetzen(kader), { heim: v.heim, gast: v.gast });
      teile.push({ label: v.label, ...(await aggregiereEineProbe()) });
    }
    // Kader zuruecksetzen, falls die Seite weiterverwendet wird (hier nicht mehr noetig,
    // aber billig und sauberer als eine Seite mit vertauschtem Kader zu hinterlassen).
    await seite.evaluate(() => window.__arena.kaderSetzen({ heim: window.__arena.kader(), gast: window.__arena.opp() }));
    familie = teile;
  }

  ergebnis = { einzelkader, familie, quelle: familieRoh?.quelle };
} finally {
  await browser.close();
}

const basis = (t) => t.feldN ? t.feldSumme / t.feldN : NaN;
const ref = (t) => (t.saves + t.gegentore) ? t.saves / (t.saves + t.gegentore) : NaN;

console.log(`Torwart-Konstanten-Ziehung — ${SPIELE} Spiele je Kader, Quelle: ${SEITE}\n`);
console.log(`Einzelkader (SQUAD/OPP hartkodiert):`);
console.log(`  HK_TW_BASIS (Feldspieler-Mittelwert)  ${basis(ergebnis.einzelkader).toFixed(3)}`);
console.log(`  HK_TW_REF   (Liga-Fangquote)           ${ref(ergebnis.einzelkader).toFixed(4)}  (${ergebnis.einzelkader.saves} saves / ${ergebnis.einzelkader.gegentore} gegentore)`);

if (ergebnis.familie) {
  console.log(`\nKader-Familie (${ergebnis.familie.length} Paarungen, Quelle: live-save ${ergebnis.quelle?.saveName ?? "?"}, gezogen ${ergebnis.quelle?.gezogenAm ?? "?"}):`);
  for (const t of ergebnis.familie) {
    console.log(`  ${t.label.padEnd(28)} BASIS ${basis(t).toFixed(3).padStart(7)}   REF ${ref(t).toFixed(4).padStart(7)}  (${t.saves} saves / ${t.gegentore} gegentore, ${t.feldN} Feldspieler-Zeilen)`);
  }
  const alleFeldSumme = ergebnis.familie.reduce((a, t) => a + t.feldSumme, 0);
  const alleFeldN = ergebnis.familie.reduce((a, t) => a + t.feldN, 0);
  const alleSaves = ergebnis.familie.reduce((a, t) => a + t.saves, 0);
  const alleGegentore = ergebnis.familie.reduce((a, t) => a + t.gegentore, 0);
  const basisFamilie = alleFeldSumme / alleFeldN;
  const refFamilie = alleSaves / (alleSaves + alleGegentore);
  console.log(`\n  GEPOOLT UEBER ALLE ${ergebnis.familie.length} PAARUNGEN (das sind die vorgeschlagenen Zielwerte):`);
  console.log(`    HK_TW_BASIS = ${basisFamilie.toFixed(2)}`);
  console.log(`    HK_TW_REF   = ${refFamilie.toFixed(3)}  (${alleSaves} saves / ${alleGegentore} gegentore ueber ${alleFeldN} Feldspieler-Zeilen als Nenner-Vergleich)`);
  const medianWerte = (feld) => {
    const w = ergebnis.familie.map(feld).sort((a, b) => a - b);
    const m = w.length >> 1;
    return w.length % 2 ? w[m] : (w[m - 1] + w[m]) / 2;
  };
  console.log(`    Median je Paarung: BASIS ${medianWerte(basis).toFixed(2)}, REF ${medianWerte(ref).toFixed(3)}`);
} else {
  console.log(`\nKein kaderfamilie-live-save.json gefunden unter ${KADERFAMILIE_PFAD} — nur Einzelkader gemessen.`);
}

console.log(`\nSeitenfehler: ${fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"}`);
