// ===================================================================================
// DIE RHO-SCHRANKE — misst alle Disziplinen aus data/generated/rangtreue-basislinie.json
// kaderfest nach und schlaegt fehl, wenn eine Disziplin um mehr als ihre Schranke gefallen ist.
//
// Vorher (docs/design/projekt-ueberwachung-opus.md, Abschnitt 3.1 B, 4.1): 1008 Testdateien und
// keine einzige, die rho prueft. Drei ehrliche Hockey-Berichte ergaben zusammen eine unehrliche
// Bilanz (0,670 -> 0,612 -> 0,617 -> 0,647), weil jeder sich nur gegen den letzten Zwischenstand
// verglich, nicht gegen den Tagesanfang. Dieses Skript ist die fehlende Instanz, die gegen die
// Basislinie misst statt gegen den letzten Commit.
//
// Aufruf (s. .github/workflows/ci-nightly.yml, Job "rangtreue-schranke"):
//   node scripts/pruefe-rangtreue-schranke.mjs
//
// Exit-Code 0: keine Disziplin ist um mehr als ihre Schranke gefallen (Verbesserungen sind
// immer erlaubt). Exit-Code 1: mindestens eine ist es — die Tabelle nennt welche und um wie viel.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { disziplinMessen, ladeKaderFamilieAusDatei, baueSynthetischeKaderFamilie } from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE
  || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const BASISLINIE_PFAD = process.env.OLY_RANGTREUE_BASISLINIE
  || path.join(WURZEL, "data/generated/rangtreue-basislinie.json");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

if (!existsSync(BASISLINIE_PFAD)) {
  console.error(`Keine Basislinie unter ${BASISLINIE_PFAD} — erst mit scripts/baue-rangtreue-basislinie.mjs bauen.`);
  process.exit(1);
}
const basislinie = JSON.parse(readFileSync(BASISLINIE_PFAD, "utf8"));
const disziplinIds = Object.keys(basislinie.disziplinen);

let kaderFamilie;
const geladen = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
if (geladen) kaderFamilie = geladen.familie;

// try/finally: ein abgestuerzter Browser darf keinen Chromium-Prozess hinterlassen (s.
// derselbe Kommentar in miss-alle-disziplinen.mjs).
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
let rot = false;
const zeilen = [];
try {
  const seite = await browser.newPage();
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.disziplinProbe, null, { timeout: 30000 });

  if (!kaderFamilie) {
    console.log("Achtung: keine live-save-Kaderfamilie gefunden, messe mit dem synthetischen Ausweichkader.");
    const gebaut = await baueSynthetischeKaderFamilie(seite);
    kaderFamilie = gebaut.familie;
  }

  for (const d of disziplinIds) {
    const basis = basislinie.disziplinen[d];
    const z = await disziplinMessen(seite, d, { n: basislinie.spiele, kaderFamilie });
    if (z.fehler) {
      zeilen.push({ d, fehler: z.fehler });
      rot = true;
      continue;
    }
    const rueckgang = basis.spielMedian - z.spielMed; // positiv = gefallen, negativ = gestiegen
    const gefallen = rueckgang > basis.schranke;
    if (gefallen) rot = true;
    zeilen.push({ d, basis: basis.spielMedian, jetzt: z.spielMed, rueckgang, schranke: basis.schranke, gefallen });
  }
} finally {
  await browser.close();
}

console.log(`Rho-Schranke — Basislinie vom ${basislinie.gemessenAm}, ${basislinie.spiele} Spiele je Kader-Variante\n`);
console.log("Disziplin            Basislinie      Jetzt   Aenderung   Schranke   Status");
for (const z of zeilen) {
  if (z.fehler) { console.log(z.d.padEnd(20) + "— " + z.fehler); continue; }
  const status = z.gefallen ? "GEFALLEN" : "ok";
  // Auf drei Nachkommastellen runden VOR dem Vorzeichen-Check, sonst zeigt Floating-Point-
  // Rauschen unterhalb der Anzeigegenauigkeit ein irrefuehrendes "-0.000".
  const aenderungGerundet = Math.round(-z.rueckgang * 1000) / 1000 + 0;
  const vorzeichen = aenderungGerundet > 0 ? "+" : aenderungGerundet < 0 ? "-" : "±";
  const aenderungText = vorzeichen + Math.abs(aenderungGerundet).toFixed(3);
  console.log(z.d.padEnd(20)
    + z.basis.toFixed(3).padStart(11)
    + z.jetzt.toFixed(3).padStart(11)
    + aenderungText.padStart(12)
    + z.schranke.toFixed(3).padStart(11) + "   " + status);
}

if (rot) {
  console.log("\nFEHLGESCHLAGEN: mindestens eine Disziplin ist um mehr als ihre Schranke gefallen (oder");
  console.log("liefert keine Spiele mehr). Basislinie neu ziehen nur, wenn der Rueckgang gewollt ist:");
  console.log("node scripts/baue-rangtreue-basislinie.mjs");
  process.exit(1);
}
console.log("\nBestanden: keine Disziplin ist um mehr als ihre Schranke gefallen.");
