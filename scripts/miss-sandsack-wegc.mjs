// ===================================================================================
// WEG-C-SONDE (05.10.) — Gewichtheben als drei Sandsack-Laeufe statt sechs Hantel-Duelle.
// docs/design/gewichtheben-sandsack-finale-wegc-format-05-10.md
//
// Misst dieselben Spiele wie `miss-alle-disziplinen.mjs gewichtheben --flags=gewichthebenSandsack:1`
// (gleiche Kader-Familie, gleiche Saaten, gleiche Formkarten/Mutatoren je Spiel) und legt
// daneben, was die Rangtreue allein nicht zeigt:
//   1. rho je Spiel / Saison (Kontrolle gegen miss-alle-disziplinen.mjs)
//   2. Sendezeit: Summe der drei Laufenden (Sim-Sekunden = Zuschausekunden bei 1:1-Pacing wie
//      Paket 2) plus feste Ueberleitungen, gegen das Zielfenster 2:30–4:00
//   3. vorzeitiger Schluss: wie oft, wie viel Zeit gespart, Schranken-Widersprueche (muss 0 sein)
//   4. Paar-Plaene, Rutscher/Pausen/Doppeln je Lauf, Zeitlimit
//   5. Team-Ebene: Laufsieger = Paar mit hoeherer Eignung? Spielsieger = Team mit hoeherer?
//   6. Diagnose: Korrelation des Spielerwerts mit jedem Sub-Skill, Stationsmix
//
//   node scripts/miss-sandsack-wegc.mjs [spiele=24]
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
const SPIELE = Number(process.argv.slice(2).find((a) => !a.startsWith("--")) || 24);
// --kalib=schluessel:wert,...  setzt Kalibrierhebel (window.__arena.sandsackWegCKalib), nur Messung.
const KALIB = Object.fromEntries((process.argv.find((a) => a.startsWith("--kalib=")) || "--kalib=")
  .slice(8).split(",").filter(Boolean).map((t) => { const [k, v] = t.split(":"); return [k, v === "true" ? true : v === "false" ? false : Number(v)]; }));

// UEBERLEITUNG JE LAUF (Zuschausekunden, keine Mechanik): Aufstellung 1,5 s + Zieleinlauf 1,2 s
// (SANDSACK_VIZ_AUFSTELLUNG_DAUER/_ZIELEINLAUF_DAUER aus Paket 2) + Lastenplan-Tafel ~4 s (Opus 2.1
// nannte ~5 s fuer die EINE Tafel des Finales) + Szenenwechsel ~2 s. Dazu einmal Vorspann/Endstand
// ~8 s. Bewusst grosszuegig geschaetzt — Stufe 3 legt die echten Werte fest.
const UEBERLEITUNG_JE_LAUF = 1.5 + 1.2 + 4 + 2;
const RAHMEN_JE_SPIEL = 8;

const quantil = (w, q) => { const s = [...w].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const pearson = (xs, ys) => {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; sxy += a * b; sx += a * a; sy += b * b; }
  return sxy / Math.sqrt(sx * sy || 1);
};

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const fehler = [];
try {
  const seite = await browser.newPage();
  await seite.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.spieleSandsackWegC, null, { timeout: 30000 });
  const kalib = await seite.evaluate((k) => window.__arena.sandsackWegCKalib(k), KALIB);
  console.log(`Kalibrierhebel: ${JSON.stringify(kalib)}`);

  let kaderFamilie, kaderQuelle;
  const geladen = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
  if (geladen) { kaderFamilie = geladen.familie; kaderQuelle = geladen.quelle; }
  else { const g = await baueSynthetischeKaderFamilie(seite); kaderFamilie = g.familie; kaderQuelle = g.quelle; }
  console.log(`Weg-C-Sonde — ${SPIELE} Spiele je Paarung, ${kaderFamilie.length} Paarungen (${kaderQuelle})\n`);

  const rhoJePaarung = [], saisonJePaarung = [];
  const sendezeit = [], laufEnde = [], laufVoll = [];
  let laeufeN = 0, vorzeitigN = 0, widerspruch = 0, zeitlimitLaeufe = 0, verlaengert = 0;
  let rutscher = 0, pausen = 0, doppelt = 0;
  const plaene = {};
  let laufFavoritSieg = 0, laufFavoritN = 0, spielFavoritSieg = 0, spielFavoritN = 0;
  const seitenVerteilung = {};
  const alleSpieler = []; // fuer die Diagnose
  const zeilen = [];

  for (const v of kaderFamilie) {
    await seite.evaluate((k) => window.__arena.kaderSetzen(k), { heim: v.heim, gast: v.gast });
    const spiele = [];
    for (let i = 0; i < SPIELE; i++) {
      const r = await seite.evaluate(([saat, fs, ms]) =>
        window.__arena.spieleSandsackWegC("gewichtheben", saat, { formSaat: fs, mutatorSaat: ms }),
      [1337 + i * 7919, 20260823 + i * 104729, 20260823 + i * 15485863]);
      spiele.push(r);
    }
    const rhos = spiele.map((s) => rho(s.boxscore.map((b) => ({ eig: b.eig, wert: b.wert }))));
    const agg = new Map();
    for (const s of spiele) for (const b of s.boxscore) {
      const a = agg.get(b.name) || { eig: 0, wert: 0, k: 0 }; a.eig += b.eig; a.wert += b.wert; a.k++; agg.set(b.name, a);
    }
    const rSpiel = rhos.reduce((a, b) => a + b, 0) / rhos.length;
    const rSaison = rho([...agg.values()].map((a) => ({ eig: a.eig / a.k, wert: a.wert / a.k })));
    rhoJePaarung.push(rSpiel); saisonJePaarung.push(rSaison);

    let siegeHeim = 0;
    for (const s of spiele) {
      const w = s.wegc;
      const eigVon = (n) => (s.boxscore.find((b) => b.name === n) || { eig: 0 }).eig;
      sendezeit.push(w.sendezeitSim + UEBERLEITUNG_JE_LAUF * w.laeufe.length + RAHMEN_JE_SPIEL);
      const k = `${w.seiten[0]}:${w.seiten[1]}`; seitenVerteilung[k] = (seitenVerteilung[k] || 0) + 1;
      if (w.seiten[0] > w.seiten[1]) siegeHeim++;
      const teamEig = [0, 1].map((side) => s.boxscore.filter((b) => b.seite === side).reduce((a, b) => a + b.eig, 0));
      if (teamEig[0] !== teamEig[1]) {
        spielFavoritN++;
        const fav = teamEig[0] > teamEig[1] ? 0 : 1;
        if (w.seiten[fav] > w.seiten[1 - fav]) spielFavoritSieg++;
      }
      for (const L of w.laeufe) {
        laeufeN++;
        laufEnde.push(L.ende);
        const natuerlich = L.fertigVoll[L.sieger] ? L.zeitVoll[L.sieger] : Math.max(...L.zeitVoll);
        laufVoll.push(natuerlich);
        if (L.vorzeitig) vorzeitigN++;
        if (L.ende > natuerlich + 1e-9) verlaengert++;
        widerspruch += L.schrankenWiderspruch;
        if (!L.fertigVoll[0] && !L.fertigVoll[1]) zeitlimitLaeufe++;
        for (const p of L.plan) plaene[p] = (plaene[p] || 0) + 1;
        for (const gs of L.gaenge) for (const g of gs) { if (g.rutscher) rutscher++; if (g.pause > 0) pausen++; if (g.doppelt) doppelt++; }
        const paarEig = L.traeger.map((ns) => ns.reduce((a, n) => a + eigVon(n), 0));
        if (paarEig[0] !== paarEig[1]) {
          laufFavoritN++;
          if (L.sieger === (paarEig[0] > paarEig[1] ? 0 : 1)) laufFavoritSieg++;
        }
      }
      for (const b of s.boxscore) {
        const lauf = w.laeufe[b.laufNr];
        const stationen = lauf ? [...new Set(lauf.gaenge[b.seite].filter((g) => g.n === b.name).map((g) => g.station))].join("+") : "";
        alleSpieler.push({ ...b, stationen, plan: lauf ? lauf.plan[b.seite] : null, _spiel: `${v.label}#${s.wegc.sendezeitSim}#${spiele.indexOf(s)}` });
      }
    }
    zeilen.push({ label: v.label, rSpiel, rSaison, siegeHeim });
  }

  console.log("=== 1. Rangtreue (Spielerwert = Tragenote x10) ===\n");
  console.log("Paarung                   rho je Spiel   rho Saison   Spiele Heim gewinnt");
  for (const z of zeilen) console.log(`${z.label.padEnd(24)} ${z.rSpiel.toFixed(3).padStart(12)} ${z.rSaison.toFixed(3).padStart(12)}   ${z.siegeHeim}/${SPIELE}`);
  console.log(`\nMedian je Spiel ${median(rhoJePaarung).toFixed(3)} (Spannweite ${(Math.max(...rhoJePaarung) - Math.min(...rhoJePaarung)).toFixed(3)}), `
    + `Saison ${median(saisonJePaarung).toFixed(3)}  (Schranke je Spiel > 0,80)\n`);

  console.log("=== 2. Sendezeit je Spiel (Zuschausekunden bei 1:1-Pacing) ===\n");
  console.log(`Laufende (Sim-s): Median ${median(laufEnde).toFixed(1)}, 10 % ${quantil(laufEnde, 0.1).toFixed(1)}, 90 % ${quantil(laufEnde, 0.9).toFixed(1)}, max ${Math.max(...laufEnde).toFixed(1)}`);
  console.log(`Ohne vorzeitigen Schluss waeren es: Median ${median(laufVoll).toFixed(1)}`);
  console.log(`Ueberleitung je Lauf ${UEBERLEITUNG_JE_LAUF.toFixed(1)} s, Rahmen je Spiel ${RAHMEN_JE_SPIEL} s (Schaetzung, s. Kopf)`);
  console.log(`Spiel gesamt: Median ${mmss(median(sendezeit))}, 10 % ${mmss(quantil(sendezeit, 0.1))}, 90 % ${mmss(quantil(sendezeit, 0.9))}, `
    + `min ${mmss(Math.min(...sendezeit))}, max ${mmss(Math.max(...sendezeit))}  (Ziel 2:30–4:00)`);
  const imFenster = sendezeit.filter((t) => t >= 150 && t <= 240).length;
  console.log(`Im Zielfenster: ${imFenster}/${sendezeit.length} (${(100 * imFenster / sendezeit.length).toFixed(1)} %)\n`);

  console.log("=== 3. Vorzeitiger Schluss ===\n");
  console.log(`Laeufe gesamt ${laeufeN}, vorzeitig entschieden ${vorzeitigN} (${(100 * vorzeitigN / laeufeN).toFixed(1)} %), `
    + `verlaengert bis "jeder hat am Steg getragen" ${verlaengert}, Schranken-Widersprueche ${widerspruch} (muss 0 sein)`);
  console.log(`Gesparte Sim-Sekunden je Lauf im Mittel: ${((laufVoll.reduce((a, b) => a + b, 0) - laufEnde.reduce((a, b) => a + b, 0)) / laeufeN).toFixed(1)}\n`);

  console.log("=== 4. Deskriptiv je Lauf ===\n");
  console.log(`Plaene (Paar-Entscheidungen): ${JSON.stringify(plaene)}`);
  console.log(`Rutscher ${(rutscher / laeufeN).toFixed(2)}, Pausen ${(pausen / laeufeN).toFixed(2)}, Doppel-Gaenge ${(doppelt / laeufeN).toFixed(2)} je Lauf (beide Seiten, gezaehlt bis Laufende)`);
  console.log(`Laeufe ohne Fertige (Zeitlimit): ${zeitlimitLaeufe}\n`);

  console.log("=== 5. Team-Ebene ===\n");
  console.log(`Lauf: Paar mit hoeherer Eignungssumme gewinnt ${laufFavoritSieg}/${laufFavoritN} (${(100 * laufFavoritSieg / laufFavoritN).toFixed(1)} %)`);
  console.log(`Spiel: Team mit hoeherer Eignungssumme gewinnt ${spielFavoritSieg}/${spielFavoritN} (${(100 * spielFavoritSieg / spielFavoritN).toFixed(1)} %)`);
  console.log(`Endstaende: ${JSON.stringify(seitenVerteilung)}\n`);

  console.log("=== 6. Diagnose: Spielerwert gegen Sub-Skills und Eignung (Pearson, alle Spieler-Spiele) ===\n");
  const wert = alleSpieler.map((b) => b.wert);
  // Obergrenze ohne Paar-Effekte: rho(eig, Solo-Note) je Spiel (dieselben 12 Teilnehmer).
  {
    const proSpiel = new Map();
    for (const b of alleSpieler) { const k = b._spiel; (proSpiel.get(k) || proSpiel.set(k, []).get(k)).push(b); }
    const rs = [...proSpiel.values()].map((l) => rho(l.map((b) => ({ eig: b.eig, wert: b.soloNote }))));
    const rw = [...proSpiel.values()].map((l) => rho(l.map((b) => ({ eig: b.eig, wert: b.wert }))));
    console.log(`rho je Spiel (Mittel aller Spiele): Spielerwert ${(rw.reduce((a, b) => a + b, 0) / rw.length).toFixed(3)}, `
      + `Solo-Note ${(rs.reduce((a, b) => a + b, 0) / rs.length).toFixed(3)}  (Solo = derselbe Spieler allein, deterministisch)`);
    console.log(`r(Spielerwert, Solo-Note) = ${pearson(alleSpieler.map((b) => b.soloNote), wert).toFixed(3)}\n`);
  }
  for (const k of ["eig", "LAST", "TECHNIK", "NERVEN", "ANSAGE", "ERHOLUNG"])
    console.log(`${k.padEnd(9)} r = ${pearson(alleSpieler.map((b) => b[k]), wert).toFixed(3)}`);
  const nachMix = {};
  for (const b of alleSpieler) { const m = nachMix[b.stationen] || (nachMix[b.stationen] = { n: 0, eig: [], wert: [] }); m.n++; m.eig.push(b.eig); m.wert.push(b.wert); }
  console.log("\nStationsmix              Anteil   Eig (Mittel)  Wert (Mittel)   r(eig,wert)");
  for (const [k, m] of Object.entries(nachMix).sort((a, b) => b[1].n - a[1].n))
    console.log(`${(k || "(kein Gang)").padEnd(24)} ${(100 * m.n / alleSpieler.length).toFixed(1).padStart(5)} % ${(m.eig.reduce((a, b) => a + b, 0) / m.n).toFixed(1).padStart(12)} ${(m.wert.reduce((a, b) => a + b, 0) / m.n).toFixed(0).padStart(13)} ${pearson(m.eig, m.wert).toFixed(3).padStart(12)}`);
  const ohneGang = alleSpieler.filter((b) => !b.lastSaecke).length;
  console.log(`\nSpieler ohne eigenen Gang: ${ohneGang} (muss 0 sein)`);
} finally {
  await browser.close();
}
console.log("\nSeitenfehler:", fehler.length ? fehler.slice(0, 5) : "keine");
