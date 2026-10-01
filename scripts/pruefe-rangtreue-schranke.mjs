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
// ZWEITER, ABSOLUTER WAECHTER (16.09., docs/pm-briefings/opus-plan-top-zehn-ueber-90-16-09.md
// Abschnitt 4, Auftrag B3): der Rueckgangs-Check oben ist RELATIV zur eigenen Basislinie und
// seine Schranke waechst mit der Kaderfest-Spannweite (max(0,05; 0,3 * spielSpannweite)) — bei
// verrauschten Disziplinen (Fechten, Gewichtheben, Tennis, Climbing: Spannweite ueber 0,2) darf
// rho dadurch bis zu 0,06 fallen, OHNE dass die CI rot wird. Das schuetzt nicht davor, dass eine
// arena-resolved Disziplin unbemerkt unter die absolute 0,80-Abnahmeschranke aus CLAUDE.md faellt
// ("Die Abnahme jeder Disziplin: ein Spiel, nicht eine Saison"). Der zweite Waechter unten prueft
// deshalb ZUSAETZLICH, unabhaengig von jeder Spannweite: faellt eine Disziplin, die als
// arena-resolved gilt (`ARENA_RESOLVED_DISCIPLINE_IDS`, lib/resolve/battle-mode-arena-team-
// points.ts — sie MUSS die Abnahme bestanden haben, um dort zu stehen) und NICHT ausdruecklich
// auf der Liste ABNAHME_OFFEN steht (01.10., s. dort; vorher still ueber "Basislinie >=0,80"),
// jetzt unter 0,80, ist das ein Fehlschlag — komplett unabhaengig davon, wie gross ihre
// Kaderfest-Spannweite ist und wo ihre Basislinie steht. Die Disziplinen auf ABNAHME_OFFEN
// meldet jeder Lauf in einem eigenen Info-Block mit ihrem aktuellen Wert. Der relative Waechter bleibt unveraendert daneben
// bestehen (er faengt schleichende Regression frueher als 0,80); dieser hier faengt Stufenbrueche
// unter die harte Abnahmeschranke, die der relative durchlassen wuerde.
//
// Zusaetzlich (Idee aus demselben Plan-Abschnitt, reine Info, kein CI-Abbruch): eine G1-
// Stufenwarnung nach der Scorecard-Methodik
// (docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md Abschnitt 0, Zeile
// "G1 (40)"): >=0,85 -> 40 Punkte, 0,80-0,85 -> 35, 0,70-0,80 -> 22, 0,50-0,70 -> 12, <0,50 -> 5.
// Faellt eine Disziplin (jede, nicht nur arena-resolved) von einer dieser Stufen in die naechst-
// tiefere, meldet das Skript eine Warnzeile — auch wenn der Rueckgang innerhalb der 0,80-Schranke
// bleibt (z. B. 0,86 -> 0,84 bleibt ueber 0,80, senkt aber die G1-Punktzahl der Scorecard um 5).
// Das ist nur ein Hinweis fuer den naechsten Scorecard-Nachtrag, kein Fehlschlag.
//
// Import von ARENA_RESOLVED_DISCIPLINE_IDS aus TypeScript ist der Grund, warum dieses Skript
// jetzt ueber die tsx-Loader-Registrierung laeuft statt ueber puren `node` (s. package.json
// "ci:rangtreue-schranke" und den Kommentar dort — derselbe `node --import tsx`-Kniff wie bei
// "project:audit-write-safety"). Ein reiner `node scripts/pruefe-rangtreue-schranke.mjs`-Aufruf
// schlaegt seither mit "Cannot find module '.../battle-mode-arena-team-points'" fehl (Node kann
// .ts ohne Loader weder aufloesen noch transpilieren); `node --import tsx
// scripts/pruefe-rangtreue-schranke.mjs` (oder `npm run ci:rangtreue-schranke`) ist der richtige
// Aufruf.
//
// Aufruf (s. .github/workflows/ci-nightly.yml, Job "rangtreue-schranke"):
//   npm run ci:rangtreue-schranke
//   (entspricht: node --import tsx scripts/pruefe-rangtreue-schranke.mjs)
//
// Exit-Code 0: keine Disziplin ist relativ um mehr als ihre Schranke gefallen UND keine
// arena-resolved Disziplin ausserhalb von ABNAHME_OFFEN liegt unter 0,80 (Verbesserungen sind
// immer erlaubt).
// Exit-Code 1: mindestens einer der beiden Waechter schlaegt an — die Tabelle nennt welche und
// um wie viel.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { disziplinMessen, ladeKaderFamilieAusDatei, baueSynthetischeKaderFamilie } from "./lib/rangtreue-messung.mjs";
import { ARENA_RESOLVED_DISCIPLINE_IDS } from "../lib/resolve/battle-mode-arena-team-points";

// Die harte Abnahmeschranke aus CLAUDE.md ("Die Abnahme jeder Disziplin: ein Spiel, nicht eine
// Saison") — rho kaderfest in EINEM Spiel, Ziel > 0,80.
const SCHRANKE_ABSOLUT = 0.80;

// ABNAHME OFFEN (01.10.) — arena-resolved Disziplinen, die die 0,80-Schranke BEKANNTERMASSEN noch
// nicht erfuellen und deshalb vom absoluten Waechter ausgenommen sind. Vorher geschah diese
// Ausnahme STILL: der absolute Waechter griff nur, wenn die Basislinie selbst >=0,80 stand
// (`bisherBestanden`). Jede Disziplin, deren Basislinie unter 0,80 neu gezogen wurde, fiel damit
// unbemerkt aus dem Sicherheitsnetz — bei Climbing (Basislinie 01.10. unter 0,80) waere genau das
// passiert. Jetzt gilt umgekehrt: arena-resolved UND unter 0,80 UND NICHT auf dieser Liste ist
// rot, egal wo die Basislinie steht. Wer hier einen Eintrag ergaenzt, schreibt den Grund und den
// Verweis dazu; wer eine Disziplin ueber 0,80 hebt, nimmt sie wieder herunter (das Skript meldet
// das unten von selbst). Der RELATIVE Waechter gilt fuer diese Disziplinen unveraendert weiter.
const ABNAHME_OFFEN = new Map([
  ["basketball", "unter 0,80, von Chris fuer den Live-Betrieb abgenommen — "
    + "docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md (Basketball, Gameplay)"],
  ["hockey", "unter 0,80, Abnahme ueber Star-/Paartreue statt nackter rho — "
    + "docs/design/hockey-opus-review-nhl.md Abschnitt 5.3, CLAUDE.md"],
  // "climbing" HIER ENTFERNT (Kalibrierrunde 01.10.): das Validitaetsproblem aus dem
  // Gegencheck/Mutator (0,814 ohne, 0,791 mit Mutator) ist behoben — `tempoSpanne`
  // 0,80 -> 2,20 (s. BAHN_ART.climbing in battle-mode.engine.js fuer die volle
  // Herleitung/Messung), rho je Spiel jetzt 0,828-0,856 ueber vier unabhaengige
  // Saatstroeme MIT Mutator (Mittel 0,839), Pp 14,2/11,1 ueber zwei Saatstroeme.
  // Basislinie-Eintrag fuer "climbing" in rangtreue-basislinie.json von HAND nachgezogen,
  // NICHT ueber `baue-rangtreue-basislinie.mjs 24 climbing` -- dessen eigener
  // Kopfkommentar warnt, dass ein Aufruf mit einer Disziplinliste die GANZE Datei
  // ueberschreibt (nur die genannten Disziplinen landen im Ergebnis), nicht nur eine
  // Zeile. Ein echter Lauf damit haette die Basislinien der uebrigen 19 Disziplinen
  // geloescht.
]);

// G1-Stufen der Scorecard-Methodik (docs/design/gesamtstand-fertigstellungsgrad-alle-
// disziplinen-09-10.md Abschnitt 0, Zeile "G1 (40)"), absteigend sortiert.
const G1_STUFEN = [
  { schwelle: 0.85, label: "≥0,85", punkte: 40 },
  { schwelle: 0.80, label: "0,80–0,85", punkte: 35 },
  { schwelle: 0.70, label: "0,70–0,80", punkte: 22 },
  { schwelle: 0.50, label: "0,50–0,70", punkte: 12 },
  { schwelle: -Infinity, label: "<0,50", punkte: 5 },
];
function g1Stufe(rhoWert) {
  return G1_STUFEN.find((s) => rhoWert >= s.schwelle) ?? G1_STUFEN[G1_STUFEN.length - 1];
}

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

    // ABSOLUTER WAECHTER (s. Kopfkommentar): jede arena-resolved Disziplin unter 0,80 ist rot —
    // AUSSER sie steht ausdruecklich auf ABNAHME_OFFEN (oben). Bis 01.10. hing die Ausnahme still
    // an `bisherBestanden` (Basislinie >=0,80); das ist ersetzt durch die sichtbare Liste, damit
    // ein Neuziehen der Basislinie niemanden mehr unbemerkt aus dem Sicherheitsnetz nimmt.
    const arenaResolved = ARENA_RESOLVED_DISCIPLINE_IDS.has(d);
    const abnahmeOffen = ABNAHME_OFFEN.has(d);
    const jetztBestanden = z.spielMed >= SCHRANKE_ABSOLUT;
    const absolutGerissen = arenaResolved && !abnahmeOffen && !jetztBestanden;
    if (absolutGerissen) rot = true;

    // G1-STUFENWARNUNG (Info, kein CI-Abbruch): fuer ALLE Disziplinen der Basislinie, nicht nur
    // arena-resolved — die Scorecard fuehrt G1 fuer jede der zwanzig.
    const stufeVorher = g1Stufe(basis.spielMedian);
    const stufeJetzt = g1Stufe(z.spielMed);
    const stufeGefallen = stufeJetzt.punkte < stufeVorher.punkte;

    zeilen.push({
      d, basis: basis.spielMedian, jetzt: z.spielMed, rueckgang, schranke: basis.schranke, gefallen,
      arenaResolved, abnahmeOffen, jetztBestanden, absolutGerissen, stufeVorher, stufeJetzt, stufeGefallen,
    });
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

// ZWEITER WAECHTER: absolute 0,80-Schranke aus CLAUDE.md, unabhaengig von jeder Kaderfest-
// Spannweite. Eigener Abschnitt, damit ein Treffer hier nicht in der Rueckgangs-Tabelle oben
// untergeht — genau die Faelle, die der relative Waechter durchlassen wuerde.
const absoluteVerstoesse = zeilen.filter((z) => !z.fehler && z.absolutGerissen);
console.log("\nAbsolute 0,80-Schranke (arena-resolved Disziplinen, CLAUDE.md \"Die Abnahme jeder");
console.log("Disziplin\") — unabhaengig von der Kaderfest-Spannweite der relativen Pruefung oben:");
if (absoluteVerstoesse.length) {
  for (const z of absoluteVerstoesse) {
    console.log(`  GERISSEN: ${z.d} — arena-resolved, nicht auf ABNAHME_OFFEN, jetzt ${z.jetzt.toFixed(3)} `
      + `(<0,80; Basislinie ${z.basis.toFixed(3)})`);
  }
} else {
  console.log("  ok — keine arena-resolved Disziplin ausserhalb von ABNAHME_OFFEN liegt unter 0,80.");
}

// ABNAHME OFFEN: in JEDEM Lauf ausgeben, nicht nur bei Treffern — damit die bekannten Ausnahmen
// nicht dadurch in Vergessenheit geraten, dass die CI gruen ist.
console.log("\nAbnahme offen (vom absoluten Waechter ausgenommen, s. ABNAHME_OFFEN in diesem Skript)");
console.log("— Info, kein CI-Abbruch; der relative Waechter gilt fuer sie weiter:");
for (const [d, notiz] of ABNAHME_OFFEN) {
  const z = zeilen.find((zeile) => zeile.d === d);
  let wert;
  if (!z) wert = "nicht in der Basislinie";
  else if (z.fehler) wert = `Messfehler: ${z.fehler}`;
  else wert = `rho ${z.jetzt.toFixed(3)} (Basislinie ${z.basis.toFixed(3)})`;
  console.log(`  ${d.padEnd(12)} ${wert}`);
  console.log(`  ${"".padEnd(12)} ${notiz}`);
  if (z && !z.fehler && z.jetztBestanden) {
    console.log(`  ${"".padEnd(12)} HINWEIS: liegt jetzt >=0,80 — kann von ABNAHME_OFFEN genommen werden.`);
  }
  if (!ARENA_RESOLVED_DISCIPLINE_IDS.has(d)) {
    console.log(`  ${"".padEnd(12)} HINWEIS: nicht arena-resolved — der Eintrag hat keine Wirkung.`);
  }
}

// G1-STUFENWARNUNG: reine Information fuer den naechsten Scorecard-Nachtrag, kein Fehlschlag.
const stufenWarnungen = zeilen.filter((z) => !z.fehler && z.stufeGefallen);
if (stufenWarnungen.length) {
  console.log("\nG1-Stufenwarnung (Scorecard-Methodik, docs/design/gesamtstand-fertigstellungsgrad-");
  console.log("alle-disziplinen-09-10.md Abschnitt 0) — Info, kein CI-Abbruch:");
  for (const z of stufenWarnungen) {
    console.log(`  ${z.d}: G1-Stufe "${z.stufeVorher.label}" (${z.stufeVorher.punkte} Pkt) -> `
      + `"${z.stufeJetzt.label}" (${z.stufeJetzt.punkte} Pkt), rho ${z.basis.toFixed(3)} -> ${z.jetzt.toFixed(3)}`);
  }
}

if (rot) {
  console.log("\nFEHLGESCHLAGEN: mindestens eine Disziplin ist um mehr als ihre Schranke gefallen,");
  console.log("liefert keine Spiele mehr, oder eine arena-resolved Disziplin ausserhalb von");
  console.log("ABNAHME_OFFEN liegt unter der absoluten 0,80-Schranke. Basislinie neu ziehen nur, wenn");
  console.log("ein relativer Rueckgang gewollt ist: node scripts/baue-rangtreue-basislinie.mjs");
  console.log("(das Neuziehen heilt den absoluten Waechter NICHT — dafuer braucht es einen begruendeten");
  console.log("Eintrag in ABNAHME_OFFEN oder eine Kalibrierung ueber 0,80).");
  process.exit(1);
}
console.log("\nBestanden: keine Disziplin ist um mehr als ihre Schranke gefallen, und keine");
console.log("arena-resolved Disziplin ausserhalb von ABNAHME_OFFEN liegt unter 0,80.");
