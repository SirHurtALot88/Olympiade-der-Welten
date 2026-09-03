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
// Ohne Disziplinliste laufen alle zwanzig. Ueberschreibt data/generated/rangtreue-basislinie.json
// komplett — ein gezieltes Neuziehen nur weniger Disziplinen bitte per Hand in die bestehende
// Datei einpflegen, sonst verliert man die Zahlen der anderen.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { disziplinMessen, ladeKaderFamilieAusDatei, baueSynthetischeKaderFamilie } from "./lib/rangtreue-messung.mjs";

const SCHRANKE_BODEN = 0.05;
const SCHRANKE_ANTEIL = 0.3;

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE
  || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const ZIEL = path.join(WURZEL, "data/generated/rangtreue-basislinie.json");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const SPIELE = Number(process.argv[2] || 24);
const NUR = process.argv.slice(3);

let kaderFamilie, kaderQuelle;
const geladen = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
if (geladen) { kaderFamilie = geladen.familie; kaderQuelle = geladen.quelle; }

// try/finally: ein abgestuerzter Browser darf keinen Chromium-Prozess hinterlassen (s.
// derselbe Kommentar in miss-alle-disziplinen.mjs).
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const disziplinen = {};
try {
  const seite = await browser.newPage();
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.disziplinProbe, null, { timeout: 30000 });

  if (!kaderFamilie) {
    const gebaut = await baueSynthetischeKaderFamilie(seite);
    kaderFamilie = gebaut.familie;
    kaderQuelle = gebaut.quelle;
  }

  const alleDisz = NUR.length ? NUR : await seite.evaluate(() => window.__arena.motoren());

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
} finally {
  await browser.close();
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
};
writeFileSync(ZIEL, JSON.stringify(basislinie, null, 1));
console.log(`\nGeschrieben: ${ZIEL}`);
