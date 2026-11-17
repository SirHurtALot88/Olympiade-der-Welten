// ===================================================================================
// SPURT-MISCHUNG — Rangtreue (und optional Pp) des Spurts so, wie das Spiel ihn SPIELT:
// Format je Saat per Hash (klassisch / "Die Hatz" / HYROX), s. spurtFormatWaehlen() in
// battle-mode.engine.js (PR #1502). Die kader-losen Messwerkzeuge (miss-alle-disziplinen,
// pruefe-wertung-fingerabdruck, die CI-Schranke fuer "spurt") laufen immer "klassisch"; die
// Einzelformat-Skripte (miss-spurt-hatz/-hyrox-rangtreue, messe-spurt-*-einfluss) setzen das
// Format ausdruecklich. Diese Sonde misst die echte Mischung: sie haengt einen Kader ein
// (haengeEchtenKaderEin, vor dem Laden der Seite) und setzt KEIN Format.
//
//   node scripts/miss-spurt-mischung.mjs [spiele=24] [--pp[=laeufe]] [--je-format] [--json]
//   OLY_FORM_MODUS=echt   (Standard dieses Skripts, wie die Abnahmezahlen in disziplin-abnahme.json;
//                          OLY_FORM_MODUS=aus misst mit der Ersatzkarte)
//
//   --je-format   zusaetzlich klassisch/Hatz/HYROX einzeln (ausdruecklich gesetzt, Gegenprobe). Die
//                 "klassisch"-Zeile muss der Spurt-Zahl in disziplin-abnahme.json entsprechen.
//   --pp[=N]      zusaetzlich die Pp-Abweichung (einflussVon, MISCHUNG) in zwei Saatstroemen (0 und
//                 10 000 000), je N Laeufe (Standard 48). LANGSAM (mehrere Minuten, mit echten
//                 Karten) -- deshalb nur manuell, nicht in der CI (docs/design/spurt-ci-schutz-16-11.md).
//   --json        eine einzige JSON-Zeile mit den Zahlen auf stdout (fuer Skripte/Nachtlauf).
//
// Schranken (CLAUDE.md): rho je Spiel mindestens 0,75 (harte Mindestschranke, Chris 17.11.), Ziel
// > 0,80, angestrebt 0,85; Pp <= 25 in beiden Stroemen.
// Die rho-Zahlen (Mischung + drei Einzelformate) schuetzt zusaetzlich die Nacht-CI:
// scripts/pruefe-rangtreue-schranke.mjs, Abschnitt "Spurt-Mischung".
// ===================================================================================
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  ladeKaderFamilieAusDatei, oeffneSpurtMischungsSeite, spurtFormatAnteile, messeSpurtMischungRho,
  rhoAbnahmeLabel,
} from "./lib/rangtreue-messung.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITE = pathToFileURL(process.env.OLY_SEITE
  ? path.resolve(process.env.OLY_SEITE)
  : path.join(WURZEL, "public/mockups/battle-mode.html")).href;
const KADERFAMILIE_PFAD = process.env.OLY_KADER_FAMILIE
  || path.join(WURZEL, "data/generated/kaderfamilie-live-save.json");
const fest = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const FORM_MODUS = process.env.OLY_FORM_MODUS || "echt";

const args = process.argv.slice(2);
const schalter = args.filter((a) => a.startsWith("--"));
const SPIELE = Number(args.find((a) => !a.startsWith("--")) || 24);
const PP = schalter.find((a) => a === "--pp" || a.startsWith("--pp="));
const PP_LAEUFE = PP && PP.includes("=") ? Number(PP.split("=")[1]) : 48;
const JE_FORMAT = schalter.includes("--je-format");
const JSON_AUS = schalter.includes("--json");

const geladen = ladeKaderFamilieAusDatei(KADERFAMILIE_PFAD);
if (!geladen) {
  console.error("Keine Kader-Familie (data/generated/kaderfamilie-live-save.json / OLY_KADER_FAMILIE) -- die Mischungs-Sonde braucht einen echten Kader.");
  process.exit(1);
}
const { familie: kaderFamilie, quelle: kaderQuelle } = geladen;

const browser = await chromium.launch(existsSync(fest) ? { executablePath: fest } : {});
const fehler = [];
const ergebnis = { spiele: SPIELE, formModus: FORM_MODUS, kaderVarianten: kaderFamilie.length, kaderQuelle };
const zeile = (z) => (z.fehler ? { fehler: z.fehler } : {
  teilnehmer: z.teilnehmer, rhoJeSpiel: z.spielMed, spannweite: z.spielSpan, rhoSaison: z.saisonMed, saisonSpannweite: z.saisonSpan,
});
try {
  const seite = await oeffneSpurtMischungsSeite(browser, SEITE, kaderFamilie[0], { formModus: FORM_MODUS, fehler });
  ergebnis.formatAnteile = await spurtFormatAnteile(seite);
  if (Object.keys(ergebnis.formatAnteile).length < 3) {
    console.error("Formatwahl liefert keine Mischung: " + JSON.stringify(ergebnis.formatAnteile) + " -- Kader nicht eingehaengt?");
    process.exitCode = 2;
  }
  const r = await messeSpurtMischungRho(seite, {
    n: SPIELE, kaderFamilie, jeFormat: JE_FORMAT,
    nachMischung: PP ? async (s) => {
      ergebnis.pp = [];
      ergebnis.ppLaeufe = PP_LAEUFE;
      for (const versatz of [0, 10000000]) {
        const e = await s.evaluate(([n, v]) => {
          const st = window.setTimeout; window.setTimeout = () => 0;
          try { return window.__arena.einflussVon("spurt", n, undefined, v); } finally { window.setTimeout = st; }
        }, [PP_LAEUFE, versatz]);
        ergebnis.pp.push({ saatVersatz: versatz, abweichungPp: e.abweichungPp });
      }
    } : null,
  });
  ergebnis.mischung = zeile(r.mischung);
  ergebnis.einzelformate = Object.fromEntries(Object.entries(r.einzelformate).map(([k, z]) => [k, zeile(z)]));
} finally {
  await browser.close();
}
ergebnis.seitenfehler = fehler.length;

if (JSON_AUS) {
  console.log(JSON.stringify(ergebnis));
} else {
  const ok = rhoAbnahmeLabel;
  console.log(`Spurt-MISCHUNG (Format je Saat per Hash) — ${SPIELE} Spiele je Kader-Variante, ${ergebnis.kaderVarianten} Varianten, Kartenmodus ${FORM_MODUS}`);
  console.log(`Kader-Quelle: ${kaderQuelle}`);
  console.log(`Formatwahl ueber Saaten 1..300: ${JSON.stringify(ergebnis.formatAnteile)}\n`);
  console.log("Format       Teiln.  rho je Spiel (Median)  Spannweite  rho Saison (Median)  Spannweite   Abnahme");
  for (const [label, z] of [["mischung", ergebnis.mischung], ...Object.entries(ergebnis.einzelformate)]) {
    if (z.fehler) { console.log(label.padEnd(12) + "— " + z.fehler); continue; }
    console.log(label.padEnd(12) + String(z.teilnehmer).padStart(5)
      + z.rhoJeSpiel.toFixed(3).padStart(23) + z.spannweite.toFixed(3).padStart(12)
      + z.rhoSaison.toFixed(3).padStart(21) + z.saisonSpannweite.toFixed(3).padStart(12) + "   " + ok(z.rhoJeSpiel));
  }
  if (ergebnis.pp) {
    console.log(`\nPp-Abweichung zur Matrix (${ergebnis.ppLaeufe} Laeufe je Strom, Mischung): `
      + ergebnis.pp.map((p) => `${p.abweichungPp} (Versatz ${p.saatVersatz})`).join("  /  ")
      + "   Schranke <= 25, Optimum < 15");
  }
  console.log("\nSchranke: rho je Spiel (Median ueber die Kader-Familie) mindestens 0,75, Ziel ueber 0,80, angestrebt 0,85 (CLAUDE.md).");
  console.log("Seitenfehler: " + (fehler.length ? fehler.slice(0, 3).join(" | ") : "keine"));
}
