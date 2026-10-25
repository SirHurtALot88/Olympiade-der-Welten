// ===================================================================================
// WEG C IM SECHSER-BILD — VERGLEICHSSONDE (05.10.). Reine Messung, kein Spielpfad.
// docs/design/gewichtheben-sandsack-wegc-6v6-vergleich-05-10.md
//
// Misst die Messvariante baueSandsack6v6() (BUEHNE_FLAGS.gewichthebenSandsack 2/3/4) auf
// DENSELBEN Spielen wie scripts/miss-sandsack-wegc.mjs (Stufe 2, 2 gegen 2): gleiche
// Kader-Familie, gleiche Saaten, gleiche Formkarten/Mutatoren je Spiel. Daneben jeweils dasselbe
// Spiel im heutigen Format (sechs Hantel-Duelle, ueber spieleSandsackWegC(..,{hantelVergleich})).
//   Variante 2  drei volle 6-gegen-6-Rennen, bestes aus drei (Hauptvariante)
//   Variante 3  EIN 6-gegen-6-Rennen ersetzt die sechs Duelle (Referenz, = Paket-1-Finale)
//   Variante 4  wie 2, Plan Staffel fuer alle erzwungen (Diagnose: alle sechs tragen)
//   Variante 5  wie 3 (ein Rennen), Plan Staffel erzwungen
//
//   node scripts/miss-sandsack-wegc-6v6.mjs [spiele=24] [--varianten=2,3,4,5]
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
const VARIANTEN = ((process.argv.find((a) => a.startsWith("--varianten=")) || "--varianten=2,3,4,5")
  .slice(12).split(",").filter(Boolean).map(Number));
const NAME = { 2: "6v6 x3 (bestes aus drei)", 3: "6v6 x1 (ein Rennen)", 4: "6v6 x3, Staffel erzwungen", 5: "6v6 x1, Staffel erzwungen" };

// Ueberleitungen wie miss-sandsack-wegc.mjs (Schaetzung): je Rennen 8,7 s, je Spiel 8 s.
const UEBERLEITUNG_JE_LAUF = 1.5 + 1.2 + 4 + 2;
const RAHMEN_JE_SPIEL = 8;
// Paket-2-Szene: jede Seite wird auf hoechstens SANDSACK_VIZ_MAX_DAUER = 150 s gestaucht.
const VIZ_MAX = 150;

const quantil = (w, q) => { const s = [...w].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const mittel = (w) => w.reduce((a, b) => a + b, 0) / w.length;
const pz = (a, b) => `${a}/${b} (${(100 * a / b).toFixed(1)} %)`;

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const fehler = [];
try {
  const seite = await browser.newPage();
  await seite.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.spieleSandsackWegC, null, { timeout: 30000 });

  let kaderFamilie, kaderQuelle;
  const geladen = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
  if (geladen) { kaderFamilie = geladen.familie; kaderQuelle = geladen.quelle; }
  else { const g = await baueSynthetischeKaderFamilie(seite); kaderFamilie = g.familie; kaderQuelle = g.quelle; }
  console.log(`Sechser-Bild-Sonde — ${SPIELE} Spiele je Paarung, ${kaderFamilie.length} Paarungen (${kaderQuelle})\n`);

  for (const variante of VARIANTEN) {
    console.log(`################ Variante ${variante}: ${NAME[variante] || "?"} ################\n`);
    const zeilen = [], rhoJePaarung = [], saisonJePaarung = [], rhoTraegerJePaarung = [];
    const send = { sieger: [], beide: [], p2: [], sieger2zu0: [] };
    let laeufeN = 0, zeitlimit = 0, rutscher = 0, pausen = 0, doppelt = 0, entschiedenNach2 = 0;
    let laufFavSieg = 0, laufFavN = 0, spielFavSieg = 0, spielFavN = 0, hantelFavSieg = 0, hantelFavN = 0;
    const endstaende = {}, plaene = {}, ohneSack = {}; // ohneSack: Plan -> {null, n}
    let spielerSpiele = 0, spielerOhne = 0, paket1Abweichung = 0, paket1Vergleiche = 0;
    const laufendeSieger = [], laufendeBeide = [];
    const nachMix = {}; // Stationsmix -> {n, eig[], wert[]}

    for (const v of kaderFamilie) {
      await seite.evaluate((k) => window.__arena.kaderSetzen(k), { heim: v.heim, gast: v.gast });
      const spiele = [];
      for (let i = 0; i < SPIELE; i++) {
        spiele.push(await seite.evaluate(([saat, fs, ms, fl]) =>
          window.__arena.spieleSandsackWegC("gewichtheben", saat, { formSaat: fs, mutatorSaat: ms, hantelVergleich: true, flag: fl }),
        [1337 + i * 7919, 20260823 + i * 104729, 20260823 + i * 15485863, variante]));
      }
      const rhos = spiele.map((s) => rho(s.boxscore.map((b) => ({ eig: b.eig, wert: b.wert }))));
      // Diagnose: rho nur ueber die Spieler, die getragen haben (trennt "Nullen" von "Note").
      const rhosTraeger = spiele.map((s) => {
        const t = s.boxscore.filter((b) => b.lastSaecke > 0);
        return t.length >= 3 ? rho(t.map((b) => ({ eig: b.eig, wert: b.wert }))) : NaN;
      }).filter((r) => Number.isFinite(r));
      const agg = new Map();
      for (const s of spiele) for (const b of s.boxscore) {
        const a = agg.get(b.name) || { eig: 0, wert: 0, k: 0 }; a.eig += b.eig; a.wert += b.wert; a.k++; agg.set(b.name, a);
      }
      const rSpiel = mittel(rhos);
      const rSaison = rho([...agg.values()].map((a) => ({ eig: a.eig / a.k, wert: a.wert / a.k })));
      rhoJePaarung.push(rSpiel); saisonJePaarung.push(rSaison); rhoTraegerJePaarung.push(mittel(rhosTraeger));

      let siegeHeim = 0, nullAnteil = 0, planText = "";
      for (const s of spiele) {
        const w = s.wegc;
        const eigVon = (n) => (s.boxscore.find((b) => b.name === n) || { eig: 0 }).eig;
        const L = w.laeufe;
        const endeP2 = L.map((x) => Math.max(...x.zeit.map((t) => Math.min(t, VIZ_MAX))));
        send.sieger.push(w.sendezeitSim + UEBERLEITUNG_JE_LAUF * L.length + RAHMEN_JE_SPIEL);
        send.beide.push(w.sendezeitBeide + UEBERLEITUNG_JE_LAUF * L.length + RAHMEN_JE_SPIEL);
        send.p2.push(endeP2.reduce((a, b) => a + b, 0) + UEBERLEITUNG_JE_LAUF * L.length + RAHMEN_JE_SPIEL);
        // bestes aus drei mit Abbruch bei 2:0 (der dritte Lauf faellt weg; Spielerwert unveraendert gemessen)
        const n2 = L.length === 3 && L[0].sieger === L[1].sieger ? 2 : L.length;
        if (L.length === 3 && n2 === 2) entschiedenNach2++;
        send.sieger2zu0.push(L.slice(0, n2).reduce((a, x) => a + x.ende, 0) + UEBERLEITUNG_JE_LAUF * n2 + RAHMEN_JE_SPIEL);

        const k = `${w.seiten[0]}:${w.seiten[1]}`; endstaende[k] = (endstaende[k] || 0) + 1;
        if (w.seiten[0] > w.seiten[1]) siegeHeim++;
        const teamEig = [0, 1].map((side) => s.boxscore.filter((b) => b.seite === side).reduce((a, b) => a + b.eig, 0));
        if (teamEig[0] !== teamEig[1]) {
          const fav = teamEig[0] > teamEig[1] ? 0 : 1;
          spielFavN++; if (w.seiten[fav] > w.seiten[1 - fav]) spielFavSieg++;
          for (const x of L) { laufFavN++; if (x.sieger === fav) laufFavSieg++; }
          const h = s.hantel;
          hantelFavN++;
          const favVorn = h.seiten[fav] !== h.seiten[1 - fav] ? h.seiten[fav] > h.seiten[1 - fav] : h.gesamtKg[fav] > h.gesamtKg[1 - fav];
          if (favVorn) hantelFavSieg++;
        }
        for (const x of L) {
          laeufeN++;
          laufendeSieger.push(x.ende); laufendeBeide.push(x.endeBeide);
          if (!x.fertig[0] && !x.fertig[1]) zeitlimit++;
          rutscher += x.rutscher[0] + x.rutscher[1]; pausen += x.pausen[0] + x.pausen[1]; doppelt += x.doppelt[0] + x.doppelt[1];
        }
        for (const p of L[0].plan) plaene[p] = (plaene[p] || 0) + 1;
        planText = `${L[0].plan[0]}/${L[0].plan[1]}`;
        for (const b of s.boxscore) {
          const plan = L[0].plan[b.seite];
          const o = ohneSack[plan] || (ohneSack[plan] = { null: 0, n: 0 });
          o.n++; spielerSpiele++;
          const mixKey = b.stationen6v6 || "(kein Sack)";
          const m = nachMix[mixKey] || (nachMix[mixKey] = { n: 0, eig: [], wert: [] });
          m.n++; m.eig.push(b.eig); m.wert.push(b.wert);
          if (!b.lastSaecke) { o.null++; spielerOhne++; nullAnteil++; }
        }
        // Gegenprobe Variante 3: Rennen 1 muss Zeichen fuer Zeichen das Paket-1-Finale sein
        // (gleiche Saecke je Spieler wie das additive Finale hinter den Hantel-Duellen).
        if (variante === 3) for (const b of s.boxscore) {
          const hb = s.hantel.boxscore.find((x) => x.name === b.name);
          paket1Vergleiche++; if (!hb || hb.finaleSaecke !== b.lastSaecke) paket1Abweichung++;
        }
      }
      zeilen.push({ label: v.label, rSpiel, rSaison, rTraeger: mittel(rhosTraeger), siegeHeim, plan: planText,
        ohne: nullAnteil / (SPIELE * 12) });
    }

    console.log("=== 1. Rangtreue (Spielerwert = Tragenote x10, Nichttraeger 0) ===\n");
    console.log("Paarung                          rho Spiel  rho Saison  rho nur Traeger  ohne Sack  Plan Heim/Gast   Heim gewinnt");
    for (const z of zeilen) console.log(`${z.label.padEnd(32)} ${z.rSpiel.toFixed(3).padStart(9)} ${z.rSaison.toFixed(3).padStart(11)} ${z.rTraeger.toFixed(3).padStart(16)} ${(100 * z.ohne).toFixed(1).padStart(8)} %  ${z.plan.padEnd(16)} ${z.siegeHeim}/${SPIELE}`);
    console.log(`\nMedian je Spiel ${median(rhoJePaarung).toFixed(3)} (Spannweite ${(Math.max(...rhoJePaarung) - Math.min(...rhoJePaarung)).toFixed(3)}, `
      + `schwaechste ${Math.min(...rhoJePaarung).toFixed(3)}), Saison ${median(saisonJePaarung).toFixed(3)}, nur Traeger ${median(rhoTraegerJePaarung).toFixed(3)}\n`);

    console.log("=== 2. Spieler ohne einen einzigen Sack ===\n");
    console.log(`gesamt ${pz(spielerOhne, spielerSpiele)}`);
    for (const [plan, o] of Object.entries(ohneSack)) console.log(`  Plan ${plan.padEnd(10)} ${pz(o.null, o.n)}, ${(6 * o.null / o.n).toFixed(2)} von 6`);
    console.log(`Plaene (Team-Entscheidungen): ${JSON.stringify(plaene)}`);
    if (variante === 3) console.log(`Gegenprobe Rennen 1 = Paket-1-Finale (Saecke je Spieler): ${paket1Abweichung} Abweichungen in ${paket1Vergleiche}`);
    console.log("");

    console.log("=== 3. Sendezeit je Spiel ===\n");
    console.log(`Rennende (Sim-s), Sieger im Ziel: Median ${median(laufendeSieger).toFixed(1)}, 90 % ${quantil(laufendeSieger, 0.9).toFixed(1)}, max ${Math.max(...laufendeSieger).toFixed(1)}`);
    console.log(`Rennende (Sim-s), beide im Ziel:  Median ${median(laufendeBeide).toFixed(1)}, 90 % ${quantil(laufendeBeide, 0.9).toFixed(1)}, max ${Math.max(...laufendeBeide).toFixed(1)}`);
    const zeige = (t, w) => {
      const im = w.filter((x) => x >= 150 && x <= 240).length;
      console.log(`${t.padEnd(44)} Median ${mmss(median(w))}  10 % ${mmss(quantil(w, 0.1))}  90 % ${mmss(quantil(w, 0.9))}  max ${mmss(Math.max(...w))}  im Fenster 2:30–4:00 ${(100 * im / w.length).toFixed(1)} %`);
    };
    zeige("1:1, bis Sieger im Ziel (Stufe-2-Methode)", send.sieger);
    zeige("1:1, bis beide im Ziel", send.beide);
    zeige("Paket-2-Deckel (je Seite <=150 s, beide)", send.p2);
    if (variante === 2 || variante === 4) {
      zeige("1:1 Sieger, Abbruch bei 2:0", send.sieger2zu0);
      console.log(`2:0 nach zwei Rennen entschieden: ${pz(entschiedenNach2, send.sieger.length)}`);
    }
    console.log("");

    console.log("=== 4. Ablauf und Mannschaftsebene ===\n");
    console.log(`Rutscher ${(rutscher / laeufeN).toFixed(2)}, Pausen ${(pausen / laeufeN).toFixed(2)}, Doppel-Gaenge ${(doppelt / laeufeN).toFixed(2)} je Rennen (beide Seiten); Rennen ohne Fertige ${pz(zeitlimit, laeufeN)}`);
    console.log(`Rennen: Team mit hoeherer Eignungssumme gewinnt ${pz(laufFavSieg, laufFavN)}`);
    console.log(`Spiel:  Team mit hoeherer Eignungssumme gewinnt ${pz(spielFavSieg, spielFavN)}`);
    console.log(`        dieselben Spiele, sechs Hantel-Duelle:   ${pz(hantelFavSieg, hantelFavN)}`);
    console.log(`Endstaende: ${JSON.stringify(endstaende)}\n`);

    console.log("=== 5. Diagnose: Stationsmix (wo hat der Spieler getragen) ===\n");
    console.log("Stationsmix              Anteil   Eig (Mittel)  Wert (Mittel)");
    for (const [k, m] of Object.entries(nachMix).sort((a, b) => b[1].n - a[1].n))
      console.log(`${k.padEnd(24)} ${(100 * m.n / spielerSpiele).toFixed(1).padStart(5)} % ${mittel(m.eig).toFixed(1).padStart(12)} ${mittel(m.wert).toFixed(0).padStart(13)}`);
    console.log("");
  }
} finally {
  await browser.close();
}
console.log("Seitenfehler:", fehler.length ? fehler.slice(0, 5) : "keine");
