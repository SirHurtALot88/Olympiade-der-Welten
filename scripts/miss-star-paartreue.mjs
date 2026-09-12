// ===================================================================================
// G1* — DIE STAR-/PAARTREUE-ABNAHME (CLAUDE.md "Die ehrlichere Abnahme fragt deshalb
// nach dem Star und nach der Paartreue mit Abstand", Vorbild
// docs/design/hockey-opus-review-nhl.md Abschnitt 5.3).
//
// Fable-Entscheidung E1 (docs/pm-briefings/fable-entscheidung-e1-e2-e3-basketball-hockey-
// football-10-09.md, Abschnitt 1.3) legt die G1*-Alternativ-Abnahme fest: eine Disziplin in
// der rho-Stufe 0,70-0,80 (je Spiel) bekommt 35 statt 22 G1-Punkte, wenn KADERFEST, n>=24 je
// Paarung, dieselbe Kader-Familie wie die Basislinie, ALLE VIER Bedingungen halten:
//   (a) rho Saison >= 0,85
//   (b) Star (der eignungsbeste Teilnehmer) auf Rang 1 >= 50 %, in den ersten zwei >= 75 %
//   (c) Star auf dem letzten Rang 0 %
//   (d) Paare mit >= 15 Eignungspunkten Abstand zu >= 95 % richtig geordnet
//
// War bislang NIE ins Repo uebernommen (Anhang B des Football-Erfolgskurven-Plans,
// 05.09., schlug genau das vor und blieb Scratchpad — "ls scripts | grep star": leer).
//
// GEMEINSAMER KERN: dieselbe kaderfeste Infrastruktur wie miss-alle-disziplinen.mjs
// (window.__arena.disziplinProbe, Kader-Familie aus data/generated/kaderfamilie-live-
// save.json, sonst synthetischer Ausweichkader) — s. scripts/lib/rangtreue-messung.mjs.
// rho Saison/Spiel kommen aus genau der Funktion, die auch stand-aller-disziplinen.md
// speist; Star- und Paartreue sind hier neu, aber auf denselben Rohdaten (`teilnehmer`
// je Spiel: {n, eig, wert, torwart?}).
//
// HOCKEYS TORWART wird ausgeschlossen (Fable-Recherche 1.1/3.1: eigene, andersartige
// Wertformel) — exakt die "davon nur Feldspieler"-Regel aus miss-alle-disziplinen.mjs.
// Fuer jede andere Disziplin ist `torwart` nie gesetzt und die Filterung ist ein No-Op.
//
//   node scripts/miss-star-paartreue.mjs [spiele] <disziplin> [disziplin ...]
//   node scripts/miss-star-paartreue.mjs 24 basketball
//   node scripts/miss-star-paartreue.mjs 24 basketball hockey     (Kontrollzahl Hockey)
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  auswerten, ohneTorwart, hatTorwart, median, spannweite,
  ladeKaderFamilieAusDatei, baueSynthetischeKaderFamilie,
} from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE
  || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const roheArgs = process.argv.slice(2);
const SPIELE = Number(roheArgs[0] || 24);
const DISZIPLINEN = roheArgs.slice(1);
if (!DISZIPLINEN.length) {
  console.error("Aufruf: node scripts/miss-star-paartreue.mjs [spiele] <disziplin> [disziplin ...]");
  process.exit(1);
}

const rund = (x, k = 3) => (x == null || Number.isNaN(x) ? null : Math.round(x * 10 ** k) / 10 ** k);
const pp = (x) => (x == null ? "—" : (x * 100).toFixed(1) + "%");

// -----------------------------------------------------------------------------------
// Star- und Paartreue fuer EIN Spiel (eine `teilnehmer`-Liste {n,eig,wert}).
//   star   = der Teilnehmer mit der hoechsten Eignung DIESES Spiels (Formkarten koennen
//            die Eignung leicht bewegen, deshalb je Spiel neu bestimmt, nicht einmal
//            je Kader — exakt wie CLAUDE.mds "Star" gemeint ist: der im Kader Beste).
//   rang   = Impact-Rang (`wert`, absteigend) des Stars; Bindungen bekommen denselben
//            (dichten) Rang, wie es auch der Boxscore/die Anzeige taete.
//   paare  = alle Paare mit >= 15 Punkten Eignungsabstand: "richtig geordnet" heisst,
//            der Teilnehmer mit der hoeheren Eignung hat den >= Impact-Wert (ein exakter
//            Wert-Gleichstand zaehlt als nicht falsch geordnet, nicht als Fehler eines
//            Motors, der zwei gleich gute Spiele lieferte).
// -----------------------------------------------------------------------------------
function jeSpielAuswertung(teilnehmer) {
  if (teilnehmer.length < 2) return null;
  const star = teilnehmer.reduce((a, b) => (b.eig > a.eig ? b : a));
  const sortiert = [...teilnehmer].sort((a, b) => b.wert - a.wert);
  let rang = 1;
  for (const t of sortiert) {
    if (t.wert > star.wert) rang++;
    else break;
  }
  const n = teilnehmer.length;
  let paareGesamt = 0, paareRichtig = 0;
  for (let i = 0; i < teilnehmer.length; i++) {
    for (let j = i + 1; j < teilnehmer.length; j++) {
      const a = teilnehmer[i], b = teilnehmer[j];
      const dEig = a.eig - b.eig;
      if (Math.abs(dEig) < 15) continue;
      paareGesamt++;
      const hoeher = dEig > 0 ? a : b, tiefer = dEig > 0 ? b : a;
      if (hoeher.wert >= tiefer.wert) paareRichtig++;
    }
  }
  return { rang1: rang === 1, top2: rang <= 2, letzter: rang === n, paareGesamt, paareRichtig };
}

function starPaartreueAus(spieleListe) {
  let rang1 = 0, top2 = 0, letzter = 0, spiele = 0, paareGesamt = 0, paareRichtig = 0;
  for (const s of spieleListe) {
    const e = jeSpielAuswertung(s.teilnehmer);
    if (!e) continue;
    spiele++;
    if (e.rang1) rang1++;
    if (e.top2) top2++;
    if (e.letzter) letzter++;
    paareGesamt += e.paareGesamt;
    paareRichtig += e.paareRichtig;
  }
  return {
    spiele,
    starRang1: spiele ? rang1 / spiele : null,
    starTop2: spiele ? top2 / spiele : null,
    starLetzter: spiele ? letzter / spiele : null,
    paareGesamt,
    paartreue: paareGesamt ? paareRichtig / paareGesamt : null,
  };
}

// G1* braucht genau EINE Population je Disziplin: die Feldspieler-Population, wenn es
// eine Torwart-Rolle mit eigener Wertformel gibt (heute nur Hockey), sonst alle
// Teilnehmer. Kein Doppelausweis wie bei miss-alle-disziplinen.mjs — G1* fragt nach DER
// Zahl, nicht nach zwei.
function population(spieleListe) {
  return hatTorwart(spieleListe) ? ohneTorwart(spieleListe) : spieleListe;
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
        ([d, n, familie]) => window.__arena.disziplinProbe(d, { n, kaderFamilie: familie }),
        [d, SPIELE, kaderFamilie],
      );
    } catch (e) { zeilen.push({ d, fehler: String(e).slice(0, 100) }); continue; }
    if (x.fehler) { zeilen.push({ d, fehler: x.fehler }); continue; }
    if (!x.varianten) { zeilen.push({ d, fehler: "keine Kaderfamilie gefahren" }); continue; }

    const jeVariante = x.varianten.map((v) => {
      const pop = population(v.spiele);
      const rt = auswerten(pop);
      const sp = starPaartreueAus(pop);
      return { label: v.label, rhoSpiel: rt.spiel, rhoSaison: rt.saison, ...sp };
    });

    const rhoSaisonMed = median(jeVariante.map((v) => v.rhoSaison));
    const rhoSpielMed = median(jeVariante.map((v) => v.rhoSpiel));
    const rang1Ges = jeVariante.reduce((s, v) => s + v.starRang1 * v.spiele, 0)
      / jeVariante.reduce((s, v) => s + v.spiele, 0);
    const top2Ges = jeVariante.reduce((s, v) => s + v.starTop2 * v.spiele, 0)
      / jeVariante.reduce((s, v) => s + v.spiele, 0);
    const letzterGes = jeVariante.reduce((s, v) => s + v.starLetzter * v.spiele, 0)
      / jeVariante.reduce((s, v) => s + v.spiele, 0);
    const paareGesamtSumme = jeVariante.reduce((s, v) => s + v.paareGesamt, 0);
    const paareRichtigSumme = jeVariante.reduce((s, v) => s + (v.paartreue == null ? 0 : v.paartreue * v.paareGesamt), 0);
    const paartreueGes = paareGesamtSumme ? paareRichtigSumme / paareGesamtSumme : null;
    const spieleGesamt = jeVariante.reduce((s, v) => s + v.spiele, 0);

    zeilen.push({
      d, feldspielerNur: hatTorwart(x.varianten[0].spiele),
      spieleGesamt, jeVariante,
      rhoSpielMed: rund(rhoSpielMed), rhoSpielSpan: rund(spannweite(jeVariante.map((v) => v.rhoSpiel))),
      rhoSaisonMed: rund(rhoSaisonMed), rhoSaisonSpan: rund(spannweite(jeVariante.map((v) => v.rhoSaison))),
      starRang1: rund(rang1Ges), starTop2: rund(top2Ges), starLetzter: rund(letzterGes),
      paareGesamt: paareGesamtSumme, paartreue: rund(paartreueGes),
      sekunden: Math.round((Date.now() - start) / 1000),
    });
  }
} finally {
  await browser.close();
}

console.log("G1*-Sternspieler-/Paartreue-Messung — kaderfest, " + SPIELE + " Spiele je Kader-Paarung\n");
for (const z of zeilen) {
  if (z.fehler) { console.log(z.d + " — FEHLER: " + z.fehler); continue; }
  console.log(`=== ${z.d}${z.feldspielerNur ? " (nur Feldspieler, Torwart ausgeschlossen)" : ""} ===`);
  console.log(`  Spiele gesamt (${z.jeVariante.length} Paarungen x ${SPIELE}): ${z.spieleGesamt}, Laufzeit ${z.sekunden}s`);
  console.log("  je Paarung: label       rho(Spiel)  rho(Saison)  StarRang1  StarTop2  StarLetzter  Paare>=15  Paartreue");
  for (const v of z.jeVariante) {
    console.log(
      "    ".padEnd(4) + String(v.label).padEnd(16)
      + rund(v.rhoSpiel).toFixed(3).padStart(11)
      + rund(v.rhoSaison).toFixed(3).padStart(13)
      + pp(v.starRang1).padStart(11)
      + pp(v.starTop2).padStart(10)
      + pp(v.starLetzter).padStart(13)
      + String(v.paareGesamt).padStart(11)
      + pp(v.paartreue).padStart(11),
    );
  }
  console.log(`  MEDIAN/GESAMT: rho Spiel ${z.rhoSpielMed} (Spannw. ${z.rhoSpielSpan})  rho Saison ${z.rhoSaisonMed} (Spannw. ${z.rhoSaisonSpan})`);
  console.log(`                 Star Rang1 ${pp(z.starRang1)}  Top2 ${pp(z.starTop2)}  Letzter ${pp(z.starLetzter)}  Paartreue(>=15) ${pp(z.paartreue)} (n=${z.paareGesamt})`);

  const g1a = z.rhoSaisonMed >= 0.85;
  const g1b = z.starRang1 >= 0.50 && z.starTop2 >= 0.75;
  const g1c = z.starLetzter === 0;
  const g1d = z.paartreue >= 0.95;
  const bestanden = g1a && g1b && g1c && g1d;
  console.log(`  G1*-Bedingungen: (a) rho Saison>=0,85 ${g1a ? "OK" : "NEIN"}  ` +
    `(b) Star Rang1>=50%+Top2>=75% ${g1b ? "OK" : "NEIN"}  ` +
    `(c) Star nie Letzter ${g1c ? "OK" : "NEIN"}  ` +
    `(d) Paartreue>=95% ${g1d ? "OK" : "NEIN"}`);
  console.log(`  ==> G1* ${bestanden ? "ERFUELLT" : "NICHT ERFUELLT"}\n`);
}
console.log("Seitenfehler: " + (fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"));
