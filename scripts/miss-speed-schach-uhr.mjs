// ===================================================================================
// SPEED-SCHACH „DIE UHR WIRD DER DRITTE SPIELER" — die Brett-Kennzahlen der Stufen 1/2.
//
// docs/design/speed-schach-nachtkonzept-03-10.md, Tabellen 5.1/5.2: rho und Pp allein sagen
// nicht, ob die Uhr etwas erzaehlt. Dieses Skript misst die Groessen, an denen das Konzept
// steht oder faellt — am ECHTEN Motor, kaderfest ueber die Kader-Familie (wie
// miss-alle-disziplinen.mjs), mit den Mechaniken hinter BUEHNE_FLAGS:
//
//   - geflaggt / Zeitnot (je Spieler)
//   - Brett auf Zeit entschieden, davon GEGEN den Vorteil (Botez-Hansen, Zielband 1-5 %)
//   - 3:3-Quote, Heim/Gast/Remis (gewonnene Bretter, dieselbe Zaehlung wie spieleBuehneDuell())
//   - Ansage-Verteilung (Stufe 2) und rho je Spiel (Median ueber die Familie)
//
//   node scripts/miss-speed-schach-uhr.mjs [spiele] --flags=speedSchachUhr:2 [--haltung-heim=rechnen] [--haltung-gast=ki] [--je-seite=N]
//
// Ohne --flags misst es den heutigen Motor (Uhr aus) — dann sind alle Uhr-Spalten 0.
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  ladeKaderFamilieAusDatei, auswerten, median, IST_BUEHNE_SCHALTER, buehneSchalterAusArgs,
  setzeBuehneSchalter, buehneSchalterText,
} from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE
  || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const args = process.argv.slice(2);
const SCHALTER = buehneSchalterAusArgs(args);
const jeSeiteArg = args.find((a) => a.startsWith("--je-seite="));
const JE_SEITE = jeSeiteArg ? Number(jeSeiteArg.split("=")[1]) : null;
const rest = args.filter((a) => !IST_BUEHNE_SCHALTER(a) && !a.startsWith("--je-seite="));
const SPIELE = Number(rest[0] || 24);

const geladen = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
if (!geladen) { console.error("Kader-Familie fehlt: " + KADERFAMILIE_PFAD); process.exit(1); }

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
let x, gesetzt, fehler = [];
try {
  const seite = await browser.newPage();
  seite.on("pageerror", (e) => fehler.push(String(e)));
  await seite.goto(SEITE, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => window.__arena && window.__arena.disziplinProbe, null, { timeout: 30000 });
  gesetzt = await setzeBuehneSchalter(seite, SCHALTER);
  x = await seite.evaluate(([n, familie, js]) => window.__arena.disziplinProbe("speed-schach",
    { n, kaderFamilie: familie, buehneDiag: true, ...(js ? { jeSeite: js } : {}) }),
  [SPIELE, geladen.familie, JE_SEITE]);
} finally {
  await browser.close();
}
if (x.fehler) { console.error(x.fehler); process.exit(1); }

const z = { spiele: 0, bretter: 0, spieler: 0, geflaggt: 0, zeitnot: 0, zeitBrett: 0, gegen: 0, kippt: 0,
  beideGeflaggt: 0, remisBrett: 0, dreiDrei: 0, heim: 0, gast: 0, unent: 0, ansage: {} };
const rhoJe = [];
for (const v of x.varianten) {
  rhoJe.push(auswerten(v.spiele).spiel);
  for (const sp of v.spiele) {
    const b = sp.buehne; if (!b || !b.bretter) continue;
    z.spiele++;
    const [h, g] = b.seiten;
    if (h > g) z.heim++; else if (g > h) z.gast++; else z.unent++;
    if (h === 3 && g === 3) z.dreiDrei++;
    for (const br of b.bretter) {
      z.bretter++; z.spieler += 2;
      z.geflaggt += (br.fa ? 1 : 0) + (br.fb ? 1 : 0);
      z.zeitnot += (br.zeitnotA ? 1 : 0) + (br.zeitnotB ? 1 : 0);
      if (br.fa && br.fb) z.beideGeflaggt++;
      if (br.zeitSieg != null) z.zeitBrett++;
      if (br.gegen) z.gegen++;
      if (br.kippt) z.kippt++;
      if (!br.sa && !br.sb) z.remisBrett++;
      for (const a of [br.ansageA, br.ansageB]) if (a) z.ansage[a] = (z.ansage[a] || 0) + 1;
    }
  }
}
const pz = (a, b) => (100 * a / Math.max(1, b)).toFixed(1).padStart(5) + " %";
console.log(`Speed-Schach-Uhr — ${SPIELE} Spiele je Kader-Variante, ${x.varianten.length} Varianten`
  + (JE_SEITE ? `, ${JE_SEITE} je Seite` : ""));
console.log(`Kader-Quelle: ${geladen.quelle}`);
console.log(gesetzt ? buehneSchalterText(gesetzt) : "Buehnen-Flags: alle aus (heutiger Motor)");
console.log("");
console.log(`rho je Spiel (Median ueber Familie)      ${median(rhoJe).toFixed(3)}   [${rhoJe.map((r) => r.toFixed(3)).join(" ")}]`);
console.log(`Spieler geflaggt                         ${pz(z.geflaggt, z.spieler)}   (${z.geflaggt}/${z.spieler})`);
console.log(`Spieler in Zeitnot (<30 s)               ${pz(z.zeitnot, z.spieler)}`);
console.log(`Bretter auf Zeit entschieden             ${pz(z.zeitBrett, z.bretter)}   (${z.zeitBrett}/${z.bretter})`);
console.log(`  davon GEGEN den Vorteil (Sieger hinten) ${pz(z.gegen, z.bretter)}   (${z.gegen})`);
console.log(`  Ergebnis gekippt (Sieger <= 0)         ${pz(z.kippt, z.bretter)}`);
console.log(`Bretter mit beiden geflaggt              ${pz(z.beideGeflaggt, z.bretter)}`);
console.log(`Remis-Bretter                            ${pz(z.remisBrett, z.bretter)}`);
console.log(`Mannschaftskampf 3:3                     ${pz(z.dreiDrei, z.spiele)}`);
console.log(`Heim / Gast / unentschieden              ${pz(z.heim, z.spiele)} / ${pz(z.gast, z.spiele)} / ${pz(z.unent, z.spiele)}`);
const anz = Object.values(z.ansage).reduce((a, b) => a + b, 0);
if (anz) console.log(`Ansagen                                  ` + ["rechnen", "normal", "blitzen"]
  .map((a) => `${a} ${pz(z.ansage[a] || 0, anz)}`).join(" · "));
console.log("Seitenfehler: " + (fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"));
