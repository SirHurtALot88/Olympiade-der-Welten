// ===================================================================================
// A1.0 — DIE EXPOSITIONS-SONDE (PM-Plan, docs/pm-briefings/projektmanager-plan-kampfmodell-
// umsetzung-20-09.md, Abschnitt 3.5). Sechs Varianten, ALLE reiner Sondenpfad: nichts davon
// wird in public/mockups/battle-mode.engine.js gemergt oder dauerhaft veraendert.
//
//   A — heutiger Motor, unveraendert (Basislinie).
//   B — cdKuerzung=(u)=>0 (die Rate-Haelfte von Chris' Tempo-Formel-Fix, zur Kontrolle).
//   C — Zielwahl gleichverteilt statt geometrisch (Round-Robin ueber die lebenden Gegner).
//   D — B und C zusammen.
//   E — alle Wahrscheinlichkeiten PRD-gebunden. NACHGEMESSEN (s. scripts/lib/expositions-
//       sonde-patches.mjs Kopfkommentar): im gesamten Arena-Chassis gibt es GENAU ZWEI
//       `rr()`-Aufrufe (Fernkampf-Streuwinkel), beide mit `streu=0` fest verdrahtet — ein
//       No-Op. Es gibt schlicht keine Wahrscheinlichkeitsentscheidung, an die PRD sich
//       binden liesse. E ist deshalb TEXTLICH = A (keine Engine-Aenderung): statt eine
//       zweite, komplett identische (und bei n>=96 mehrstuendige) Messung zu fahren, wird
//       E direkt aus A UEBERNOMMEN (Zeilen kopiert, nur umbenannt) — die Begruendung dafuer
//       IST das Ergebnis, keine ausgelassene Implementierung. Stichprobenartig an n=4 im PR
//       gegengeprueft, dass A und E tatsaechlich bit-identisch messen (s. PR-Text).
//   P — `place` gesetzt. NICHT NEU GEBAUT: uebernimmt unveraendert scripts/lib/aufstellungs-
//       stufungen.ts (M1, PR #982) und den Aufrufweg aus scripts/miss-preis-der-aufstellung.ts.
//       Stufung 1 ("motoroptimal") reproduziert laut M1s eigenem Kopfkommentar exakt die
//       Ruecfall-Reihenfolge des heutigen Motors — sie ist deshalb PER KONSTRUKTION identisch
//       mit Variante A und wird ebenfalls aus A uebernommen statt separat gemessen. Live
//       gemessen werden nur die beiden Stufungen, die tatsaechlich eine ANDERE Aufstellung
//       erzeugen: "menschlich-plausibel" (die Kopfzeile "P" unten) und "absichtlich-schlecht".
//
// A-D laufen ueber scripts/lib/rangtreue-messung.mjs::disziplinMessen() im Batch-Modus
// (`opt.kaderFamilie`) — EIN Browser-Aufruf je (Variante, Disziplin) statt einer Schleife
// ueber 16 Paarungen, weil `disziplinProbe` das Tauschen von SQUAD/OPP je Paarung selbst
// uebernimmt. P braucht die LineupDraft-Bruecke individuell je Paarung (eigene `aufstellung`)
// und laeuft deshalb wie M1 in einer eigenen Schleife je Paarung.
//
// LAUFZEIT / KONKURRENZ: bei n>=96 x 16 Paarungen ist JEDER (Variante,Disziplin)-Lauf allein
// bereits zweistellige Minuten lang (nachgemessen: battlefield n=24x5 Paarungen ~130s reine
// Rechenzeit -> battlefield n=96x16 Paarungen ~27 Min hochgerechnet). Ohne Parallelisierung
// waeren alle Kombinationen zusammen ein zweistelliger Stundenlauf. Diese Sonde verteilt die
// (Variante,Disziplin)-Jobs deshalb ueber einen simplen Worker-Pool (mehrere Playwright-Pages
// IM SELBEN Browser, KONKURRENZ = min(verfuegbare CPU-Kerne, 4)) — jede Page ist ein eigener
// JS-Kontext, die Rechenlast verteilt sich auf mehrere Renderer-Prozesse.
//
// MOTOR NIE ANGEFASST: B/C/D patchen ausschliesslich eine TEMPORAERE, in einem System-
// Temp-Verzeichnis erzeugte Kopie von battle-mode.engine.js (scripts/lib/expositions-sonde-
// patches.mjs) — `public/mockups/battle-mode.engine.js` im Arbeitsbaum bleibt unangetastet.
// A/P laufen direkt auf dem Original. `node scripts/miss-alle-disziplinen.mjs 24`
// bit-identisch zu main ist deshalb eine reine Formalie, aber Pflichtnachweis (PR-Text).
//
// Aufruf:
//   npx tsx scripts/miss-expositions-sonde.ts [spiele] [disziplin ...]
// Ohne Disziplinliste laufen tdm, mini-dm UND battlefield. `spiele` ist n JE PAARUNG (16
// Paarungen in der M0-Familie) — Synthese-Huerde: n>=96-150, Default hier 96.
// ===================================================================================
import { chromium, type Browser, type Page } from "playwright";
import { existsSync, readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from "node:fs";
import { tmpdir, cpus } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  auswerten,
  median,
  spannweite,
  bootstrapMedianUnsicherheit,
  disziplinMessen,
} from "./lib/rangtreue-messung.mjs";
import { baueEnginePatch } from "./lib/expositions-sonde-patches.mjs";
import {
  ARENA_STUFUNG_DISZIPLINEN,
  JE_SEITE,
  baueStufung,
  baueAufstellungFuerHeim,
  type ArenaStufungDisziplin,
} from "./lib/aufstellungs-stufungen";
import type { ArenaSpieler } from "@/lib/foundation/battle-arena/arena-kader-adapter";
import type { ArenaAufstellung } from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOCKUPS_ORIG = path.join(WURZEL, "public/mockups");
const ENGINE_ORIG_PFAD = path.join(MOCKUPS_ORIG, "battle-mode.engine.js");
const KADERFAMILIE_PFAD = path.join(WURZEL, "data/generated/kaderfamilie-arena-erweitert.json");
const CHROMIUM_PFAD = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const ARENA_NETZWERK_ABRIEGELUNG_ARGS = ["--proxy-server=direct://", "--host-resolver-rules=MAP * 0.0.0.0"];
const KONKURRENZ = Math.max(1, Math.min(4, cpus().length));

const argv = process.argv.slice(2);
const numerischeArgs = argv.filter((a) => /^\d+$/.test(a));
const disziplinArgs = argv.filter((a) => !/^\d+$/.test(a)) as ArenaStufungDisziplin[];
const SPIELE = numerischeArgs.length ? Number(numerischeArgs[0]) : 96;
const DISZIPLINEN: ArenaStufungDisziplin[] = disziplinArgs.length ? disziplinArgs : ARENA_STUFUNG_DISZIPLINEN;

if (SPIELE < 96) {
  console.error(
    `ABBRUCH: n=${SPIELE} je Paarung unterschreitet die Synthese-Huerde (n>=96-150 je Kadervariante, ` +
      `PM-Plan Abschnitt 3.5). Eine kleinere Messung kann hier weder Erfolg noch Misserfolg beweisen.`,
  );
  process.exit(1);
}

type Paarung = { label: string; heim: ArenaSpieler[]; gast: ArenaSpieler[] };

function ladePaarungen(): { paarungen: Paarung[]; quelle: unknown } {
  if (!existsSync(KADERFAMILIE_PFAD)) {
    throw new Error(
      `M0-Kaderfamilie fehlt (${KADERFAMILIE_PFAD}). Erst ziehen: npx tsx scripts/ziehe-kader-familie.ts --arena-erweitert.`,
    );
  }
  const roh = JSON.parse(readFileSync(KADERFAMILIE_PFAD, "utf8"));
  return { paarungen: roh.varianten, quelle: roh.quelle };
}

/** Baut ein temporaeres, isoliertes mockups-Verzeichnis mit genau EINER gepatchten Engine —
 * das eingecheckte public/mockups bleibt an keiner Stelle beschrieben. Nur fuer B/C/D noetig;
 * A und P laufen direkt auf MOCKUPS_ORIG. */
function baueTempMockups(variante: "B" | "C" | "D"): string {
  const dir = mkdtempSync(path.join(tmpdir(), `oly-a10-${variante}-`));
  for (const datei of ["battle-mode.html", "battle-mode.css", "battle-mode.rezepte.js"]) {
    cpSync(path.join(MOCKUPS_ORIG, datei), path.join(dir, datei));
  }
  const original = readFileSync(ENGINE_ORIG_PFAD, "utf8");
  writeFileSync(path.join(dir, "battle-mode.engine.js"), baueEnginePatch(variante, original));
  return dir;
}

async function neueSeite(browser: Browser, mockupsDir: string, ersteParung: Paarung): Promise<Page> {
  const seite = await browser.newPage();
  await seite.addInitScript(() => {
    const fenster = window as unknown as { __name?: (fn: unknown, name?: string) => unknown };
    if (typeof fenster.__name !== "function") fenster.__name = (fn) => fn;
  });
  await seite.addInitScript(
    (kader) => {
      (window as unknown as { __olyArenaKader?: unknown }).__olyArenaKader = kader;
    },
    { heim: ersteParung.heim, gast: ersteParung.gast, aufstellung: {} },
  );
  await seite.goto(pathToFileURL(path.join(mockupsDir, "battle-mode.html")).href, { waitUntil: "networkidle" });
  await seite.waitForFunction(() => Boolean((window as unknown as { __arena?: unknown }).__arena), null, {
    timeout: 30000,
  });
  return seite;
}

/** Simpler Worker-Pool: verarbeitet `items` mit bis zu `konkurrenz` gleichzeitigen Aufrufen
 * von `worker`. Kein externes Paket noetig fuer so eine kleine Job-Liste. */
async function poolAbarbeiten<T>(items: T[], konkurrenz: number, worker: (item: T) => Promise<void>): Promise<void> {
  let idx = 0;
  async function next(): Promise<void> {
    while (idx < items.length) {
      const meins = idx++;
      await worker(items[meins]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(konkurrenz, items.length) }, () => next()));
}

type Zeile = {
  variante: string;
  disc: ArenaStufungDisziplin;
  spielMed: number;
  spielSpan: number;
  saisonMed: number;
  saisonSpan: number;
  teilnehmer: number;
  n: number;
  paarungen: number;
  bootstrap: ReturnType<typeof bootstrapMedianUnsicherheit>;
};

async function main() {
  const { paarungen, quelle } = ladePaarungen();
  console.log(
    `A1.0 — Expositions-Sonde: ${SPIELE} Spiele je Paarung, ${paarungen.length} Paarungen (M0-Kaderfamilie), ` +
      `Disziplinen: ${DISZIPLINEN.join(", ")}, Konkurrenz: ${KONKURRENZ}.`,
  );
  console.log(`Kader-Quelle: ${JSON.stringify(quelle)}\n`);

  const launchOptions = existsSync(CHROMIUM_PFAD)
    ? { headless: true, executablePath: CHROMIUM_PFAD, args: ARENA_NETZWERK_ABRIEGELUNG_ARGS }
    : { headless: true, channel: "chromium" as const, args: ARENA_NETZWERK_ABRIEGELUNG_ARGS };
  const browser: Browser = await chromium.launch(launchOptions);
  const zeilen: Zeile[] = [];
  const fehler: string[] = [];
  const tempDirs: Record<string, string> = {};
  try {
    // --- A, B, C, D live gemessen (E s.u. aus A abgeleitet) ---
    tempDirs.B = baueTempMockups("B");
    tempDirs.C = baueTempMockups("C");
    tempDirs.D = baueTempMockups("D");
    const dirVon = (v: string) => (v === "A" ? MOCKUPS_ORIG : tempDirs[v]);

    const aeJobs: Array<{ variante: string; disc: ArenaStufungDisziplin }> = [];
    for (const variante of ["A", "B", "C", "D"]) for (const disc of DISZIPLINEN) aeJobs.push({ variante, disc });

    console.log(`... ${aeJobs.length} (Variante,Disziplin)-Jobs fuer A-D, Konkurrenz ${KONKURRENZ}`);
    // WICHTIG: der GESAMTE Job-Koerper (inklusive neueSeite()) steht in try/catch. Ein Job,
    // der ausserhalb seines try/catch wirft, reisst per Promise.all() den kompletten
    // Worker-Pool-Aufruf mit sich — und damit den GETEILTEN Browser im aeusseren `finally`,
    // was ALLE anderen, noch laufenden Jobs mit "Target page, context or browser has been
    // closed" abbrechen laesst (genau so beim ersten Testlauf dieses Skripts nachgemessen,
    // s. PR-Beschreibung). Ein einzelner fehlgeschlagener Job darf deshalb nur SICH SELBST
    // in `fehler` eintragen, nie den Pool sprengen.
    await poolAbarbeiten(aeJobs, KONKURRENZ, async ({ variante, disc }) => {
      let seite: Page | null = null;
      try {
        seite = await neueSeite(browser, dirVon(variante), paarungen[0]);
        const r: any = await disziplinMessen(seite, disc, { n: SPIELE, kaderFamilie: paarungen, jeSeite: undefined });
        if ("fehler" in r) {
          fehler.push(`${variante}/${disc}: ${r.fehler}`);
          return;
        }
        const bootstrap = bootstrapMedianUnsicherheit((r.varianten ?? []).map((v: { spiel: number }) => v.spiel));
        zeilen.push({
          variante,
          disc,
          spielMed: r.spielMed,
          spielSpan: r.spielSpan,
          saisonMed: r.saisonMed,
          saisonSpan: r.saisonSpan,
          teilnehmer: r.teilnehmer,
          n: SPIELE,
          paarungen: r.varianten?.length ?? 0,
          bootstrap,
        });
        console.log(`    fertig: ${variante}/${disc} (rho je Spiel Median ${r.spielMed.toFixed(3)})`);
      } catch (e) {
        fehler.push(`${variante}/${disc}: ${String(e).slice(0, 160)}`);
      } finally {
        if (seite) await seite.close().catch(() => {});
      }
    });

    // VARIANTE E — textlich = A (s. Kopfkommentar), deshalb aus A UEBERNOMMEN statt separat
    // gemessen. Kein Zufallszahlenkanal existiert im Arena-Chassis, den PRD binden koennte.
    for (const disc of DISZIPLINEN) {
      const a = zeilen.find((z) => z.variante === "A" && z.disc === disc);
      if (a) zeilen.push({ ...a, variante: "E" });
    }

    // --- P: nur die beiden Stufungen live messen, die tatsaechlich von A abweichen ---
    if (!process.env.OLY_SONDE_OHNE_P) {
      const pJobs: Array<{ stufung: "menschlich-plausibel" | "absichtlich-schlecht"; disc: ArenaStufungDisziplin }> = [];
      for (const stufung of ["menschlich-plausibel", "absichtlich-schlecht"] as const)
        for (const disc of DISZIPLINEN) pJobs.push({ stufung, disc });

      console.log(`... ${pJobs.length} (Stufung,Disziplin)-Jobs fuer P, Konkurrenz ${KONKURRENZ}`);
      await poolAbarbeiten(pJobs, KONKURRENZ, async ({ stufung, disc }) => {
        let seite: Page | null = null;
        try {
          seite = await neueSeite(browser, MOCKUPS_ORIG, paarungen[0]);
          const varianten: Array<{ label: string; spiel: number; saison: number; teilnehmer: number }> = [];
          for (const paarung of paarungen) {
            if (paarung.heim.length < JE_SEITE[disc]) {
              fehler.push(`P/${disc}/${stufung}/${paarung.label}: Heimkader zu klein.`);
              continue;
            }
            const geordnet = baueStufung(paarung.heim, disc, stufung);
            const aufstellung: ArenaAufstellung = baueAufstellungFuerHeim(geordnet, disc);
            let roh: { spiele: Array<Record<string, unknown>> };
            try {
              roh = await seite.evaluate(
                async ({ kader, disc, n }) => {
                  const fenster = window as unknown as {
                    __arena?: { disziplinProbe: (d: string, opt: { n: number }) => { spiele: unknown[] } };
                    __olyArenaKader?: unknown;
                  };
                  fenster.__olyArenaKader = kader;
                  delete fenster.__arena;
                  document.querySelectorAll("script[data-oly-headless-engine]").forEach((el) => el.remove());
                  const script = document.createElement("script");
                  script.src = "battle-mode.engine.js";
                  script.setAttribute("data-oly-headless-engine", "1");
                  document.body.appendChild(script);
                  const start = Date.now();
                  while (typeof fenster.__arena === "undefined") {
                    if (Date.now() - start > 30000) throw new Error("window.__arena wurde nicht rechtzeitig bereit.");
                    await new Promise((r) => setTimeout(r, 20));
                  }
                  return (fenster.__arena as any).disziplinProbe(disc, { n });
                },
                { kader: { heim: geordnet, gast: paarung.gast, aufstellung }, disc, n: SPIELE },
              );
            } catch (e) {
              fehler.push(`P/${disc}/${stufung}/${paarung.label}: ${String(e).slice(0, 120)}`);
              continue;
            }
            const ausgewertet = auswerten(roh.spiele as Parameters<typeof auswerten>[0]);
            if (Number.isNaN(ausgewertet.spiel)) continue;
            varianten.push({ label: paarung.label, spiel: ausgewertet.spiel, saison: ausgewertet.saison, teilnehmer: ausgewertet.teilnehmer });
          }
          if (!varianten.length) {
            fehler.push(`P/${disc}/${stufung}: keine auswertbare Paarung.`);
            return;
          }
          zeilen.push({
            variante: stufung === "menschlich-plausibel" ? "P" : `P(${stufung})`,
            disc,
            spielMed: median(varianten.map((v) => v.spiel)),
            spielSpan: spannweite(varianten.map((v) => v.spiel)),
            saisonMed: median(varianten.map((v) => v.saison)),
            saisonSpan: spannweite(varianten.map((v) => v.saison)),
            teilnehmer: Math.round(varianten.reduce((a, v) => a + v.teilnehmer, 0) / varianten.length),
            n: SPIELE,
            paarungen: varianten.length,
            bootstrap: bootstrapMedianUnsicherheit(varianten.map((v) => v.spiel)),
          });
          console.log(`    fertig: P(${stufung})/${disc}`);
        } catch (e) {
          fehler.push(`P/${disc}/${stufung}: ${String(e).slice(0, 160)}`);
        } finally {
          if (seite) await seite.close().catch(() => {});
        }
      });

      // P-Stufung "motoroptimal" reproduziert per Konstruktion den heutigen Ruecfall (= A) —
      // aus A uebernommen statt separat gemessen, s. Kopfkommentar.
      for (const disc of DISZIPLINEN) {
        const a = zeilen.find((z) => z.variante === "A" && z.disc === disc);
        if (a) zeilen.push({ ...a, variante: "P(motoroptimal)=A" });
      }
    }
  } finally {
    await browser.close();
    for (const dir of Object.values(tempDirs)) rmSync(dir, { recursive: true, force: true });
  }

  console.log(
    "\nVariante            Disziplin       n   Paar.  rho je Spiel (Med)  Spannw.  Median-Unsich.(90%)  rho Saison (Med)  Spannw.",
  );
  for (const z of zeilen) {
    console.log(
      z.variante.padEnd(20) + z.disc.padEnd(16) + String(z.n).padStart(3) + String(z.paarungen).padStart(7) +
        z.spielMed.toFixed(3).padStart(21) + z.spielSpan.toFixed(3).padStart(9) +
        (Number.isNaN(z.bootstrap.breite) ? "n/a".padStart(21) : z.bootstrap.breite.toFixed(3).padStart(21)) +
        z.saisonMed.toFixed(3).padStart(18) + z.saisonSpan.toFixed(3).padStart(9),
    );
  }

  console.log("\nBEWEGUNGSREGEL (PM-Plan 3.5): eine Bewegung zaehlt nur, wenn sie die Spannweite der M0-Familie ueberschreitet.");
  const basisZeilen = new Map<string, Zeile>();
  for (const z of zeilen) if (z.variante === "A") basisZeilen.set(z.disc, z);
  for (const variante of ["B", "C", "D", "E", "P"]) {
    for (const disc of DISZIPLINEN) {
      const a = basisZeilen.get(disc);
      const v = zeilen.find((z) => z.variante === variante && z.disc === disc);
      if (!a || !v) continue;
      const diff = v.spielMed - a.spielMed;
      const eigeneSpannweite = Math.max(a.spielSpan, v.spielSpan);
      const bewegt = Math.abs(diff) > eigeneSpannweite;
      console.log(
        `  ${variante} vs A  ${disc.padEnd(12)} ${a.spielMed.toFixed(3)} -> ${v.spielMed.toFixed(3)} ` +
          `(Δ ${diff >= 0 ? "+" : ""}${diff.toFixed(3)}, Kader-Spannweite ${eigeneSpannweite.toFixed(3)}) -> ` +
          (bewegt ? "ECHTER BEFUND, ueberschreitet die Kaderfamilien-Spannweite." : "NICHT von Kaderrauschen unterscheidbar."),
      );
    }
  }

  console.log("\nSeitenfehler: " + (fehler.length ? fehler.slice(0, 10).join(" | ") : "keine"));

  const ausgabePfad = path.join(WURZEL, "data/generated/expositions-sonde-a10.json");
  writeFileSync(
    ausgabePfad,
    JSON.stringify(
      {
        hinweis:
          "A1.0-Sonde (PM-Plan 20.09., Abschnitt 3.5): sechs Varianten (A-E, P) auf der M0-Kaderfamilie " +
          "(16 Paarungen), gemessen auf dem Stand NACH dem persOf-Fix (PR #984). E und P(motoroptimal) sind " +
          "aus A UEBERNOMMEN (textlich/konstruktiv identisch, s. Skript-Kopfkommentar), nicht separat " +
          "gemessen. Reiner Sondenpfad ueber scripts/lib/expositions-sonde-patches.mjs (B/C/D) bzw. " +
          "scripts/lib/aufstellungs-stufungen.ts (P, aus M1 uebernommen) — kein Motorcode im Arbeitsbaum geaendert.",
        spieleJePaarung: SPIELE,
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
