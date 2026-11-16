// ===================================================================================
// DIE RHO-BASISLINIE BAUEN — der eingecheckte Ausgangspunkt fuer scripts/pruefe-rangtreue-schranke.mjs.
//
// Misst ALLE (oder die angegebenen) Disziplinen kaderfest (s. scripts/miss-alle-disziplinen.mjs)
// und schreibt Median, Spannweite und eine daraus abgeleitete Schranke je Disziplin nach
// data/generated/rangtreue-basislinie.json. Die Schranke steht IN der Basislinie, nicht nur im
// Pruefskript — damit eine Aenderung der Schranken-Formel sichtbar im Diff steht, statt sich
// unbemerkt hinter demselben JSON zu aendern.
//
// Schranken-Formel (docs/design/messgrundlage-kaderfest.md begruendet die Zahlen):
//   schranke = max(SCHRANKE_BODEN, SCHRANKE_ANTEIL * spielSpannweite)
// SCHRANKE_BODEN faengt Disziplinen mit winziger Spannweite ab (Basketball, Speed-Schach) —
// ohne Boden waere dort jede Rundungsdifferenz ein Fehlschlag. SCHRANKE_ANTEIL haelt die
// Schranke unter dem vollen Kaderrauschen: Opus' Vorgabe ("groesser als das Kaderrauschen, sonst
// schlaegt CI grundlos an") gilt fuer eine Messung OHNE Kaderfamilie; mit ihr (Median ueber
// mehrere Paarungen) ist die tatsaechliche Ziehungsvarianz kleiner als die volle Spannweite,
// und ein Bruchteil davon reicht, um Rauschen von echten Regressionen zu trennen.
//
//   node scripts/baue-rangtreue-basislinie.mjs [spiele] [disziplin ...]
//
// ZUSATZMESSUNGEN (16.11., docs/design/spurt-ci-schutz-16-11.md): neben den zwanzig Disziplinen steht
// im Schluessel `zusatzmessungen` die Spurt-MISCHUNG (Format je Saat per Hash, Kartenmodus "echt")
// und die drei Spurt-Einzelformate -- die kader-lose Standardmessung sieht nur "klassisch". Sie
// werden bei jedem Lauf ohne Disziplinliste, oder mit "spurt-mischung" in der Liste, neu gemessen;
// bei einer Liste ohne diesen Namen bleibt der bisherige Block der Datei erhalten.
//
// Ohne Disziplinliste laufen alle zwanzig. Ueberschreibt data/generated/rangtreue-basislinie.json
// komplett — ein gezieltes Neuziehen nur weniger Disziplinen bitte per Hand in die bestehende
// Datei einpflegen, sonst verliert man die Zahlen der anderen.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  disziplinMessen, ladeKaderFamilieAusDatei, baueSynthetischeKaderFamilie,
  oeffneSpurtMischungsSeite, spurtFormatAnteile, messeSpurtMischungRho,
} from "./lib/rangtreue-messung.mjs";

const SCHRANKE_BODEN = 0.05;
const SCHRANKE_ANTEIL = 0.3;

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE
  || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const ZIEL = path.join(WURZEL, "data/generated/rangtreue-basislinie.json");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const SPIELE = Number(process.argv[2] || 24);
const NUR_ROH = process.argv.slice(3);
const MISCHUNG_NEU = NUR_ROH.length === 0 || NUR_ROH.includes("spurt-mischung");
const NUR = NUR_ROH.filter((d) => d !== "spurt-mischung");

let kaderFamilie, kaderQuelle;
const geladen = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
if (geladen) { kaderFamilie = geladen.familie; kaderQuelle = geladen.quelle; }

// try/finally: ein abgestuerzter Browser darf keinen Chromium-Prozess hinterlassen (s.
// derselbe Kommentar in miss-alle-disziplinen.mjs).
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const disziplinen = {};
let zusatzmessungen = null;
const rund3 = (x) => Math.round(x * 1000) / 1000;
try {
  const seite = await browser.newPage();
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.disziplinProbe, null, { timeout: 30000 });

  if (!kaderFamilie) {
    const gebaut = await baueSynthetischeKaderFamilie(seite);
    kaderFamilie = gebaut.familie;
    kaderQuelle = gebaut.quelle;
  }

  const alleDisz = (NUR_ROH.length && !NUR.length) ? [] : (NUR.length ? NUR : await seite.evaluate(() => window.__arena.motoren()));

  for (const d of alleDisz) {
    const z = await disziplinMessen(seite, d, { n: SPIELE, kaderFamilie });
    if (z.fehler) { console.log(`${d.padEnd(20)} — ${z.fehler}`); continue; }
    const schranke = Math.round(Math.max(SCHRANKE_BODEN, SCHRANKE_ANTEIL * z.spielSpan) * 1000) / 1000;
    disziplinen[d] = {
      chassis: z.chassis,
      spielMedian: Math.round(z.spielMed * 1000) / 1000,
      spielSpannweite: Math.round(z.spielSpan * 1000) / 1000,
      saisonMedian: Math.round(z.saisonMed * 1000) / 1000,
      saisonSpannweite: Math.round(z.saisonSpan * 1000) / 1000,
      schranke,
    };
    console.log(`${d.padEnd(20)} spielMedian=${disziplinen[d].spielMedian.toFixed(3)}  spannweite=${disziplinen[d].spielSpannweite.toFixed(3)}  schranke=${schranke.toFixed(3)}`);
  }

  if (MISCHUNG_NEU) {
    const fehlerSeite = [];
    const ms = await oeffneSpurtMischungsSeite(browser, SEITE, kaderFamilie[0], { formModus: "echt", fehler: fehlerSeite });
    const anteile = await spurtFormatAnteile(ms);
    if (Object.keys(anteile).length < 3) throw new Error("Spurt-Mischung: Formatwahl liefert keine Mischung " + JSON.stringify(anteile));
    const r = await messeSpurtMischungRho(ms, { n: SPIELE, kaderFamilie });
    zusatzmessungen = {};
    for (const [name, z] of [["spurt-mischung", r.mischung], ["spurt-klassisch", r.einzelformate.klassisch],
                             ["spurt-hatz", r.einzelformate.hatz], ["spurt-hyrox", r.einzelformate.hyrox]]) {
      if (z.fehler) throw new Error(`${name}: ${z.fehler}`);
      zusatzmessungen[name] = {
        formModus: "echt", spielMedian: rund3(z.spielMed), spielSpannweite: rund3(z.spielSpan),
        saisonMedian: rund3(z.saisonMed), saisonSpannweite: rund3(z.saisonSpan),
        schranke: rund3(Math.max(SCHRANKE_BODEN, SCHRANKE_ANTEIL * z.spielSpan)),
      };
      console.log(`${name.padEnd(20)} spielMedian=${zusatzmessungen[name].spielMedian.toFixed(3)}  spannweite=${zusatzmessungen[name].spielSpannweite.toFixed(3)}  schranke=${zusatzmessungen[name].schranke.toFixed(3)}  (Zusatzmessung, Kartenmodus echt)`);
    }
    zusatzmessungen["spurt-mischung"].formatAnteile = anteile;
  }
} finally {
  await browser.close();
}
if (!zusatzmessungen && existsSync(ZIEL)) zusatzmessungen = JSON.parse(readFileSync(ZIEL, "utf8")).zusatzmessungen ?? null;

// NUR "spurt-mischung" verlangt: die zwanzig Disziplinen der Datei bleiben unangetastet, nur der
// Zusatzblock wird ersetzt (kein Totalueberschreiben wie bei einer Disziplinliste, s. Kopfkommentar).
if (NUR_ROH.length && !NUR.length) {
  const alt = JSON.parse(readFileSync(ZIEL, "utf8"));
  alt.zusatzmessungen = zusatzmessungen;
  alt.zusatzmessungenGemessenAm = new Date().toISOString();
  writeFileSync(ZIEL, JSON.stringify(alt, null, 1));
  console.log(`\nZusatzblock geschrieben (Disziplinen unveraendert): ${ZIEL}`);
  process.exit(0);
}

const basislinie = {
  hinweis:
    "Kaderfeste Rho-Basislinie (docs/design/messgrundlage-kaderfest.md). schranke ist der " +
    "groesste erlaubte Rueckgang von spielMedian, bevor scripts/pruefe-rangtreue-schranke.mjs " +
    "die CI rot macht — max(0.05, 0.3*spielSpannweite), s. Kopfkommentar dieses Skripts. Neu " +
    "bauen mit: node scripts/baue-rangtreue-basislinie.mjs [spiele]",
  gemessenAm: new Date().toISOString(),
  spiele: SPIELE,
  kaderFamilieQuelle: kaderQuelle,
  disziplinen,
  ...(zusatzmessungen ? { zusatzmessungen, zusatzmessungenGemessenAm: new Date().toISOString() } : {}),
};
writeFileSync(ZIEL, JSON.stringify(basislinie, null, 1));
console.log(`\nGeschrieben: ${ZIEL}`);
