// K3-PROTOTYP-SONDE (climbing-kontakt-konzept-14-10.md) — DISPOSABLE, nicht Teil der
// staendigen CI-Kette. Misst rho kaderfest (Kader-Familie, Median/Spannweite) fuer Climbing,
// wie scripts/miss-climbing-zweiter-saatstamm.mjs, aber mit einem vierten Aufrufwert fuer
// einen ALTERNATIVEN battle-mode.html-Pfad (Vorbild: scripts/messe-arena-einfluss.mjs, dessen
// Pfad-Ueberschreibung schon fuer dieselbe Aufgabe existiert, hier aber fuer den Kader-
// familien-Pfad in disziplinProbe() fehlte).
//
// Zweck: den in climbing-kontakt-konzept-14-10.md Anhang A beschriebenen Kontakt-Patch
// (Kreuzungsgriffe, Herunterziehen, Wehren) GEGEN EINE DISPOSABLE KOPIE von
// battle-mode.engine.js zu messen, ohne die Produktionsdatei zu beruehren:
//
//   cp -r public/mockups /pfad/zur/kopie
//   <Anhang-A-Patch auf /pfad/zur/kopie/battle-mode.engine.js anwenden>
//   node scripts/miss-climbing-kontakt-prototyp-rho.mjs 24 1337 7919 /pfad/zur/kopie/battle-mode.html
//   node scripts/miss-climbing-kontakt-prototyp-rho.mjs 24 424242 6089 /pfad/zur/kopie/battle-mode.html
//
// CLAUDE.md verlangt rho > 0,80 in ZWEI unabhaengigen Saatstroemen -- die zweite Zeile ist
// deshalb kein Zufall, sondern Pflicht, genauso wie bei jeder anderen Disziplin-Kalibrierung.
// Ohne vierten Aufrufwert zeigt das Skript auf die PRODUKTIONSDATEI (identisch zu
// miss-climbing-zweiter-saatstamm.mjs) -- harmlos, aber dann misst man keinen Kontakt-Patch.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
import { ladeKaderFamilieAusDatei, auswerten, median, spannweite } from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE
  || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const SPIELE = Number(process.argv[2] || 24);
const SAAT0 = Number(process.argv[3] || 1337);
const SCHRITT = Number(process.argv[4] || 7919);
const HTML_PFAD = process.argv[5]
  ? path.resolve(process.argv[5])
  : path.join(WURZEL, "public/mockups/battle-mode.html");
const SEITE = pathToFileURL(HTML_PFAD).href;

const { familie, quelle } = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
console.log(`K3-Kontakt-Prototyp — Datei: ${HTML_PFAD}`);
console.log(`saat0=${SAAT0} schritt=${SCHRITT} — ${SPIELE} Spiele je Paarung, Kader: ${quelle}`);

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
try {
  const seite = await browser.newPage();
  const fehler = [];
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.disziplinProbe, null, { timeout: 30000 });
  const x = await seite.evaluate(
    ([n, fam, saat0, schritt]) => window.__arena.disziplinProbe("climbing", { n, kaderFamilie: fam, saat0, schritt }),
    [SPIELE, familie, SAAT0, SCHRITT],
  );
  if (x.fehler) { console.error("Fehler:", x.fehler); process.exit(1); }
  if (fehler.length) { console.error("Seitenfehler:", fehler); process.exit(1); }
  const ausw = x.varianten.map((v) => ({ label: v.label, ...auswerten(v.spiele) }));
  const spielMed = median(ausw.map((v) => v.spiel)), spielSpan = spannweite(ausw.map((v) => v.spiel));
  const saisonMed = median(ausw.map((v) => v.saison)), saisonSpan = spannweite(ausw.map((v) => v.saison));
  console.log(`rho je Spiel (Median): ${spielMed.toFixed(3)}  (Spannweite ${spielSpan.toFixed(3)})`);
  console.log(`rho Saison (Median):   ${saisonMed.toFixed(3)}  (Spannweite ${saisonSpan.toFixed(3)})`);
  console.log("je Paarung:", ausw.map((v) => `${v.label}: ${v.spiel.toFixed(3)}`).join(" | "));
  console.log(spielMed > 0.80 ? "BESTANDEN (> 0,80)" : "DURCHGEFALLEN (<= 0,80)");
} finally {
  await browser.close();
}
