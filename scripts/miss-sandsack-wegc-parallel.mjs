// ===================================================================================
// WEG C PARALLEL — VERGLEICHSSONDE (05.10.). Reine Messung, kein Spielpfad.
// docs/design/gewichtheben-sandsack-wegc-parallel-stationen-05-10.md
//
// Misst die Messvariante baueSandsackParallel() (BUEHNE_FLAGS.gewichthebenSandsack 6/7): alle
// sechs eines Teams GLEICHZEITIG, je zwei an einer von drei Stationen, feste Sackklasse je
// Station, Strecke Station -> Silo 24/16/8 m, eine Schicht mit festem Zeitfenster. Auf
// DENSELBEN Spielen wie scripts/miss-sandsack-wegc.mjs (Stufe 2) und
// scripts/miss-sandsack-wegc-6v6.mjs (sequentielles Sechser-Bild): gleiche Kader-Familie,
// gleiche Saaten, gleiche Formkarten/Mutatoren je Spiel; daneben dasselbe Spiel als sechs
// Hantel-Duelle (Mannschaftsebene).
//   Variante 6  Zuteilung nach LAST (Standardregel: die zwei Staerksten an Station 3)
//   Variante 7  Zuteilung per Formel (beste erwartete Silo-kg aus allen 90 Aufteilungen)
//
//   node scripts/miss-sandsack-wegc-parallel.mjs [spiele=24] [--varianten=6,7] [--kalib=k:v,...]
//
// --kalib setzt Schluessel von SANDSACK_PAR_KONF (zeitfenster, kg1..kg3, d1..d3,
// ermuedungFaktor, pauseSchwelle, rastK, ...), nur fuer diesen Lauf.
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
const VARIANTEN = ((process.argv.find((a) => a.startsWith("--varianten=")) || "--varianten=6,7")
  .slice(12).split(",").filter(Boolean).map(Number));
const KALIB = Object.fromEntries(((process.argv.find((a) => a.startsWith("--kalib=")) || "--kalib=")
  .slice(8).split(",").filter(Boolean).map((t) => { const [k, v] = t.split(":"); return [k, Number(v)]; })));
const KURZ = process.argv.includes("--kurz");
const NAME = { 6: "parallel, Zuteilung nach LAST", 7: "parallel, Zuteilung per Formel",
  8: "parallel, Zuteilung nach LAST, Kette mit Entscheidungen (normal/durch/direkt)",
  9: "wie 8, zusaetzlich Station 3 als eigene Kette (Uebergabe am Rampenfuss)" };

// Ueberleitungen wie miss-sandsack-wegc.mjs (Schaetzung): je Schicht 8,7 s, je Spiel 8 s.
const UEBERLEITUNG_JE_LAUF = 1.5 + 1.2 + 4 + 2;
const RAHMEN_JE_SPIEL = 8;

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const mittel = (w) => (w.length ? w.reduce((a, b) => a + b, 0) / w.length : NaN);
const pz = (a, b) => `${a}/${b} (${(100 * a / b).toFixed(1)} %)`;
const rhoVon = (liste, f) => rho(liste.map((b) => ({ eig: b.eig, wert: f(b) })));

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const fehler = [];
try {
  const seite = await browser.newPage();
  await seite.addInitScript(() => { window.AudioContext = undefined; window.webkitAudioContext = undefined; });
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.spieleSandsackWegC && window.__arena.sandsackParKalib, null, { timeout: 30000 });
  const konf = await seite.evaluate((k) => window.__arena.sandsackParKalib(k), KALIB);

  let kaderFamilie, kaderQuelle;
  const geladen = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
  if (geladen) { kaderFamilie = geladen.familie; kaderQuelle = geladen.quelle; }
  else { const g = await baueSynthetischeKaderFamilie(seite); kaderFamilie = g.familie; kaderQuelle = g.quelle; }
  console.log(`Parallel-Sonde — ${SPIELE} Spiele je Paarung, ${kaderFamilie.length} Paarungen (${kaderQuelle})`);
  console.log(`Konfiguration: ${JSON.stringify(konf)}\n`);

  for (const variante of VARIANTEN) {
    console.log(`################ Variante ${variante}: ${NAME[variante] || "?"} ################\n`);
    const zeilen = [];
    const alleSpiele = [];
    let spielFavSieg = 0, spielFavN = 0, hantelFavSieg = 0, favSaecke = 0, favKgm = 0, favArbeit = 0;
    let spielerSpiele = 0, spielerOhne = 0;
    const jeStation = { 1: [], 2: [], 3: [] };

    for (const v of kaderFamilie) {
      await seite.evaluate((k) => window.__arena.kaderSetzen(k), { heim: v.heim, gast: v.gast });
      const spiele = [];
      for (let i = 0; i < SPIELE; i++) {
        spiele.push(await seite.evaluate(([saat, fs, ms, fl]) =>
          window.__arena.spieleSandsackWegC("gewichtheben", saat, { formSaat: fs, mutatorSaat: ms, hantelVergleich: true, flag: fl }),
        [1337 + i * 7919, 20260823 + i * 104729, 20260823 + i * 15485863, variante]));
      }
      alleSpiele.push(...spiele);
      const rNote = spiele.map((s) => rhoVon(s.boxscore, (b) => b.wert));
      const rKg = spiele.map((s) => rhoVon(s.boxscore, (b) => b.lastKg));
      const rStation = spiele.map((s) => rhoVon(s.boxscore, (b) => b.parStation));
      const rHantel = spiele.map((s) => rhoVon(s.hantel.boxscore, (b) => b.wert));
      // Stationsaufteilung gegen "alle an einer Station": dieselbe Schicht-Note, deterministisch
      // (ohne Rutscher), einmal an der eigenen Station, einmal fuer alle an Station 1/2/3.
      const rSolo = [0, 1, 2].map((k) => mittel(spiele.map((s) => rhoVon(s.boxscore, (b) => b.parSoloNoten[k]))));
      const rDet = mittel(spiele.map((s) => rhoVon(s.boxscore, (b) => b.parSoloNoten[b.parStation - 1])));
      const agg = new Map();
      for (const s of spiele) for (const b of s.boxscore) {
        const a = agg.get(b.name) || { eig: 0, wert: 0, k: 0 }; a.eig += b.eig; a.wert += b.wert; a.k++; agg.set(b.name, a);
      }
      const rSaison = rho([...agg.values()].map((a) => ({ eig: a.eig / a.k, wert: a.wert / a.k })));
      let siegeHeim = 0;
      for (const s of spiele) {
        const L = s.wegc.laeufe[0];
        if (L.sieger === 0) siegeHeim++;
        const teamEig = [0, 1].map((side) => s.boxscore.filter((b) => b.seite === side).reduce((a, b) => a + b.eig, 0));
        if (teamEig[0] !== teamEig[1]) {
          const fav = teamEig[0] > teamEig[1] ? 0 : 1;
          spielFavN++;
          if (L.sieger === fav) spielFavSieg++;
          if (L.saecke[fav] > L.saecke[1 - fav]) favSaecke++;
          if (L.kgm[fav] > L.kgm[1 - fav]) favKgm++;
          if (L.arbeit[fav] > L.arbeit[1 - fav]) favArbeit++;
          const h = s.hantel;
          const favVorn = h.seiten[fav] !== h.seiten[1 - fav] ? h.seiten[fav] > h.seiten[1 - fav] : h.gesamtKg[fav] > h.gesamtKg[1 - fav];
          if (favVorn) hantelFavSieg++;
        }
        for (const b of s.boxscore) {
          spielerSpiele++; if (!b.lastSaecke) spielerOhne++;
          jeStation[b.parStation].push(b);
        }
      }
      zeilen.push({ label: v.label, rNote: mittel(rNote), rSaison, rKg: mittel(rKg), rStation: mittel(rStation),
        rHantel: mittel(rHantel), siegeHeim, rSolo, rDet });
    }

    console.log("=== 1. Rangtreue je Paarung (Spielerwert = Tragenote x10) ===\n");
    console.log("Paarung                          rho Spiel  rho Saison  | Diagnose: Wert=kg  Wert=Stationsrang  Hantel  | Heim gewinnt");
    for (const z of zeilen) console.log(`${z.label.padEnd(32)} ${z.rNote.toFixed(3).padStart(9)} ${z.rSaison.toFixed(3).padStart(11)}  | ${z.rKg.toFixed(3).padStart(17)} ${z.rStation.toFixed(3).padStart(18)} ${z.rHantel.toFixed(3).padStart(7)}  | ${z.siegeHeim}/${SPIELE}`);
    const med = (f) => median(zeilen.map(f));
    console.log(`\nMedian je Spiel ${med((z) => z.rNote).toFixed(3)} (schwaechste ${Math.min(...zeilen.map((z) => z.rNote)).toFixed(3)}, `
      + `Spannweite ${(Math.max(...zeilen.map((z) => z.rNote)) - Math.min(...zeilen.map((z) => z.rNote))).toFixed(3)}), Saison ${med((z) => z.rSaison).toFixed(3)}`);
    console.log(`Diagnose-Mediane: Wert=kg ${med((z) => z.rKg).toFixed(3)}, Wert=Stationsrang allein ${med((z) => z.rStation).toFixed(3)}, Hantel dieselben Spiele ${med((z) => z.rHantel).toFixed(3)}`);
    console.log(`Stationsaufteilung (ohne Rutscher): eigene Station ${med((z) => z.rDet).toFixed(3)} | alle an Station 1 ${med((z) => z.rSolo[0]).toFixed(3)}, an 2 ${med((z) => z.rSolo[1]).toFixed(3)}, an 3 ${med((z) => z.rSolo[2]).toFixed(3)}\n`);

    console.log("=== 2. Beteiligung ===\n");
    console.log(`Spieler-Spiele ohne einen Sack: ${pz(spielerOhne, spielerSpiele)}\n`);

    console.log("=== 3. Stationen (Mittel je Spieler-Spiel) ===\n");
    console.log("Station  Anteil  Eig    LAST  Note   Saecke  kg     Pausen  Rutscher  Doppel  rho(Eig,Note) innerhalb");
    for (const s of [1, 2, 3]) {
      const B = jeStation[s];
      if (!B.length) continue;
      console.log(`${String(s).padEnd(8)} ${(100 * B.length / spielerSpiele).toFixed(0).padStart(4)} % ${mittel(B.map((b) => b.eig)).toFixed(1).padStart(5)} ${mittel(B.map((b) => b.LAST)).toFixed(0).padStart(5)} ${mittel(B.map((b) => b.wert / 10)).toFixed(1).padStart(5)} ${mittel(B.map((b) => b.lastSaecke)).toFixed(1).padStart(7)} ${mittel(B.map((b) => b.lastKg)).toFixed(0).padStart(6)} ${mittel(B.map((b) => b.lastPausen)).toFixed(2).padStart(7)} ${mittel(B.map((b) => b.lastRutscher)).toFixed(2).padStart(9)} ${mittel(B.map((b) => b.lastDoppelt)).toFixed(2).padStart(7)} ${rhoVon(B, (b) => b.wert).toFixed(3).padStart(10)}`);
    }
    console.log("");

    // Nur Variante 8/9: die Entscheidungen je Traeger (Kette an Station 1/2, bei 9 auch an 3).
    const K8 = alleSpiele.flatMap((s) => s.boxscore).filter((b) => b.parRolle === "kette");
    const KS = [1, 2, 3].filter((s) => K8.some((b) => b.parStation === s));
    if (K8.length) {
      console.log(`=== 3b. Entscheidungen an der Ablage (Kette, Station ${KS.join("/")}) ===\n`);
      const summe = (f) => K8.reduce((a, b) => a + f(b), 0);
      const n = summe((b) => b.parEntsch.normal), d = summe((b) => b.parEntsch.durch);
      const r = summe((b) => b.parEntsch.direkt), e = summe((b) => b.parEntsch.erzwungen);
      const frei = n + d + r, alle = frei + e;
      const p = (x, y) => `${(100 * x / y).toFixed(1)} %`;
      console.log(`Freie Wahlen je Traeger und Schicht ${(frei / K8.length).toFixed(1)}, erzwungen ${(e / K8.length).toFixed(1)}`);
      console.log(`KI-Vorgabe (freie Wahlen): normal ${p(n, frei)}, durchpowern ${p(d, frei)}, direkt ${p(r, frei)}`);
      console.log(`alle Ankuenfte an der Ablage: normal ${p(n, alle)}, durch ${p(d, alle)}, direkt ${p(r, alle)}, erzwungen durch ${p(e, alle)}`);
      for (const s of KS) {
        const B = K8.filter((b) => b.parStation === s);
        if (!B.length) continue;
        const f = (k) => B.reduce((a, b) => a + b.parEntsch[k], 0);
        const fr = f("normal") + f("durch") + f("direkt");
        console.log(`  Station ${s}: normal ${p(f("normal"), fr)}, durch ${p(f("durch"), fr)}, direkt ${p(f("direkt"), fr)}, erzwungen ${(f("erzwungen") / B.length).toFixed(1)} je Traeger (frei ${(fr / B.length).toFixed(1)})`);
      }
      // Wer waehlt was? rho zwischen Anteil durch bzw. direkt und Wagemut/Teamsinn/Reserve-Kanaelen.
      const anteil = (b, k) => { const fr = b.parEntsch.normal + b.parEntsch.durch + b.parEntsch.direkt; return fr ? b.parEntsch[k] / fr : 0; };
      const rr = (f, g) => rho(K8.map((b) => ({ eig: f(b), wert: g(b) })));
      console.log(`Anteil durch ~ Wagemut rho ${rr((b) => b.parHaltung.mut, (b) => anteil(b, "durch")).toFixed(2)}, ~ ERHOLUNG ${rr((b) => b.ERHOLUNG, (b) => anteil(b, "durch")).toFixed(2)}, ~ NERVEN ${rr((b) => b.NERVEN, (b) => anteil(b, "durch")).toFixed(2)}, ~ Eignung ${rr((b) => b.eig, (b) => anteil(b, "durch")).toFixed(2)}`);
      console.log(`Anteil direkt ~ Teamsinn rho ${rr((b) => b.parHaltung.team, (b) => anteil(b, "direkt")).toFixed(2)}, ~ Eignung ${rr((b) => b.eig, (b) => anteil(b, "direkt")).toFixed(2)}`);
      // Kein toter Knopf: welche feste Wahl haette der Stationsmannschaft am meisten Silo-kg gebracht?
      const beste = [0, 0, 0]; let kiBest = 0, kiGap = 0;
      for (const b of K8) {
        const o = b.parOptionKg.slice(0, 3), m = Math.max(...o), w = o.filter((x) => x === m).length;
        o.forEach((x, i) => { if (x === m) beste[i] += 1 / w; });
        if (b.parOptionKg[3] >= m) kiBest++;
        kiGap += m - b.parOptionKg[3];
      }
      console.log(`Beste feste Wahl je Traeger (Silo-kg der Station, gleiche Wuerfe, Partner KI): normal ${p(beste[0], K8.length)}, durch ${p(beste[1], K8.length)}, direkt-wo-moeglich ${p(beste[2], K8.length)}`);
      for (const s of KS) {
        const B = K8.filter((b) => b.parStation === s), be = [0, 0, 0];
        for (const b of B) { const o = b.parOptionKg.slice(0, 3), m = Math.max(...o), w = o.filter((x) => x === m).length; o.forEach((x, i) => { if (x === m) be[i] += 1 / w; }); }
        const mk = (i) => mittel(B.map((b) => b.parOptionKg[i]));
        console.log(`  Station ${s}: beste feste Wahl normal ${p(be[0], B.length)}, durch ${p(be[1], B.length)}, direkt ${p(be[2], B.length)} | Silo-kg der Station: normal ${mk(0).toFixed(0)}, durch ${mk(1).toFixed(0)}, direkt ${mk(2).toFixed(0)}, KI ${mk(3).toFixed(0)}`);
      }
      console.log(`KI-Vorgabe mindestens so gut wie die beste feste Wahl: ${p(kiBest, K8.length)}, mittlerer Abstand zur besten ${(kiGap / K8.length).toFixed(1)} kg`);
      for (const s of KS) {
        const B = K8.filter((b) => b.parStation === s);
        const kb = B.filter((b) => b.parOptionKg[3] >= Math.max(...b.parOptionKg.slice(0, 3))).length;
        console.log(`  Station ${s}: KI mindestens so gut wie die beste feste Wahl ${p(kb, B.length)}, Abstand ${mittel(B.map((b) => Math.max(...b.parOptionKg.slice(0, 3)) - b.parOptionKg[3])).toFixed(1)} kg`);
      }
      const L8 = alleSpiele.map((s) => s.wegc.laeufe[0]);
      console.log(`Saecke an der Ablage liegen geblieben (Hupe) je Seite: ${mittel(L8.flatMap((x) => x.haufenRest)).toFixed(2)}\n`);
    }

    // Nur Variante 9: ISOLATIONSNACHWEIS der Sackklassen — jeder Spieler darf nur Saecke der
    // Klasse seiner Station getragen haben (kg je Sack, auch nach Ablage/Uebergabe).
    const KL = alleSpiele.flatMap((s) => s.boxscore).filter((b) => Array.isArray(b.parSackKlassen));
    if (KL.length) {
      console.log("=== 3c. Isolationsnachweis: Sackklassen je Station (kg je Sack, den ein Spieler je getragen hat) ===\n");
      const soll = { 1: konf.kg1, 2: konf.kg2, 3: konf.kg3 };
      let fremd = 0;
      for (const s of [1, 2, 3]) {
        const B = KL.filter((b) => b.parStation === s);
        const klassen = [...new Set(B.flatMap((b) => b.parSackKlassen))].sort((a, b) => a - b);
        const f = B.filter((b) => b.parSackKlassen.some((k) => k !== soll[s])).length;
        fremd += f;
        console.log(`  Station ${s} (Soll ${soll[s]} kg): ${B.length} Spieler-Spiele, getragene Klassen {${klassen.join(", ")}} kg, mit fremder Klasse ${f}`);
      }
      const leer = KL.filter((b) => !b.parSackKlassen.length).length;
      console.log(`  ${fremd === 0 ? "GETRENNT" : "VERMISCHT"}: ${fremd} von ${KL.length} Spieler-Spielen mit fremder Sackklasse (ohne einen getragenen Sack: ${leer})\n`);
    }

    console.log("=== 4. Sendezeit und Mannschaftsebene ===\n");
    const T = konf.zeitfenster;
    const send = T + UEBERLEITUNG_JE_LAUF + RAHMEN_JE_SPIEL;
    console.log(`Sendezeit je Spiel (1:1, eine Schicht ${T} s + 8,7 s Ueberleitung + 8 s Rahmen): ${mmss(send)} — fest, ${send >= 150 && send <= 240 ? "im" : "AUSSERHALB des"} Fensters 2:30–4:00`);
    console.log(`Spiel: Team mit hoeherer Eignungssumme gewinnt (Silo-kg) ${pz(spielFavSieg, spielFavN)}`);
    console.log(`        Diagnose andere Wertung: mehr Saecke ${pz(favSaecke, spielFavN)}, mehr kg*m ${pz(favKgm, spielFavN)}, mehr Arbeitswert (Sack = Referenz-50-Sekunden der Station) ${pz(favArbeit, spielFavN)}`);
    console.log(`        dieselben Spiele, sechs Hantel-Duelle: ${pz(hantelFavSieg, spielFavN)}`);
    const L = alleSpiele.map((s) => s.wegc.laeufe[0]);
    console.log(`Je Schicht (beide Seiten): Rutscher ${mittel(L.map((x) => x.rutscher[0] + x.rutscher[1])).toFixed(2)}, Pausen ${mittel(L.map((x) => x.pausen[0] + x.pausen[1])).toFixed(2)}, Doppel ${mittel(L.map((x) => x.doppelt[0] + x.doppelt[1])).toFixed(2)}, Saecke ${mittel(L.map((x) => x.saecke[0] + x.saecke[1])).toFixed(1)}, Silo-kg je Seite ${mittel(L.flatMap((x) => x.abgeliefertKg)).toFixed(0)}`);
    const anteil = [1, 2, 3].map((s) => mittel(alleSpiele.flatMap((sp) => [0, 1].map((side) => {
      const B = sp.boxscore.filter((b) => b.seite === side);
      const ges = B.reduce((a, b) => a + b.lastKg, 0);
      return ges ? B.filter((b) => b.parStation === s).reduce((a, b) => a + b.lastKg, 0) / ges : 0;
    }))));
    console.log(`Anteil am Silo (kg): Station 1 ${(100 * anteil[0]).toFixed(0)} %, Station 2 ${(100 * anteil[1]).toFixed(0)} %, Station 3 ${(100 * anteil[2]).toFixed(0)} %\n`);

    {
      // Woran misst jede Station? Lineare Regression (OLS) der Schicht-Note je Station auf die
      // fuenf Sub-Skills, ueber alle Spieler-Spiele — daneben dieselbe Regression fuer die Eignung.
      const X = ["LAST", "TECHNIK", "NERVEN", "ANSAGE", "ERHOLUNG"];
      const B = alleSpiele.flatMap((s) => s.boxscore);
      const ols = (y) => {
        const A = B.map((b) => [1, ...X.map((k) => b[k])]), p = X.length + 1;
        const M = Array.from({ length: p }, (_, i) => [...Array.from({ length: p }, (_, j) => A.reduce((a, r) => a + r[i] * r[j], 0)), A.reduce((a, r, k) => a + r[i] * y[k], 0)]);
        for (let i = 0; i < p; i++) {
          let m = i; for (let k = i + 1; k < p; k++) if (Math.abs(M[k][i]) > Math.abs(M[m][i])) m = k;
          [M[i], M[m]] = [M[m], M[i]];
          for (let k = 0; k < p; k++) if (k !== i) { const f = M[k][i] / M[i][i]; for (let j = i; j <= p; j++) M[k][j] -= f * M[i][j]; }
        }
        const beta = M.map((r, i) => r[p] / r[i]);
        const yh = A.map((r) => r.reduce((a, x, i) => a + x * beta[i], 0)), my = mittel(y);
        return { beta: beta.slice(1), r2: 1 - y.reduce((a, v, i) => a + (v - yh[i]) ** 2, 0) / y.reduce((a, v) => a + (v - my) ** 2, 0) };
      };
      console.log("=== 5. Woran misst jede Station? (OLS auf die Sub-Skills, alle Spieler-Spiele) ===\n");
      for (const [name, y] of [["Eignung", B.map((b) => b.eig)], ...[0, 1, 2].map((k) => [`Note St.${k + 1}`, B.map((b) => b.parSoloNoten[k])])]) {
        const { beta, r2 } = ols(y);
        console.log(`${name.padEnd(10)} ${X.map((k, i) => `${k} ${beta[i].toFixed(3)}`).join("  ")}  R2 ${r2.toFixed(3)}`);
      }
      console.log("");
    }
    if (!KURZ) {
      console.log("=== 6. Mortal Sin – Natures Wrath, je Spieler (Mittel ueber die Spiele) ===\n");
      const ms = alleSpiele.filter((s) => s.boxscore.some((b) => b.name === "Buttercup"));
      const proSpieler = new Map();
      for (const s of ms) for (const b of s.boxscore) {
        const a = proSpieler.get(b.name) || { b, eig: [], wert: [], kg: [], st: [], p: [] };
        a.eig.push(b.eig); a.wert.push(b.wert); a.kg.push(b.lastKg); a.st.push(b.parStation); a.p.push(b.lastPausen); proSpieler.set(b.name, a);
      }
      console.log("Seite Spieler              Eig   LAST TECH NERV ANS ERH  Station  Note   kg    Pausen");
      for (const a of [...proSpieler.values()].sort((x, y) => x.b.seite - y.b.seite || mittel(y.eig) - mittel(x.eig)))
        console.log(`${a.b.seite}     ${a.b.name.padEnd(20)} ${mittel(a.eig).toFixed(1).padStart(5)} ${String(a.b.LAST).padStart(4)} ${String(a.b.TECHNIK).padStart(4)} ${String(a.b.NERVEN).padStart(4)} ${String(a.b.ANSAGE).padStart(3)} ${String(a.b.ERHOLUNG).padStart(3)} ${mittel(a.st).toFixed(1).padStart(8)} ${(mittel(a.wert) / 10).toFixed(1).padStart(5)} ${mittel(a.kg).toFixed(0).padStart(5)} ${mittel(a.p).toFixed(1).padStart(7)}`);
      console.log("");
    }
  }
} finally {
  await browser.close();
}
console.log("Seitenfehler:", fehler.length ? fehler.slice(0, 5) : "keine");
