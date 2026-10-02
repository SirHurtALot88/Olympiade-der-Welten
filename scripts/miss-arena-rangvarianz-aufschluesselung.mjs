// ===================================================================================
// RANGVARIANZ-AUFSCHLUESSELUNG FUER DIE ARENA (TDM/Mini-DM/Battlefield) — Teil 2 der
// Opus-Konsultation Task #26 (02.10.). Vorbild im Stil: scripts/miss-rangtreue-nach-
// rolle.mjs ("wer zieht die Rangtreue runter?") und scripts/miss-star-paartreue.mjs
// (kaderfeste Infrastruktur, scripts/lib/rangtreue-messung.mjs).
//
// Hintergrund: eine Opus-Konsultation fand TDMs bindende rho-Verletzung (rho je Spiel
// 0,404 gegen die CLAUDE.md-Schranke 0,80, s. docs/design/tdm-pp-rezeptrunde-
// diagnose-02-10.md Abschnitt 3) plausibel darin begruendet, dass der "Zugang" zu
// Kaempfen (wie oft ein Teilnehmer ueberhaupt als Ziel gewaehlt wird) kaum an der
// Eignung haengt. Bevor an der Zielwahl-Mechanik selbst gearbeitet wird (Klasse B,
// braucht Chris), misst dieses Skript nach, WIE GROSS die einzelnen Faktoren sind:
//
//   1. rho(Eignung, Zugang) — Korrelation zwischen Eignung und der Zahl, wie oft eine
//      Einheit TATSAECHLICH als Ziel gewaehlt wurde. Gezaehlt direkt an den
//      chooseTarget()-Rueckgaben (`window.__arena.disziplinProbe(d,{...,zielDiag:true})`,
//      s. der neue `ZIEL_DIAG`-Zaehl-Wrapper in battle-mode.engine.js — eine reine
//      Lese-Diagnose nach dem Vorbild von takeshiWuchtDiag() aus PR #1121, chooseTarget
//      selbst bleibt byte-identisch).
//   2. eta² (Varianzanteil) fuer Persoenlichkeit (PERSZIEL-Typ), Heiler-Unterklasse,
//      Reihe/Slot und Seite (Heim/Gast) — wie viel der GESAMT-RANGVARIANZ (Rang von
//      `wert`) jeder Faktor erklaert, UNABHAENGIG von der Eignung: dafuer wird je
//      Kader-Paarung eine lineare Regression von Rang(wert) auf Rang(eig) (beide als
//      Perzentil-Rang 0..1, damit unterschiedlich grosse Paarungen vergleichbar
//      bleiben) gerechnet, und eta² misst dann jeden Faktor gegen das RESIDUUM dieser
//      Regression (das, was die Eignung NICHT erklaert) statt gegen den rohen Rang
//      selbst — sonst wuerde ein Faktor, der zufaellig mit der Eignung korreliert
//      (z.B. weil starke Spieler tendenziell eine bestimmte Persoenlichkeit tragen),
//      als eigener Effekt erscheinen, obwohl er nur die Eignung wiederholt.
//
// P0-FIX ZUERST AUSFUEHREN (s. disziplinProbe() in battle-mode.engine.js, Kommentar
// "P0-FIX HEIM/GAST-ZIELWAHL-ASYMMETRIE"): ohne ihn ist die GAST-Seite in praktisch
// jeder Kader-Paarung (ausser der ersten) auf reine Geometrie ("naechster") reduziert,
// weil `schlachtplan()` mangels Aufstellung immer `null` liefert — die Zahlen dieses
// Skripts waeren dann durch genau die Asymmetrie verzerrt, die es eigentlich misst.
//
//   node scripts/miss-arena-rangvarianz-aufschluesselung.mjs [spiele] [disziplin ...]
//
// Ohne Disziplinliste laufen tdm, mini-dm, battlefield (die drei ARENA_ART-Disziplinen).
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  rho, median, spannweite, ladeKaderFamilieAusDatei, baueSynthetischeKaderFamilie,
} from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE
  || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const roheArgs = process.argv.slice(2);
const SPIELE = Number(roheArgs[0] || 24);
const DISZIPLINEN = roheArgs.slice(1).length ? roheArgs.slice(1) : ["tdm", "mini-dm", "battlefield"];

const rund = (x, k = 3) => (x == null || Number.isNaN(x) ? null : Math.round(x * 10 ** k) / 10 ** k);
const pp = (x) => (x == null ? "—" : (x * 100).toFixed(1) + "%");

// Rang (1..n, Bindungen -> Durchschnittsrang) einer Zahlenliste, absteigend (Platz 1 =
// hoechster Wert) — dieselbe Konvention wie miss-rangtreue-nach-rolle.mjs.
function raenge(werte) {
  const idx = werte.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const out = new Array(werte.length);
  let k = 0;
  while (k < idx.length) {
    let j = k;
    while (j + 1 < idx.length && idx[j + 1].v === idx[k].v) j++;
    const mittel = (k + j) / 2 + 1;
    for (let m = k; m <= j; m++) out[idx[m].i] = mittel;
    k = j + 1;
  }
  return out;
}

// Einfache OLS-Gerade y = a + b*x, liefert Residuen y_i - (a+b*x_i). Bei entarteten
// Faellen (x konstant) ist b=0, a=Mittel(y) — Residuen sind dann y - Mittel(y).
function olsResiduen(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = sxx > 1e-9 ? sxy / sxx : 0, a = my - b * mx;
  return xs.map((x, i) => ys[i] - (a + b * x));
}

// eta² = SS_zwischen / SS_gesamt fuer eine kategoriale Variable gegen eine stetige
// (hier: das Eignungs-Residuum). `null`-Kategorien (z.B. "kein Heiler" bei
// heilerSub) werden herausgefiltert — die Frage ist "wie viel erklaert die
// Unterklasse UNTER Heilern", nicht "Heiler vs. Nicht-Heiler".
function eta2(zeilen, key) {
  const gruppen = new Map();
  for (const z of zeilen) {
    const k = z[key];
    if (k == null) continue;
    if (!gruppen.has(k)) gruppen.set(k, []);
    gruppen.get(k).push(z.residuum);
  }
  const alle = [...gruppen.values()].flat();
  if (alle.length < 4 || gruppen.size < 2) return null;
  const gesamtMittel = alle.reduce((s, v) => s + v, 0) / alle.length;
  let ssGesamt = 0;
  for (const v of alle) ssGesamt += (v - gesamtMittel) ** 2;
  let ssZwischen = 0;
  const gruppenMittel = [];
  for (const [k, vals] of gruppen) {
    const m = vals.reduce((s, v) => s + v, 0) / vals.length;
    ssZwischen += vals.length * (m - gesamtMittel) ** 2;
    gruppenMittel.push({ gruppe: k, n: vals.length, mittel: rund(m, 4) });
  }
  gruppenMittel.sort((x, y) => y.mittel - x.mittel);
  return { eta2: ssGesamt > 0 ? ssZwischen / ssGesamt : 0, n: alle.length, gruppen: gruppen.size, gruppenMittel };
}

// -----------------------------------------------------------------------------------
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
let zeilen = [], fehler = [];
try {
  const seite = await browser.newPage();
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "domcontentloaded" });
  await seite.waitForFunction(() => window.__arena && window.__arena.disziplinProbe, null, { timeout: 30000 });

  let kaderFamilie, kaderQuelle;
  const geladen = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
  if (geladen) { kaderFamilie = geladen.familie; kaderQuelle = geladen.quelle; }
  else {
    const gebaut = await baueSynthetischeKaderFamilie(seite);
    kaderFamilie = gebaut.familie; kaderQuelle = gebaut.quelle;
  }
  console.log(`Kader-Quelle: ${kaderQuelle} (${kaderFamilie.length} Paarungen)\n`);

  for (const d of DISZIPLINEN) {
    const start = Date.now();
    let x;
    try {
      x = await seite.evaluate(
        ([d, n, familie]) => window.__arena.disziplinProbe(d, { n, kaderFamilie: familie, zielDiag: true }),
        [d, SPIELE, kaderFamilie],
      );
    } catch (e) { zeilen.push({ d, fehler: String(e).slice(0, 150) }); continue; }
    if (x.fehler) { zeilen.push({ d, fehler: x.fehler }); continue; }
    if (!x.varianten) { zeilen.push({ d, fehler: "keine Kaderfamilie gefahren (ARENA_ART-Disziplin erwartet)" }); continue; }

    // Je Paarung: Spieler ueber alle Spiele mitteln (eig/wert/zugang), persTyp/heilerSub/
    // reihe/seite sind strukturell und bleiben ueber die Spiele einer Paarung stabil
    // (dieselben Spieler, dieselbe deterministische Aufstellung) — aus dem ERSTEN Spiel
    // gelesen, in dem der Name vorkommt.
    const residuenZeilen = [];
    const rhoZugangJeVariante = [];
    for (const v of x.varianten) {
      const agg = new Map();
      for (const s of v.spiele) for (const t of s.teilnehmer) {
        const a = agg.get(t.n) || {
          n: t.n, eig: 0, wert: 0, zugang: 0, k: 0,
          seite: t.seite, reihe: t.reihe ?? null, persTyp: t.persTyp ?? null, heilerSub: t.heilerSub ?? null,
        };
        a.eig += t.eig; a.wert += t.wert; a.zugang += t.zugang || 0; a.k++;
        agg.set(t.n, a);
      }
      const spieler = [...agg.values()].map((a) => ({
        ...a, eig: a.eig / a.k, wert: a.wert / a.k, zugang: a.zugang / a.k,
      }));
      if (spieler.length < 4) continue;

      // 1) rho(Eignung, Zugang) ueber diese Paarung (dieselbe Spearman-Funktion wie fuer
      // rho(Eignung, Wert) — `rho()` erwartet {eig,wert}-Paare, hier ist "wert" = Zugang).
      const rZugang = rho(spieler.map((s) => ({ eig: s.eig, wert: s.zugang })));
      if (!Number.isNaN(rZugang)) rhoZugangJeVariante.push({ label: v.label, n: spieler.length, rho: rZugang });

      // 2) Eignungs-Residuum fuer eta²: Perzentil-Rang (0..1) von eig/wert, OLS-Residuum
      // von Rang(wert) auf Rang(eig) — macht Paarungen unterschiedlicher Groesse
      // vergleichbar, bevor sie in einen gemeinsamen Pool gehen.
      const n = spieler.length;
      const prEig = raenge(spieler.map((s) => s.eig)).map((r) => (r - 1) / Math.max(1, n - 1));
      const prWert = raenge(spieler.map((s) => s.wert)).map((r) => (r - 1) / Math.max(1, n - 1));
      const residuen = olsResiduen(prEig, prWert);
      spieler.forEach((s, i) => residuenZeilen.push({ ...s, label: v.label, residuum: residuen[i] }));
    }

    const rhoZugangMed = median(rhoZugangJeVariante.map((v) => v.rho));
    const rhoZugangSpan = spannweite(rhoZugangJeVariante.map((v) => v.rho));

    zeilen.push({
      d,
      sekunden: Math.round((Date.now() - start) / 1000),
      rhoZugangJeVariante, rhoZugangMed: rund(rhoZugangMed), rhoZugangSpan: rund(rhoZugangSpan),
      nSpieler: residuenZeilen.length,
      etaPers: eta2(residuenZeilen, "persTyp"),
      etaHeiler: eta2(residuenZeilen, "heilerSub"),
      etaReihe: eta2(residuenZeilen, "reihe"),
      etaSeite: eta2(residuenZeilen, "seite"),
    });
  }
} finally {
  await browser.close();
}

console.log("Arena-Rangvarianz-Aufschluesselung — kaderfest, " + SPIELE + " Spiele je Kader-Paarung\n");
for (const z of zeilen) {
  if (z.fehler) { console.log(z.d + " — FEHLER: " + z.fehler); continue; }
  console.log(`=== ${z.d} (Laufzeit ${z.sekunden}s, ${z.nSpieler} Spieler-Zeilen ueber alle Paarungen) ===`);
  console.log("\n1) rho(Eignung, Zugang) je Paarung:");
  for (const v of z.rhoZugangJeVariante) {
    console.log(`   ${String(v.label).padEnd(28)} n=${String(v.n).padStart(2)}  rho=${rund(v.rho).toFixed(3)}`);
  }
  console.log(`   MEDIAN ${z.rhoZugangMed} (Spannweite ${z.rhoZugangSpan})`);

  console.log("\n2) eta² je Faktor (Anteil an der Eignungs-Restvarianz des Rangs, nicht an der Eignung selbst):");
  const zeile = (label, e) => {
    if (!e) { console.log(`   ${label.padEnd(22)} — zu wenig Gruppen/Daten`); return; }
    console.log(`   ${label.padEnd(22)} eta²=${rund(e.eta2, 3)}  (n=${e.n}, ${e.gruppen} Gruppen)`);
    for (const g of e.gruppenMittel) console.log(`       ${String(g.gruppe).padEnd(16)} n=${String(g.n).padStart(3)}  Restmittel=${g.mittel}`);
  };
  zeile("Persoenlichkeit", z.etaPers);
  zeile("Heiler-Unterklasse", z.etaHeiler);
  zeile("Reihe/Slot", z.etaReihe);
  zeile("Seite (Heim/Gast)", z.etaSeite);
  console.log("");
}
console.log("eta² reicht von 0 (Faktor erklaert nichts ueber die Eignung hinaus) bis 1 (Faktor erklaert");
console.log("die GESAMTE Eignungs-Restvarianz) — zum Vergleich: eta²=0,06/0,14/0,26 gelten in der");
console.log("Sozialforschung ueblicherweise als kleiner/mittlerer/grosser Effekt (Cohen 1988).");
console.log("\nSeitenfehler: " + (fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"));
