// ===================================================================================
// WEG C FREIE STATIONSWAHL — "KEIN KNOPF IST IMMER BESSER" (Flag 10, 05.10.). Reine Messung.
// docs/design/gewichtheben-sandsack-wegc-freie-stationswahl-05-10.md, Abschnitt 5.
//
// Misst die MANNSCHAFTSEBENE von Flag 10 gepaart: dieselben Spiele, Saaten, Formkarten,
// Mutatoren und Wuerfe, einmal je Stationswahl-Modus. Ohne Spielerwert (freiOhneNote 1), daher
// schnell. Je Seite und Spiel: Arbeitswert (die Mannschaftswertung bei freiWertung 1), Silo-kg,
// Wechsel, erzwungenes "durch", Pausen. Dazu Duelle: eine Seite mit Modus X, die andere fest.
//
//   node scripts/miss-sandsack-wegc-frei-knopf.mjs [spiele=24] [--basis=k:v,...]
//
// --basis setzt Schluessel von SANDSACK_PAR_KONF fuer ALLE Vergleiche (z.B. freiWertung:0).
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
import { ladeKaderFamilieAusDatei, baueSynthetischeKaderFamilie } from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE
  || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SPIELE = Number(process.argv.slice(2).find((a) => !a.startsWith("--")) || 24);
const BASIS = Object.fromEntries(((process.argv.find((a) => a.startsWith("--basis=")) || "--basis=")
  .slice(8).split(",").filter(Boolean).map((t) => { const [k, v] = t.split(":"); return [k, Number(v)]; })));

// Die Vergleiche. "fest" ist die Bezugsgroesse (= Flag 9 mit derselben Wertung).
const KONFIG = [
  ["fest (kein Wechsel, = Flag 9)", { freiModus: 1 }],
  ["KI, echte awareness (Stand)", { freiModus: 0 }],
  ["KI, alle awareness 100", { freiModus: 0, freiAwFest: 100 }],
  ["KI, alle awareness 50", { freiModus: 0, freiAwFest: 50 }],
  ["KI, alle awareness 0", { freiModus: 0, freiAwFest: 0 }],
  ["Orakel (Vorschau ohne Rauschen/Sturheit)", { freiModus: 4 }],
  ["zufaellig, gleiche Wechselrate wie KI", { freiModus: 3 }],
  ["zufaellig gleichverteilt (schlechtester Fall)", { freiModus: 2 }],
];
const DUELLE = [
  ["Heim KI (echte aw) gegen Gast fest", { freiModusHeim: 0, freiModusGast: 1 }, { freiModusHeim: 1, freiModusGast: 0 }],
  ["Heim aw 100 gegen Gast aw 0 (beide KI)", { freiAwHeim: 100, freiAwGast: 0 }, { freiAwHeim: 0, freiAwGast: 100 }],
  ["Heim zufaellig (Rate) gegen Gast fest", { freiModusHeim: 3, freiModusGast: 1 }, { freiModusHeim: 1, freiModusGast: 3 }],
];

const mittel = (w) => (w.length ? w.reduce((a, b) => a + b, 0) / w.length : NaN);
const se = (w) => { const m = mittel(w); return Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, w.length - 1) / w.length); };

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const fehler = [];
try {
  const seite = await browser.newPage();
  await seite.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.spieleSandsackWegC && window.__arena.sandsackParKalib, null, { timeout: 30000 });
  const vorgabe = await seite.evaluate(() => window.__arena.sandsackParKalib({}));
  const basis = { ...vorgabe, ...BASIS, freiOhneNote: 1 };
  let kaderFamilie, kaderQuelle;
  const geladen = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
  if (geladen) { kaderFamilie = geladen.familie; kaderQuelle = geladen.quelle; }
  else { const g = await baueSynthetischeKaderFamilie(seite); kaderFamilie = g.familie; kaderQuelle = g.quelle; }
  console.log(`Knopf-Sonde Flag 10 — ${SPIELE} Spiele je Paarung, ${kaderFamilie.length} Paarungen (${kaderQuelle})`);
  console.log(`Basis: ${JSON.stringify(BASIS)} (Rest Vorgabe), Wertung ${basis.freiWertung === 1 ? "Arbeitswert" : "Silo-kg"}\n`);

  const spiel = (saat, i, k) => seite.evaluate(([saat, fs, ms, k, basis]) => {
    window.__arena.sandsackParKalib({ ...basis, ...k });
    const r = window.__arena.spieleSandsackWegC("gewichtheben", saat, { formSaat: fs, mutatorSaat: ms, flag: 10 });
    window.__arena.sandsackParKalib(basis);
    const L = r.wegc.laeufe[0];
    const erz = [0, 1].map((s) => { const e = L.entsch[s]; const a = e.normal + e.durch + e.direkt + e.erzwungen; return a ? e.erzwungen / a : 0; });
    return { arbeit: L.arbeit, kg: L.abgeliefertKg, sieger: L.sieger, wechsel: L.wechsel, erz, pausen: L.pausen };
  }, [saat, 20260823 + i * 104729, 20260823 + i * 15485863, k, basis]);

  const erg = KONFIG.map(() => []);
  const duell = DUELLE.map(() => [0, 0, 0]);
  for (const v of kaderFamilie) {
    await seite.evaluate((k) => window.__arena.kaderSetzen(k), { heim: v.heim, gast: v.gast });
    for (let i = 0; i < SPIELE; i++) {
      const saat = 1337 + i * 7919;
      for (let c = 0; c < KONFIG.length; c++) erg[c].push(await spiel(saat, i, KONFIG[c][1]));
      for (let d = 0; d < DUELLE.length; d++) {
        const a = await spiel(saat, i, DUELLE[d][1]), b = await spiel(saat, i, DUELLE[d][2]);
        duell[d][0] += a.sieger === 0 ? 1 : 0;   // Seite mit Modus X ist Heim
        duell[d][1] += b.sieger === 1 ? 1 : 0;   // Seite mit Modus X ist Gast
        duell[d][2] += 2;
      }
    }
  }
  const bezug = erg[0];
  const w = basis.freiWertung === 1 ? "Arbeitswert" : "Silo-kg";
  console.log(`=== Mannschaftsebene, gepaart gegen "fest" (${bezug.length} Spiele x 2 Seiten) ===\n`);
  console.log(`Vergleich                                      ${w.padStart(11)}  Delta zu fest (95 %)     Seiten besser  Silo-kg  Wechsel/Spieler  erzwungen durch  Pausen/Schicht`);
  KONFIG.forEach(([name], c) => {
    const x = erg[c];
    const wert = (r, s) => (basis.freiWertung === 1 ? r.arbeit[s] : r.kg[s]);
    const d = x.flatMap((r, j) => [0, 1].map((s) => wert(r, s) - wert(bezug[j], s)));
    const rel = 100 * mittel(d) / mittel(bezug.flatMap((r) => [0, 1].map((s) => wert(r, s))));
    const besser = d.filter((z) => z > 0).length;
    console.log(`${name.padEnd(46)} ${mittel(x.flatMap((r) => [0, 1].map((s) => wert(r, s)))).toFixed(0).padStart(11)}  ${(rel >= 0 ? "+" : "") + rel.toFixed(2)} % ± ${(196 * se(d) / mittel(bezug.flatMap((r) => [0, 1].map((s) => wert(r, s))))).toFixed(2)} %`.padEnd(94)
      + `${(100 * besser / d.length).toFixed(0).padStart(5)} %  ${mittel(x.flatMap((r) => r.kg)).toFixed(0).padStart(7)}  ${(mittel(x.flatMap((r) => r.wechsel)) / 6).toFixed(2).padStart(15)}  ${(100 * mittel(x.flatMap((r) => r.erz))).toFixed(1).padStart(14)} %  ${mittel(x.map((r) => r.pausen[0] + r.pausen[1])).toFixed(2).padStart(14)}`);
  });
  console.log(`\n=== Duelle (dieselben Spiele, Modus X einmal Heim, einmal Gast) ===\n`);
  DUELLE.forEach(([name], d) => {
    const [h, g, n] = duell[d];
    console.log(`${name.padEnd(46)} Seite mit X gewinnt ${h + g}/${n} (${(100 * (h + g) / n).toFixed(1)} %; als Heim ${h}, als Gast ${g})`);
  });
  const basisSiege = erg[0].filter((r) => r.sieger === 0).length;
  console.log(`zum Vergleich beide fest: Heim gewinnt ${basisSiege}/${erg[0].length}, also Heim+Gast-Summe bei Gleichstand ${erg[0].length}/${2 * erg[0].length} (50 %)`);
} finally {
  await browser.close();
}
console.log("\nSeitenfehler:", fehler.length ? fehler.slice(0, 5) : "keine");
