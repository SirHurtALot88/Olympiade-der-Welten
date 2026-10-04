// ===================================================================================
// H4 (docs/design/hockey-opus-review-nhl.md Abschnitt 4.4/6, Task #34, 02.10.) — RANGTREUE
// JE SLOT-GRUPPE, reine Messung, keine Code-Aenderung am Spiel.
//
// "Die Analytik vergleicht Verteidiger mit Verteidigern, nicht mit Stuermern [...] Unser
// Motor hat dafuer ein direktes Gegenstueck [...] Eine Rangtreue-Zeile je Slot-Gruppe waere
// der natuerliche naechste Split — dieselbe Bauform wie feldOnlyZusatz(), nur nach slotId
// statt nach torwart. Reine Messung, null Motorrisiko, und sie beantwortet die Frage, die
// heute niemand stellt: ordnet die Mechanik innerhalb einer Rolle richtig, oder ordnet sie
// nur Rollen?"
//
// DREI GRUPPEN: Verteidiger (slotId "defensivewall"), Stuermer (die anderen vier Feld-Slots:
// powerforward/playmaker/transition/slotfinisher) und Torwart (u.torwart, die ECHTE
// Rollen-Identitaet aus bestimmeTorwaerter() — nicht slotId "goaltender", weil ohne gesetzte
// Aufstellung ohnehin der PARADE-Ruecfall entscheidet, s. CLAUDE.md/Review 4.3a). Dieselbe
// kaderfeste Methode (Median/Spannweite ueber die Kader-Familie) wie miss-alle-disziplinen.mjs,
// derselbe disziplinProbe()-Pfad, nur mit dem zusaetzlichen `slotId`-Feld ausgewertet.
//
// NEBENBEFUND-SCHALTER: `--mutatoren=je-spiel|aus|fest` wie in miss-alle-disziplinen.mjs.
// Default "je-spiel" (die Engine-Vorgabe von disziplinProbe, s. dort) ist der REALISTISCHE
// Wert — jedes Spiel zieht seinen eigenen Spieltagswurf, wie im echten Spiel. "aus" misst ohne
// jeden Mutator-Einfluss (die Vergleichsbasis fuer die 0,719-Feldspieler-Zahl aus dem Opus-
// Review, die VOR dem Mutator-Nachtrag vom 29.09. entstand). ACHTUNG: `feldspielProbe()` (das
// Werkzeug hinter miss-feldspiel-rangtreue.mjs/miss-rangtreue-nach-rolle.mjs) hat DIESEN
// Schalter bis heute NICHT — es zieht MUTATOREN nie neu und erbt stattdessen den zuletzt im
// Seiten-Kontext geladenen, FESTEN Mutator-Wurf fuer die gesamte Spieleserie. Deshalb baut
// dieses Skript auf disziplinProbe() auf, nicht auf feldspielProbe() (s. Kopfkommentar von
// scripts/miss-rangtreue-nach-rolle.mjs fuer den Unterschied) — Details und der Befund dazu
// stehen in docs/design/hockey-h4-h5-messung-02-10.md Abschnitt 3.
//
//   node scripts/miss-hockey-rangtreue-je-rolle.mjs [spiele] [--mutatoren=je-spiel|aus|fest] [--einzelkader]
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  auswerten, median, spannweite, nurRolle, hatTorwart, ohneTorwart, gepoolteSaisonRho,
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

let kaderQuelle, kaderFamilie;
if (!EINZELKADER) {
  const geladen = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
  if (geladen) { kaderFamilie = geladen.familie; kaderQuelle = geladen.quelle; }
}

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
let x, fehler = [];
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

  x = await seite.evaluate(
    ([n, familie, mut]) => window.__arena.disziplinProbe("hockey", {
      n, ...(familie ? { kaderFamilie: familie } : {}), ...(mut ? { mutatoren: mut } : {}),
    }),
    [SPIELE, EINZELKADER ? null : kaderFamilie, MUTATOREN],
  );
} finally {
  await browser.close();
}

if (x.fehler) { console.error("disziplinProbe(hockey) Fehler: " + x.fehler); process.exit(1); }

const gruppen = x.varianten ? x.varianten : [{ label: null, spiele: x.spiele }];

function zeile(bezeichnung, spieleListe) {
  const ausw = gruppen.map((g, i) => ({ label: g.label, ...auswerten(spieleListe(g)) }))
    .filter((v) => !Number.isNaN(v.spiel));
  if (!ausw.length) return { bezeichnung, fehler: "keine auswertbaren Spiele (< 3 Teilnehmer je Spiel?)" };
  return {
    bezeichnung,
    spielMed: median(ausw.map((v) => v.spiel)), spielSpan: spannweite(ausw.map((v) => v.spiel)),
    saisonMed: median(ausw.map((v) => v.saison)), saisonSpan: spannweite(ausw.map((v) => v.saison)),
    teilnehmer: Math.round(ausw.reduce((a, v) => a + v.teilnehmer, 0) / ausw.length),
  };
}

const zeilen = [
  zeile("alle 12", (g) => g.spiele),
  zeile("Feldspieler (ohne Torwart)", (g) => ohneTorwart(g.spiele)),
  zeile("Stuermer (powerforward/playmaker/transition/slotfinisher)", (g) => nurRolle(g.spiele, "stuermer")),
];

const titel = EINZELKADER
  ? `H4 — Hockey-Rangtreue je Slot-Gruppe — ${SPIELE} Spiele, EIN Kader (--einzelkader, nicht abnahmefaehig)`
  : `H4 — Hockey-Rangtreue je Slot-Gruppe — ${SPIELE} Spiele je Kader-Variante, ${gruppen.length} Varianten\nKader-Quelle: ${kaderQuelle}`;
console.log(titel + (MUTATOREN ? `\nMutatoren: ${MUTATOREN}` : " (Mutatoren: Engine-Standard \"je-spiel\")") + "\n");
console.log("Gruppen mit >=3 Teilnehmern je Spiel — rho je Spiel ist hier definiert:");
console.log("Gruppe                                                      Teiln.  rho je Spiel (Med)  Spannweite  rho Saison (Med)  Spannweite");
for (const z of zeilen) {
  if (z.fehler) { console.log(z.bezeichnung.padEnd(60) + "— " + z.fehler); continue; }
  console.log(
    z.bezeichnung.padEnd(60) + String(z.teilnehmer).padStart(5)
    + z.spielMed.toFixed(3).padStart(21) + z.spielSpan.toFixed(3).padStart(12)
    + z.saisonMed.toFixed(3).padStart(19) + z.saisonSpan.toFixed(3).padStart(12),
  );
}

// STRUKTURELLE GRENZE, GEFUNDEN BEIM BAUEN DIESES SKRIPTS: Verteidiger (slotId
// "defensivewall") UND der echte Torwart (u.torwart) stellen je Seite GENAU EINEN Platz.
// Zwei Teilnehmer je Spiel (einer je Seite) lassen keine Rangtreue INNERHALB eines
// einzelnen Spiels zu (Spearman braucht n>=3) — "rho je Spiel" ist fuer eine Ein-Mann-
// Gruppe schlicht nicht definiert, unabhaengig von der Spielzahl. Das ist dieselbe Grenze,
// die Abschnitt 5 des Opus-Reviews fuer den Torwart beschreibt ("Torwart-Varianz [ist] ein
// reales Eishockey-Phaenomen"), hier aber erstmals auch fuer den Slot "defensivewall"
// explizit nachgewiesen. Ausweg: gepoolt ueber die ganze Kader-Familie (alle distincten
// Spieler aller Paarungen, saisonaggregiert) IST die Frage beantwortbar — nur eben nicht
// "je Spiel", sondern nur auf Saison-Ebene.
console.log("\nGruppen mit nur EINEM Platz je Seite — rho je Spiel ist strukturell nicht definiert (n=2 < 3 je Spiel),");
console.log("hier stattdessen die gepoolte Saison-Rangtreue ueber ALLE Paarungen der Kader-Familie zusammen:");
const vertPool = gepoolteSaisonRho(gruppen, (g) => nurRolle(g.spiele, "verteidiger"));
const twPool = gepoolteSaisonRho(gruppen, (g) => nurRolle(g.spiele, "torwart"));
console.log(`Verteidiger (slotId defensivewall)   n=${vertPool.n.toString().padStart(3)}  rho (gepoolte Saison) = ${Number.isNaN(vertPool.rho) ? "—" : vertPool.rho.toFixed(3)}`);
console.log(`Torwart (u.torwart)                  n=${twPool.n.toString().padStart(3)}  rho (gepoolte Saison) = ${Number.isNaN(twPool.rho) ? "—" : twPool.rho.toFixed(3)}`);

console.log("\nSchranke: rho je Spiel (Median ueber die Kader-Familie) ueber 0,80 (CLAUDE.md) — nur fuer die obere Tabelle anwendbar.");
console.log("Hockey selbst ist NICHT in ARENA_RESOLVED_DISCIPLINE_IDS — diese Zahl ist Diagnose, keine Produktions-Abnahme.");
console.log("Seitenfehler: " + (fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"));
