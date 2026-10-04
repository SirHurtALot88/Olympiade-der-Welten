// ===================================================================================
// H5 (docs/design/hockey-opus-review-nhl.md Abschnitt 3.3/6, Task #34, 02.10.) — SWEEP
// des Verhaeltnisses in `u.punkte*HK_TOR_GEWICHT.punkte+u.xg*HK_TOR_GEWICHT.xg`
// (feldspielWert, Hockey-Feldspielerzweig). Aktuell 1,5/1,5 — nie gegen Alternativen
// gemessen, nur "ganz statt halb" (0,649, schlechter).
//
// "Weder 1,5/1,5 noch irgendein anderes Verhaeltnis wurde gegen Alternativen
// durchgemessen [...] Ein Sweep ueber das Verhaeltnis (etwa 1,0/2,0 und 2,0/1,0) ist
// billig, ohne rr()-Risiko und ohne Rezeptberuehrung [...] Erwartung ehrlich: klein."
//
// Faehrt dieselbe Kader-feste Methode wie miss-alle-disziplinen.mjs (disziplinProbe,
// Median/Spannweite ueber die Kader-Familie), einmal je Verhaeltnis aus der Liste unten.
// Der Erwartungswert einer Torchance bleibt bei JEDEM Verhaeltnis mit punkte+xg=3,0
// identisch (ein Schuss mit pTor p, der reingeht, zaehlt p_punkte+p*p_xg im Mittel
// 1*p_punkte+p*p_xg — s. Kommentar an der Konstante im Motor); nur die STREUUNG
// zwischen "binaer" (3,0/0) und "rein erwartet" (0/3,0) aendert sich.
//
// window.__arena.hockeyTorGewicht(r) stellt die Konstante NUR fuer die laufende Messung
// um (MESSHEBEL-Muster wie mutatorRegel/ATTR_HEBUNG) — die Spielkonstante in
// battle-mode.engine.js aendert sich dadurch nicht; eine Variante wird erst dann in den
// Code uebernommen, wenn dieses Skript sie als klar besser ausweist.
//
//   node scripts/miss-hockey-tor-gewicht-sweep.mjs [spiele] [--mutatoren=je-spiel|aus|fest] [--einzelkader]
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  auswerten, median, spannweite, ohneTorwart,
  ladeKaderFamilieAusDatei, baueSynthetischeKaderFamilie,
} from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE
  || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const roheArgs = process.argv.slice(2);
const EINZELKADER = roheArgs.includes("--einzelkader");
const mutatorenArg = roheArgs.find((a) => a.startsWith("--mutatoren="));
const MUTATOREN = mutatorenArg ? mutatorenArg.split("=")[1] : null;
const rest = roheArgs.filter((a) => a !== "--einzelkader" && !a.startsWith("--mutatoren="));
const SPIELE = Number(rest[0] || 48);

// Die fuenf Verhaeltnisse aus dem Auftrag, alle mit punkte+xg=3,0 (derselbe
// Erwartungswert einer Torchance wie die bisherige Konstante, s. Kopfkommentar).
const VARIANTEN = [
  { label: "1,0 / 2,0", punkte: 1.0, xg: 2.0 },
  { label: "1,25 / 1,75", punkte: 1.25, xg: 1.75 },
  { label: "1,5 / 1,5 (aktuell)", punkte: 1.5, xg: 1.5 },
  { label: "1,75 / 1,25", punkte: 1.75, xg: 1.25 },
  { label: "2,0 / 1,0", punkte: 2.0, xg: 1.0 },
];

let kaderQuelle, kaderFamilie;
if (!EINZELKADER) {
  const geladen = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
  if (geladen) { kaderFamilie = geladen.familie; kaderQuelle = geladen.quelle; }
}

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const ergebnisse = [];
let fehler = [];
try {
  const seite = await browser.newPage();
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.disziplinProbe && window.__arena.hockeyTorGewicht, null, { timeout: 30000 });

  if (!EINZELKADER && !kaderFamilie) {
    const gebaut = await baueSynthetischeKaderFamilie(seite);
    kaderFamilie = gebaut.familie;
    kaderQuelle = gebaut.quelle + " (Kopfkommentar dieses Skripts erklaert, wann das greift)";
  }

  for (const v of VARIANTEN) {
    // MESSHEBEL setzen, Lauf fahren, IMMER zuruecksetzen (finally) — sonst bluete die
    // letzte Variante in jeden folgenden Aufruf hinein (dasselbe Muster wie
    // disziplinProbe selbst mit MUTATOREN/mutatorenVorher).
    await seite.evaluate(([p, x]) => window.__arena.hockeyTorGewicht({ punkte: p, xg: x }), [v.punkte, v.xg]);
    let x;
    try {
      x = await seite.evaluate(
        ([n, familie, mut]) => window.__arena.disziplinProbe("hockey", {
          n, ...(familie ? { kaderFamilie: familie } : {}), ...(mut ? { mutatoren: mut } : {}),
        }),
        [SPIELE, EINZELKADER ? null : kaderFamilie, MUTATOREN],
      );
    } finally {
      await seite.evaluate(() => window.__arena.hockeyTorGewicht(null));
    }
    if (x.fehler) { ergebnisse.push({ ...v, fehler: x.fehler }); continue; }
    const gruppen = x.varianten ? x.varianten : [{ label: null, spiele: x.spiele }];
    const auswAlle = gruppen.map((g) => ({ label: g.label, ...auswerten(g.spiele) })).filter((r) => !Number.isNaN(r.spiel));
    const auswFeld = gruppen.map((g) => ({ label: g.label, ...auswerten(ohneTorwart(g.spiele)) })).filter((r) => !Number.isNaN(r.spiel));
    ergebnisse.push({
      ...v,
      alleMed: median(auswAlle.map((r) => r.spiel)), alleSpan: spannweite(auswAlle.map((r) => r.spiel)),
      alleSaisonMed: median(auswAlle.map((r) => r.saison)),
      feldMed: median(auswFeld.map((r) => r.spiel)), feldSpan: spannweite(auswFeld.map((r) => r.spiel)),
      feldSaisonMed: median(auswFeld.map((r) => r.saison)),
    });
  }
} finally {
  await browser.close();
}

const titel = EINZELKADER
  ? `H5 — Hockey punkte/xg-Sweep — ${SPIELE} Spiele, EIN Kader (--einzelkader, nicht abnahmefaehig)`
  : `H5 — Hockey punkte/xg-Sweep — ${SPIELE} Spiele je Kader-Variante, ${kaderFamilie.length} Varianten\nKader-Quelle: ${kaderQuelle}`;
console.log(titel + (MUTATOREN ? `\nMutatoren: ${MUTATOREN}` : " (Mutatoren: Engine-Standard \"je-spiel\")") + "\n");
console.log("Verhaeltnis         rho alle12 (Med)  Spannw.  Saison   |  rho Feldsp. (Med)  Spannw.  Saison");
for (const e of ergebnisse) {
  if (e.fehler) { console.log(e.label.padEnd(20) + "— " + e.fehler); continue; }
  console.log(
    e.label.padEnd(20)
    + e.alleMed.toFixed(3).padStart(17) + e.alleSpan.toFixed(3).padStart(9) + e.alleSaisonMed.toFixed(3).padStart(9)
    + "   |" + e.feldMed.toFixed(3).padStart(15) + e.feldSpan.toFixed(3).padStart(9) + e.feldSaisonMed.toFixed(3).padStart(9),
  );
}
console.log("\nSchranke: rho je Spiel (Median) ueber 0,80 (CLAUDE.md). Hockey ist NICHT in ARENA_RESOLVED_DISCIPLINE_IDS.");
console.log("Seitenfehler: " + (fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"));
