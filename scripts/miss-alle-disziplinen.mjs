// ===================================================================================
// DER STAND ALLER ZWANZIG DISZIPLINEN — eine Tabelle, eine Zahl je Disziplin.
//
// Chris' Frage: "welche sind quasi spielreif?" Bis hierher war das eine Meinung. Fuer das
// Feldspiel gab es eine Sonde, fuer Buehne, Bahn und Arena keine — 16 von 20 Disziplinen
// hatten ueberhaupt keine Rangtreue-Zahl.
//
// Gemessen wird die Abnahmezahl des Projekts (s. CLAUDE.md): rho zwischen der Eignung
// eines Teilnehmers und dem, was er im Spiel bewirkt. EINMAL ueber die Saison gemittelt
// (die Validitaet: belohnt die Mechanik ueberhaupt das Richtige?) und einmal je EINZELNEM
// Spiel (die Zahl, die zaehlt — pro Saison kommt jede Disziplin nur ein paar Mal dran).
//
// KADERFEST SEIT 03.09.2026 (docs/design/messgrundlage-kaderfest.md, Ausloeser
// docs/design/projekt-ueberwachung-opus.md Abschnitt 1.3): dieses Skript mass bis dahin
// IMMER denselben 17-Spieler-Testkader in derselben Paarung (den hartkodierten SQUAD/OPP in
// battle-mode.engine.js). Das wirkte wie eine einzelne Zahl, war aber eine EINZIGE Ziehung
// aus einer Verteilung — Opus hat nachgewiesen, dass allein der Kaderwechsel bei gleicher
// Mechanik rho um bis zu 0,73 (TDM) bewegt. Seit hier misst dieses Skript ueber eine
// KADER-FAMILIE (mehrere feste, unterschiedliche Team-Paarungen desselben Spielstands) und
// gibt MEDIAN und SPANNWEITE statt einer einzelnen Zahl aus — das ist die Zahl, an der sich
// erkennen laesst, ob eine kuenftige Rezeptaenderung real etwas bewegt hat oder innerhalb des
// Kaderrauschens verschwindet.
//
// Kader-Quelle, in Prioritaet:
//   1. data/generated/kaderfamilie-live-save.json — fuenf ECHTE Team-Paarungen aus dem
//      aktuellen live-save-Abbild (s. scripts/ziehe-kader-familie.ts). Bevorzugt: echte
//      Attributverteilungen einer echten Liga statt einer erfundenen Mischung.
//   2. Fehlt die Datei (z.B. frischer Checkout ohne live-save-Zugriff), faellt das Skript auf
//      SYNTHETISCHE Kader zurueck: dieselben 17 Spieler aus dem hartkodierten SQUAD/OPP,
//      deterministisch in vier weitere 8-gegen-8-Aufteilungen gemischt (genau die Methode aus
//      dem Opus-Anhang). Das ist ausdruecklich ein KOMPROMISS fuer den Fall ohne
//      Save-Zugriff, keine Verbesserung gegenueber Quelle 1 — die Tabelle sagt, welche Quelle
//      gerade lief.
//
//   node scripts/miss-alle-disziplinen.mjs [spiele] [disziplin ...]
//   node scripts/miss-alle-disziplinen.mjs [spiele] [disziplin ...] --einzelkader
//
// Ohne Disziplinliste laufen alle zwanzig. Das dauert; mit einer Liste misst man gezielt.
// `--einzelkader` schaltet auf das alte Verhalten zurueck (ein einziger Kader, eine Zahl je
// Disziplin) — fuer einen schnellen Einzelcheck, NICHT fuer eine Abnahme- oder CI-Zahl.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
import { disziplinMessen, ladeKaderFamilieAusDatei, baueSynthetischeKaderFamilie } from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE
  || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const roheArgs = process.argv.slice(2);
const EINZELKADER = roheArgs.includes("--einzelkader");
// --je-seite=N: faehrt die kaderfeste Messung mit einer anderen Kadergroesse je Seite
// (2/4/6 ...), zusaetzlich zur Kader-FAMILIE (fuenf Team-Paarungen). Additiv, ohne diesen
// Schalter unveraendertes Verhalten — noetig fuer die Gewichtheben-Abnahme "rho >= 0,80 bei
// 6, 4 UND 2 je Seite" (Plan 8.1), jetzt mit Median+Spannweite statt Einzelkader.
const jeSeiteArg = roheArgs.find((a) => a.startsWith("--je-seite="));
const JE_SEITE = jeSeiteArg ? Number(jeSeiteArg.split("=")[1]) : null;
const rest = roheArgs.filter((a) => a !== "--einzelkader" && !a.startsWith("--je-seite="));
const SPIELE = Number(rest[0] || 24);
const NUR = rest.slice(1);

let kaderQuelle, kaderFamilie;
if (!EINZELKADER) {
  const geladen = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
  if (geladen) { kaderFamilie = geladen.familie; kaderQuelle = geladen.quelle; }
}

// try/finally: ein abgestuerzter Browser (page.goto/evaluate wirft) darf keinen Chromium-
// Prozess hinterlassen — sonst sammeln sich Zombie-Prozesse an, die dem naechsten Lauf den
// Speicher/die Festplatte wegnehmen (selbst beobachtet: ein abgebrochener Lauf ohne diesen
// Block liess fuenf Chromium-Kindprozesse zurueck).
const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
let zeilen, fehler = [];
try {
  const seite = await browser.newPage();
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.disziplinProbe, null, { timeout: 30000 });

  if (!EINZELKADER && !kaderFamilie) {
    const gebaut = await baueSynthetischeKaderFamilie(seite);
    kaderFamilie = gebaut.familie;
    kaderQuelle = gebaut.quelle + " (Kopfkommentar dieses Skripts erklaert, wann das greift)";
  }

  const alleDisz = NUR.length ? NUR : await seite.evaluate(() => window.__arena.motoren());

  zeilen = [];
  for (const d of alleDisz) {
    zeilen.push(await disziplinMessen(seite, d, {
      n: SPIELE, kaderFamilie: EINZELKADER ? null : kaderFamilie,
      ...(JE_SEITE ? { jeSeite: JE_SEITE } : {}),
    }));
  }
} finally {
  await browser.close();
}

const titel = EINZELKADER
  ? `Rangtreue aller Disziplinen — ${SPIELE} Spiele je Disziplin, EIN Kader (--einzelkader, nicht abnahmefaehig)`
  : `Rangtreue aller Disziplinen — ${SPIELE} Spiele je Kader-Variante, ${kaderFamilie.length} Varianten je Disziplin\nKader-Quelle: ${kaderQuelle}`;
console.log(titel + "\n");
console.log("Disziplin           Chassis     Teiln.  rho je Spiel (Median)  Spannweite  rho Saison (Median)  Spannweite   Abnahme");
for (const z of zeilen.sort((a, b) => (b.spielMed ?? -9) - (a.spielMed ?? -9))) {
  if (z.fehler) { console.log(z.d.padEnd(20) + "— " + z.fehler); continue; }
  const ok = z.spielMed >= 0.80 ? "bestanden" : z.spielMed >= 0.70 ? "knapp" : "durchgefallen";
  console.log(z.d.padEnd(20) + (z.chassis || "").padEnd(12)
    + String(z.teilnehmer).padStart(5)
    + z.spielMed.toFixed(3).padStart(23) + z.spielSpan.toFixed(3).padStart(12)
    + z.saisonMed.toFixed(3).padStart(21) + z.saisonSpan.toFixed(3).padStart(12)
    + "   " + ok);
  // FELDSPIELER-ONLY (Fable-Recherche 1.1/3.1): nur ausgefuellt, wenn die Disziplin eine
  // Rolle mit eigener, andersartiger Wertformel kennt (heute nur Hockeys Torwart) — die
  // Zwoelfer-Zahl oben bleibt die, gegen die pruefe-rangtreue-schranke.mjs misst (das reale
  // Spiel FELDET den Torwart mit), diese Zeile ist die ehrlichere Frage "belohnt die
  // Feldspieler-Mechanik das Richtige?", s. docs/design/stand-aller-disziplinen.md.
  if (z.spielMedFeld != null) {
    const okFeld = z.spielMedFeld >= 0.80 ? "bestanden" : z.spielMedFeld >= 0.70 ? "knapp" : "durchgefallen";
    console.log("  davon nur Feldspieler".padEnd(32)
      + String(z.teilnehmerFeld).padStart(5)
      + z.spielMedFeld.toFixed(3).padStart(23) + z.spielSpanFeld.toFixed(3).padStart(12)
      + z.saisonMedFeld.toFixed(3).padStart(21) + z.saisonSpanFeld.toFixed(3).padStart(12)
      + "   " + okFeld);
  }
}
console.log("\nSchranke: rho je Spiel (Median ueber die Kader-Familie) ueber 0,80 (CLAUDE.md, gilt fuer alle Disziplinen).");
if (!EINZELKADER) {
  console.log("Spannweite = Kaderrauschen bei UNVERAENDERTER Mechanik — eine Rezeptaenderung, die kleiner");
  console.log("bewegt als die Spannweite einer Disziplin, ist von Null nicht unterscheidbar (s.");
  console.log("docs/design/messgrundlage-kaderfest.md).");
}
console.log("Seitenfehler: " + (fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"));
