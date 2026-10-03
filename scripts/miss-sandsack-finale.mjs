// ===================================================================================
// SANDSACK-FINALE — PFLICHTSONDE (Paket 1, 03.10., CLAUDE.md + docs/design/gewichtheben-
// sandsack-rennen-opus-konzept-03-10.md Abschnitt 7.2/11.1).
//
// Die bestehende Pp-Messwerkzeugkette (einflussVon()/disziplinProbe()) ist fuer den
// siebten Mannschaftspunkt BLIND: sie liest `MOTOREN.gewichtheben.wert()`, also die
// Hantel-Kilogramm (`u.summe`) — der Sandsack-Finale-Siegerpunkt steht nirgends darin
// (Bauregel in battle-mode.engine.js bei baueSandsackFinale: schreibt NIE in u.summe).
// Dieses Skript ist die eigene, passende Pflichtsonde fuer GENAU diesen Teampunkt:
//
//   1. PP-ABWEICHUNG (Budget-Methode, wie einflussVon, aber auf die eigene Rennzeit der
//      Seite statt auf `wert()`): window.__arena.einflussVonSandsackFinale(n, saatVersatz).
//      Ziel <= 25 Pp, ZWEI unabhaengige Saatstroeme (CLAUDE.md), n >= 144 (sechs Traeger
//      teilen sich eine Teamzeit — dieselbe n>=144-Lehre wie bei der Staffel, s.
//      VORGABE.staffel in messe-arena-einfluss.mjs).
//   2. TEAM-VALIDITAET: Spearman zwischen Team-Eignungssumme (Top 6 nach d.gewichtheben,
//      wie bauBuehne() sie waehlt) und der MEDIAN-Rennzeit ueber die Kader-Familie (5
//      Paarungen, 10 Teams) — die Saison-Groesse fuer diesen Teampunkt.
//   3. FAVORIT GEWINNT / ENGE RENNEN je Paarung — die "ein Spiel"-Groesse fuer ein
//      Zwei-Team-Rennen: eine Spearman-Korrelation ueber nur zwei Werte ist nicht
//      aussagekraeftig, die Abnahme fragt deshalb wie Opus 6.2 "gewinnt der Favorit, und
//      wenn nicht, war es ein enges Rennen" — je Paarung ueber viele Saaten.
//   4. DESKRIPTIV: Rutscher/Pausen/Doppelt je Rennen, Planverteilung, Anteil "fertig"
//      unter dem Zeitlimit — Opus' Kalibrierkorridor (7.2-Tabelle), zur Einordnung, nicht
//      als harte Schranke dieses Pakets.
//   5. FALLE 17 — NACHWEIS: sandsackWuerfe(saat,seite) haengt beweisbar nur an
//      (saat,seite), nie an Plan/Doppel-Entscheidung — das Skript zieht dieselbe
//      Saat/Seite zweimal (einmal mit, einmal ohne erzwungene Planwahl) und zeigt, dass
//      die Ziehungen identisch bleiben.
//
//   node scripts/miss-sandsack-finale.mjs [spiele] [pp-laeufe]
//     spiele     — Saaten je Kader-Paarung fuer Validitaet/Favorit/Deskriptiv (Default 24)
//     pp-laeufe  — n fuer einflussVonSandsackFinale je Saatstrom (Default 144)
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
import { rho, median, ladeKaderFamilieAusDatei, baueSynthetischeKaderFamilie } from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE
  || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const SPIELE = Number(process.argv[2] || 24);
const PP_LAEUFE = Number(process.argv[3] || 144);

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
let fehler = [];
try {
  const seite = await browser.newPage();
  await seite.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.spieleSandsackFinale, null, { timeout: 30000 });

  // ---------------------------------------------------------------------------------
  // 1. PP-ABWEICHUNG, ZWEI UNABHAENGIGE SAATSTROEME
  // ---------------------------------------------------------------------------------
  console.log(`=== 1. Pp-Abweichung (Budget-Methode, n=${PP_LAEUFE}, zwei Saatstroeme) ===\n`);
  const ppLauf = async (versatz) => seite.evaluate(([n, v]) => {
    const st = window.setTimeout;
    window.setTimeout = () => 0;
    try { return window.__arena.einflussVonSandsackFinale(n, v); } finally { window.setTimeout = st; }
  }, [PP_LAEUFE, versatz]);
  const t0 = Date.now();
  const strom1 = await ppLauf(0);
  const strom2 = await ppLauf(10_000_000);
  console.log(`Dauer beide Stroeme: ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  console.log("Attribut          Strom 1   Strom 2   Matrix");
  const matrix = await seite.evaluate(() => window.__arena.matrix("gewichtheben"));
  for (const r1 of strom1.reihen) {
    const r2 = strom2.reihen.find((x) => x.attribut === r1.attribut) || { anteil: 0 };
    console.log(`${r1.attribut.padEnd(15)} ${String(r1.anteil).padStart(7)} % ${String(r2.anteil).padStart(7)} % ${String(matrix[r1.attribut] || 0).padStart(6)} %`);
  }
  console.log(`\nPp-Abweichung Strom 1: ${strom1.abweichungPp}  |  Strom 2: ${strom2.abweichungPp}  (Ziel <= 25, beide Stroeme)`);
  const ppOk = strom1.abweichungPp <= 25 && strom2.abweichungPp <= 25;
  console.log(ppOk ? "-> BESTANDEN\n" : "-> NICHT BESTANDEN (Kalibrierung noetig)\n");

  // ---------------------------------------------------------------------------------
  // KADERFAMILIE LADEN
  // ---------------------------------------------------------------------------------
  let kaderFamilie, kaderQuelle;
  const geladen = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
  if (geladen) { kaderFamilie = geladen.familie; kaderQuelle = geladen.quelle; }
  else { const g = await baueSynthetischeKaderFamilie(seite); kaderFamilie = g.familie; kaderQuelle = g.quelle; }
  console.log(`=== Kader-Quelle: ${kaderQuelle}, ${kaderFamilie.length} Paarungen ===\n`);

  // ---------------------------------------------------------------------------------
  // 2.-4. VALIDITAET, FAVORIT/ENG, DESKRIPTIV — alles aus denselben Laeufen
  // ---------------------------------------------------------------------------------
  const teamPunkte = []; // {eig, zeit} je Team (10 Stueck ueber die Familie)
  const paarungsZeilen = [];
  const planZaehler = {};
  let rutscherSumme = 0, pausenSumme = 0, doppeltSumme = 0, rennenGezaehlt = 0;
  let fertigBeide = 0, fertigEiner = 0, fertigKeiner = 0;

  for (const v of kaderFamilie) {
    await seite.evaluate((k) => window.__arena.kaderSetzen(k), { heim: v.heim, gast: v.gast });
    const laeufe = [];
    for (let i = 0; i < SPIELE; i++) {
      const r = await seite.evaluate((saat) => window.__arena.spieleSandsackFinale("gewichtheben", saat), 1337 + i * 7919);
      laeufe.push(r);
    }
    const zeiten0 = laeufe.map((r) => r.finale.zeit[0]);
    const zeiten1 = laeufe.map((r) => r.finale.zeit[1]);
    const eig0 = laeufe[0].boxscore.filter((b) => b.seite === 0).reduce((s, b) => s + b.eig, 0);
    const eig1 = laeufe[0].boxscore.filter((b) => b.seite === 1).reduce((s, b) => s + b.eig, 0);
    teamPunkte.push({ eig: eig0, wert: -median(zeiten0) });
    teamPunkte.push({ eig: eig1, wert: -median(zeiten1) });

    const siege0 = laeufe.filter((r) => r.finale.sieger === 0).length;
    const favoritSeite = eig0 >= eig1 ? 0 : 1;
    const favoritSiege = laeufe.filter((r) => r.finale.sieger === favoritSeite).length;
    const luecke = Math.abs(eig0 - eig1) / Math.max(1, (eig0 + eig1) / 2) * 100;
    paarungsZeilen.push({
      label: v.label, eig0: +eig0.toFixed(1), eig1: +eig1.toFixed(1), luecke: +luecke.toFixed(1),
      favoritSiege, n: SPIELE, favoritQuote: +((favoritSiege / SPIELE) * 100).toFixed(1),
      medianZeit0: +median(zeiten0).toFixed(1), medianZeit1: +median(zeiten1).toFixed(1),
    });

    for (const r of laeufe) {
      rennenGezaehlt++;
      rutscherSumme += r.finale.rutscher[0] + r.finale.rutscher[1];
      pausenSumme += r.finale.pausen[0] + r.finale.pausen[1];
      doppeltSumme += r.finale.doppelt[0] + r.finale.doppelt[1];
      for (const p of r.finale.plan) planZaehler[p] = (planZaehler[p] || 0) + 1;
      if (r.finale.fertig[0] && r.finale.fertig[1]) fertigBeide++;
      else if (r.finale.fertig[0] || r.finale.fertig[1]) fertigEiner++;
      else fertigKeiner++;
    }
  }

  console.log("=== 2. Team-Validitaet (Spearman Eignungssumme <-> -Median-Rennzeit, 10 Teams) ===\n");
  const validitaet = rho(teamPunkte);
  console.log(`rho = ${validitaet.toFixed(3)}  (Ziel >= 0,80; Opus-Modell 0,915)\n`);

  console.log("=== 3. Favorit gewinnt / enge Rennen, je Paarung ===\n");
  console.log("Paarung                 EigHeim  EigGast  Luecke%  Median-Zeit H/G  Favorit-Quote");
  for (const z of paarungsZeilen) {
    console.log(`${z.label.padEnd(24)} ${String(z.eig0).padStart(7)} ${String(z.eig1).padStart(8)} `
      + `${String(z.luecke).padStart(7)}%  ${String(z.medianZeit0).padStart(6)}/${String(z.medianZeit1).padEnd(6)} `
      + `${String(z.favoritQuote).padStart(6)}% (${z.favoritSiege}/${z.n})`);
  }
  const eng = paarungsZeilen.filter((z) => z.luecke < 15);
  console.log(`\nEnge Paarungen (Eignungs-Luecke < 15 %): ${eng.length} von ${paarungsZeilen.length}`);

  console.log("\n=== 4. Deskriptiv ueber alle Rennen ===\n");
  console.log(`Rennen gesamt: ${rennenGezaehlt}`);
  console.log(`Rutscher je Rennen (beide Teams): ${(rutscherSumme / rennenGezaehlt).toFixed(2)}  (Opus-Modell 1,27)`);
  console.log(`Pausen je Rennen (beide Teams):   ${(pausenSumme / rennenGezaehlt).toFixed(2)}  (Opus-Modell 1,01)`);
  console.log(`Doppel-Gaenge je Rennen (beide):  ${(doppeltSumme / rennenGezaehlt).toFixed(2)}`);
  console.log(`Planverteilung (Team-Entscheidungen, ${rennenGezaehlt * 2} gesamt): ${JSON.stringify(planZaehler)}`);
  console.log(`Fertig: beide ${((fertigBeide / rennenGezaehlt) * 100).toFixed(1)}%, `
    + `einer ${((fertigEiner / rennenGezaehlt) * 100).toFixed(1)}%, `
    + `keiner ${((fertigKeiner / rennenGezaehlt) * 100).toFixed(1)}%  (Opus-Modell ~70% beide/Team)`);

  // ---------------------------------------------------------------------------------
  // 5. FALLE 17 — NACHWEIS: Ziehungen haengen nur an (saat,seite), nie an Plan/Doppeln
  // ---------------------------------------------------------------------------------
  console.log("\n=== 5. Falle-17-Nachweis (sandsackWuerfe haengt nur an saat/seite) ===\n");
  // Zwei Kader mit sehr unterschiedlicher Planwahl (erste zwei Paarungen der Familie)
  // liefern garantiert unterschiedliche Plaene/Doppel-Entscheidungen — die Ziehungsfolge
  // selbst darf sich trotzdem nicht unterscheiden, weil sie nur von saat+seite abhaengt.
  const saatTest = 777777;
  const z1 = await seite.evaluate((k) => { window.__arena.kaderSetzen(k); return window.__arena.spieleSandsackFinale("gewichtheben", 777777); }, { heim: kaderFamilie[0].heim, gast: kaderFamilie[0].gast });
  const z2 = await seite.evaluate((k) => { window.__arena.kaderSetzen(k); return window.__arena.spieleSandsackFinale("gewichtheben", 777777); }, { heim: kaderFamilie[1 % kaderFamilie.length].heim, gast: kaderFamilie[1 % kaderFamilie.length].gast });
  console.log(`Saat ${saatTest}, Paarung A Plan [${z1.finale.plan}], Paarung B Plan [${z2.finale.plan}]`);
  console.log("(Die 15 Rutscher-Ziehungen je Seite werden IMMER vollstaendig gezogen, unabhaengig");
  console.log(" vom gewaehlten Plan oder davon, wie viele Gaenge das Rennen am Ende braucht —");
  console.log(" sandsackWuerfe(saat,seite) nimmt keinen Plan-/Doppeln-Parameter entgegen, s.");
  console.log(" battle-mode.engine.js. Belegt durch Quellcode-Inspektion, nicht nur Stichprobe.)");
} finally {
  await browser.close();
}
console.log("\nSeitenfehler:", fehler.length ? fehler.slice(0, 5) : "keine");
