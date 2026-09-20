// ===================================================================================
// M1 — DER PREIS DER AUFSTELLUNG (PM-Plan, docs/pm-briefings/projektmanager-plan-kampfmodell-
// umsetzung-20-09.md, Abschnitt 3.3).
//
// BEFUND, DER DIESE SONDE NOETIG MACHT: die Kader-Familie fuehrt kein `place`
// (data/generated/kaderfamilie-live-save.json wie -arena-erweitert.json: je Spieler nur
// {n,c,r,sub,tp,tn,d,groesse,a}) — jede bisherige Rangtreue-Zahl der Arena misst deshalb die
// MOTOREIGENE Optimalaufstellung (SLOT_ZUSATZ, battle-mode.engine.js:5042-5065), nie eine
// menschliche Entscheidung. Die 0,80-Schranke wurde also nie gegen Aufstellungs-Autorschaft
// geprueft. Dieses Skript misst genau das, kaderfest auf der M0-Familie
// (data/generated/kaderfamilie-arena-erweitert.json, 16 disjunkte Paarungen), in drei
// Stufungen (scripts/lib/aufstellungs-stufungen.ts):
//   1. motoroptimal        — Kontrolle, entspricht dem heutigen Standardverhalten.
//   2. menschlich-plausibel — eine defensible, aber nicht optimale Managerentscheidung.
//   3. absichtlich-schlecht — Star nach hinten, Bollwerk auf die Flanke.
//
// GETRIEBEN WIRD DER BESTEHENDE WEG, NICHT EIN NEUER: `baueAufstellungFuerHeim()`
// (scripts/lib/aufstellungs-stufungen.ts) ruft `buildArenaAufstellungBeide()`
// (lib/foundation/battle-arena/arena-aufstellung-adapter.ts) mit einem synthetischen
// LineupDraft auf — derselbe Adapter, den auch `lib/battle/arena-headless-runner.ts` fuer
// echte Spieltage aufruft. Das Ergebnis (`{name: {d,slot}}`) geht unveraendert ueber
// `window.__olyArenaKader.aufstellung` in den Motor, GENAUSO wie der Headless-Runner es tut
// (dieselbe Bruecke, dieselbe Wiedereinhaenge-Technik fuer mehrere Kader in einer
// Browser-Sitzung — s. `haengeAufstellungNeuEin()` unten, Kopie des Musters aus
// `arena-headless-runner.ts::simuliereFixturesImBrowser`, nicht neu erfunden).
//
// NICHTS AM MOTOR GEAENDERT: `battle-mode.engine.js` wird an keiner Stelle angefasst. Die
// Sonde nutzt ausschliesslich `window.__olyArenaKader` (bestehende Bruecke) und
// `window.__arena.disziplinProbe()` (bestehende Sonde fuer alle zwanzig Disziplinen) —
// beide existieren unveraendert seit vor dieser PR. `node scripts/miss-alle-disziplinen.mjs
// 24` bleibt deshalb bit-identisch (s. PR-Beschreibung fuer den Vorher/Nachher-Diff).
//
// GAST BLEIBT KONSTANT (s. Kopfkommentar in aufstellungs-stufungen.ts): im Arena-Chassis
// wirkt `place` fuer die Gastseite ohnehin nur auf die Auswahl, nicht auf den Slot — die
// Sonde setzt deshalb NUR fuer die Heimseite eine Stufung und laesst die Gastseite in allen
// drei Laeufen unveraendert (kein `place`-Eintrag, wie im heutigen Standardfall). Damit
// isoliert die Messung genau EINE Variable: die Autorschaft der eigenen Aufstellung.
//
// AUSGABEFORMAT ABSICHTLICH WIE `miss-alle-disziplinen.mjs`: Median/Spannweite/rho-Saison
// UND (M0-Bootstrap) Median-Unsicherheit kommen aus DENSELBEN Funktionen
// (scripts/lib/rangtreue-messung.mjs) — numerisch vergleichbar, kein zweites Zahlenformat.
// Auflage aus der PM-Planung: dieses Sondengeruest erbt A1.0 als "Variante P" (Konvergenz
// §4) — die Trennung in aufstellungs-stufungen.ts (reine Dateneinheit) und dieses Skript
// (Mess-Orchestrierung) ist genau dafuer gedacht.
//
// Aufruf:
//   npx tsx scripts/miss-preis-der-aufstellung.ts [spiele] [disziplin ...]
// Ohne Disziplinliste laufen tdm, mini-dm UND battlefield (die einzigen drei, fuer die die
// M0-Familie gezogen wurde).
// ===================================================================================
import { chromium, type Browser, type Page } from "playwright";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  auswerten,
  median,
  spannweite,
  bootstrapMedianUnsicherheit,
} from "./lib/rangtreue-messung.mjs";
import {
  ARENA_STUFUNG_DISZIPLINEN,
  AUFSTELLUNGS_STUFUNGEN,
  JE_SEITE,
  baueStufung,
  baueAufstellungFuerHeim,
  type ArenaStufungDisziplin,
  type AufstellungsStufung,
} from "./lib/aufstellungs-stufungen";
import type { ArenaSpieler } from "@/lib/foundation/battle-arena/arena-kader-adapter";
import type { ArenaAufstellung } from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SEITEN_PFAD = path.join(WURZEL, "public/mockups/battle-mode.html");
const KADERFAMILIE_PFAD = path.join(WURZEL, "data/generated/kaderfamilie-arena-erweitert.json");
const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
// Dieselbe Netzwerk-Abriegelung wie arena-headless-runner.ts (s. dortiger Kommentar) — ohne
// sie haengt Chromium in dieser Proxy-Allowlist-Umgebung an Google-/Fonts-Requests fest.
const ARENA_NETZWERK_ABRIEGELUNG_ARGS = ["--proxy-server=direct://", "--host-resolver-rules=MAP * 0.0.0.0"];

const argv = process.argv.slice(2);
const numerischeArgs = argv.filter((a) => /^\d+$/.test(a));
const disziplinArgs = argv.filter((a) => !/^\d+$/.test(a)) as ArenaStufungDisziplin[];
const SPIELE = numerischeArgs.length ? Number(numerischeArgs[0]) : 24;
const DISZIPLINEN: ArenaStufungDisziplin[] = disziplinArgs.length ? disziplinArgs : ARENA_STUFUNG_DISZIPLINEN;

type Paarung = { label: string; heimName: string; gastName: string; heim: ArenaSpieler[]; gast: ArenaSpieler[] };

function ladePaarungen(): { paarungen: Paarung[]; quelle: unknown } {
  if (!existsSync(KADERFAMILIE_PFAD)) {
    throw new Error(
      `M0-Kaderfamilie fehlt (${KADERFAMILIE_PFAD}). Erst ziehen: npx tsx scripts/ziehe-kader-familie.ts --arena-erweitert ` +
        `(braucht ein live-save-Abbild, s. CLAUDE.md "An die Spielstaende kommen").`,
    );
  }
  const roh = JSON.parse(readFileSync(KADERFAMILIE_PFAD, "utf8"));
  return { paarungen: roh.varianten, quelle: roh.quelle };
}

type RoherBrowserSpiel = { saat: number; teilnehmer: Array<{ n: string; seite: number; eig: number; wert: number; reihe?: number }> };
type RoherBrowserErgebnis = { disziplin: string; chassis: string; spiele: RoherBrowserSpiel[] };

/**
 * Haengt Motor+Kader+Aufstellung neu ein — Kopie des Musters aus
 * `arena-headless-runner.ts::simuliereFixturesImBrowser` (`haengeMotorNeuEin`), NICHT neu
 * erfunden: alte `window.__arena`-Instanz verwerfen, `window.__olyArenaKader` setzen, ein
 * frisches `<script src="battle-mode.engine.js">` einhaengen, auf `window.__arena` warten.
 * Laeuft im Browser-Kontext (page.evaluate ueberträgt sie als Text) — deshalb keine
 * Closures aus Node.
 */
async function messeEineStufung(
  seite: Page,
  kader: { heim: ArenaSpieler[]; gast: ArenaSpieler[]; aufstellung: ArenaAufstellung },
  disc: string,
  n: number,
  timeoutMs: number,
): Promise<RoherBrowserErgebnis> {
  return seite.evaluate(
    async ({ kader, disc, n, timeoutMs }) => {
      const fenster = window as unknown as {
        __arena?: { disziplinProbe: (d: string, opt: { n: number }) => RoherBrowserErgebnis };
        __olyArenaKader?: unknown;
      };
      const wartenAufMotor = async () => {
        const start = Date.now();
        while (typeof fenster.__arena === "undefined") {
          if (Date.now() - start > timeoutMs) throw new Error("window.__arena wurde nicht rechtzeitig bereit.");
          await new Promise((r) => setTimeout(r, 20));
        }
      };
      fenster.__olyArenaKader = kader;
      delete fenster.__arena;
      document.querySelectorAll("script[data-oly-headless-engine]").forEach((el) => el.remove());
      const script = document.createElement("script");
      script.src = "battle-mode.engine.js";
      script.setAttribute("data-oly-headless-engine", "1");
      document.body.appendChild(script);
      await wartenAufMotor();
      if (!fenster.__arena) throw new Error("window.__arena fehlt nach Neu-Einhaengen.");
      return fenster.__arena.disziplinProbe(disc, { n });
    },
    { kader, disc, n, timeoutMs },
  );
}

type Zeile = {
  disc: ArenaStufungDisziplin;
  stufung: AufstellungsStufung;
  spielMed: number;
  spielSpan: number;
  saisonMed: number;
  saisonSpan: number;
  teilnehmer: number;
  varianten: Array<{ label: string; spiel: number; saison: number; teilnehmer: number }>;
};

async function main() {
  const { paarungen, quelle } = ladePaarungen();
  console.log(`M1 — Preis der Aufstellung: ${SPIELE} Spiele je Paarung, ${paarungen.length} Paarungen (M0-Kaderfamilie).`);
  console.log(`Kader-Quelle: ${JSON.stringify(quelle)}\n`);

  const launchOptions = existsSync(CHROMIUM_PFAD)
    ? { headless: true, executablePath: CHROMIUM_PFAD, args: ARENA_NETZWERK_ABRIEGELUNG_ARGS }
    : { headless: true, channel: "chromium" as const, args: ARENA_NETZWERK_ABRIEGELUNG_ARGS };
  const browser: Browser = await chromium.launch(launchOptions);
  const zeilen: Zeile[] = [];
  const fehler: string[] = [];
  try {
    const seite = await browser.newPage();
    seite.on("pageerror", (e) => fehler.push(String(e)));
    // TSX/ESBUILD-KOMPATIBILITAET — derselbe Shim wie arena-headless-runner.ts (s. dortiger
    // Kommentar): tsx transformiert jede Datei mit esbuilds `keepNames:true`, das schreibt
    // benannte Funktionen zu `__name(x,"x")`-Aufrufen um. `page.evaluate()` ueberträgt eine
    // Funktion nur als Text — der `__name`-Aufruf reist mit, die Definition nicht.
    await seite.addInitScript(() => {
      const fenster = window as unknown as { __name?: (fn: unknown, name?: string) => unknown };
      if (typeof fenster.__name !== "function") fenster.__name = (fn) => fn;
    });
    // Erstladung: irgendein valider Kader, damit die Seite ueberhaupt hochkommt (dieselbe
    // Bootstrap-Notwendigkeit wie arena-headless-runner.ts — window.__olyArenaKader muss beim
    // allerersten Laden bereits etwas Valides tragen).
    const ersteParung = paarungen[0];
    await seite.addInitScript(
      (kader) => {
        (window as unknown as { __olyArenaKader?: unknown }).__olyArenaKader = kader;
      },
      { heim: ersteParung.heim, gast: ersteParung.gast, aufstellung: {} },
    );
    await seite.goto(pathToFileURL(SEITEN_PFAD).href, { waitUntil: "networkidle" });
    await seite.waitForFunction(() => Boolean((window as unknown as { __arena?: unknown }).__arena), null, { timeout: 30000 });

    for (const disc of DISZIPLINEN) {
      for (const stufung of AUFSTELLUNGS_STUFUNGEN) {
        const varianten: Array<{ label: string; spiel: number; saison: number; teilnehmer: number }> = [];
        for (const paarung of paarungen) {
          const heimRoster = paarung.heim as ArenaSpieler[];
          const gastRoster = paarung.gast as ArenaSpieler[];
          if (heimRoster.length < JE_SEITE[disc]) {
            fehler.push(`${paarung.label}/${disc}: Heimkader zu klein (${heimRoster.length} < ${JE_SEITE[disc]}), uebersprungen.`);
            continue;
          }
          const geordnet = baueStufung(heimRoster, disc, stufung);
          const aufstellung = baueAufstellungFuerHeim(geordnet, disc);
          let roh: RoherBrowserErgebnis;
          try {
            roh = await messeEineStufung(seite, { heim: geordnet, gast: gastRoster, aufstellung }, disc, SPIELE, 30000);
          } catch (e) {
            fehler.push(`${paarung.label}/${disc}/${stufung}: ${String(e).slice(0, 120)}`);
            continue;
          }
          const ausgewertet = auswerten(roh.spiele);
          if (Number.isNaN(ausgewertet.spiel)) continue;
          varianten.push({ label: paarung.label, spiel: ausgewertet.spiel, saison: ausgewertet.saison, teilnehmer: ausgewertet.teilnehmer });
        }
        if (!varianten.length) {
          fehler.push(`${disc}/${stufung}: keine auswertbare Paarung.`);
          continue;
        }
        zeilen.push({
          disc,
          stufung,
          spielMed: median(varianten.map((v) => v.spiel)),
          spielSpan: spannweite(varianten.map((v) => v.spiel)),
          saisonMed: median(varianten.map((v) => v.saison)),
          saisonSpan: spannweite(varianten.map((v) => v.saison)),
          teilnehmer: Math.round(varianten.reduce((a, v) => a + v.teilnehmer, 0) / varianten.length),
          varianten,
        });
      }
    }
  } finally {
    await browser.close();
  }

  console.log("Disziplin       Stufung                Teiln.  rho je Spiel (Median)  Spannweite  rho Saison (Median)  Spannweite");
  for (const z of zeilen) {
    console.log(
      z.disc.padEnd(16) + z.stufung.padEnd(23) + String(z.teilnehmer).padStart(5) +
        z.spielMed.toFixed(3).padStart(23) + z.spielSpan.toFixed(3).padStart(12) +
        z.saisonMed.toFixed(3).padStart(21) + z.saisonSpan.toFixed(3).padStart(12),
    );
    const u = bootstrapMedianUnsicherheit(z.varianten.map((v) => v.spiel));
    console.log(
      `  Median-Unsicherheit (90%-Bootstrap-CI, ${u.n} Paarungen, ${u.wiederholungen} Ziehungen): ` +
        `Breite ${u.breite.toFixed(3)} [${u.unten.toFixed(3)}, ${u.oben.toFixed(3)}]`,
    );
  }

  console.log("\nDER PREIS DER AUFSTELLUNG (Spannweite Stufung 1 vs. Stufung 3, je Disziplin):");
  const bewegungsregelZeilen: string[] = [];
  for (const disc of DISZIPLINEN) {
    const opt = zeilen.find((z) => z.disc === disc && z.stufung === "motoroptimal");
    const schlecht = zeilen.find((z) => z.disc === disc && z.stufung === "absichtlich-schlecht");
    if (!opt || !schlecht) continue;
    const preis = opt.spielMed - schlecht.spielMed;
    // BEWEGUNGSREGEL (CLAUDE.md): eine Differenz zaehlt nur, wenn sie die Spannweite der
    // Kader-Familie selbst uebersteigt — hier die groessere der beiden verglichenen
    // Stufungs-Spannweiten, als Untergrenze fuer "innerhalb des Kaderrauschens".
    const eigeneSpannweite = Math.max(opt.spielSpan, schlecht.spielSpan);
    const bewegt = Math.abs(preis) > eigeneSpannweite;
    bewegungsregelZeilen.push(
      `  ${disc.padEnd(12)} motoroptimal ${opt.spielMed.toFixed(3)} - absichtlich-schlecht ${schlecht.spielMed.toFixed(3)} = ` +
        `${preis.toFixed(3)} (Kader-Spannweite ${eigeneSpannweite.toFixed(3)}) -> ` +
        (bewegt ? "ECHTER BEFUND, klart die Bewegungsregel-Schranke." : "NICHT von Kaderrauschen unterscheidbar."),
    );
  }
  console.log(bewegungsregelZeilen.join("\n"));
  console.log("\nHinweis: Tor A/B/C (Konvergenz §4) ist ohne Chris' Antwort auf Frage 2 nicht auswertbar — s. PM-Plan Abschnitt 3.3.");
  console.log("Seitenfehler: " + (fehler.length ? fehler.slice(0, 5).join(" | ") : "keine"));

  const ausgabePfad = path.join(WURZEL, "data/generated/preis-der-aufstellung-m1.json");
  writeFileSync(
    ausgabePfad,
    JSON.stringify(
      {
        hinweis:
          "M1-Sonde (PM-Plan 20.09., Abschnitt 3.3): rho je Spiel/Saison ueber die M0-Kaderfamilie, in drei " +
          "Aufstellungs-Stufungen (motoroptimal/menschlich-plausibel/absichtlich-schlecht). Format wie " +
          "scripts/lib/rangtreue-messung.mjs, numerisch vergleichbar mit miss-alle-disziplinen.mjs. Reiner " +
          "Sondenpfad ueber scripts/lib/aufstellungs-stufungen.ts (\"Variante P\" fuer A1.0) — kein Motorcode geaendert.",
        spiele: SPIELE,
        kaderQuelle: quelle,
        zeilen,
      },
      null,
      1,
    ),
  );
  console.log(`\nRohdaten geschrieben nach ${path.relative(WURZEL, ausgabePfad)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
