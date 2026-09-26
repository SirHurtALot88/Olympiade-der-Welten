// Zweiter, unabhaengiger Saatstamm fuer die Climbing-PR-2-Abnahme (CLAUDE.md: rho>0,80 UND
// Pp<=25 je in ZWEI unabhaengigen Saatstroemen). miss-alle-disziplinen.mjs ruft
// disziplinProbe() immer mit saat0=1337/schritt=7919 (dem eingebauten Default) auf und
// bietet keinen CLI-Schalter dafuer -- dieses Skript ist dieselbe kaderfeste Methode
// (Kader-Familie, Median/Spannweite ueber fuenf Paarungen), nur mit einem zweiten,
// unabhaengigen (saat0, schritt)-Paar. Wegwerf-Werkzeug fuer diese PR, nicht Teil der
// staendigen CI-Kette.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
import { ladeKaderFamilieAusDatei, auswerten, median, spannweite } from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE
  || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const SPIELE = Number(process.argv[2] || 24);
const SAAT0 = Number(process.argv[3] || 424242);
const SCHRITT = Number(process.argv[4] || 6089);

const { familie, quelle } = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
console.log(`Zweiter Saatstamm — saat0=${SAAT0} schritt=${SCHRITT} — ${SPIELE} Spiele je Paarung, Kader: ${quelle}`);

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
try {
  const seite = await browser.newPage();
  await seite.goto(SEITE, { waitUntil: "load" });
  await seite.waitForFunction(() => window.__arena && window.__arena.disziplinProbe, { timeout: 20000 });
  const x = await seite.evaluate(
    ([n, fam, saat0, schritt]) => window.__arena.disziplinProbe("climbing", { n, kaderFamilie: fam, saat0, schritt }),
    [SPIELE, familie, SAAT0, SCHRITT],
  );
  if (x.fehler) { console.error("Fehler:", x.fehler); process.exit(1); }
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
