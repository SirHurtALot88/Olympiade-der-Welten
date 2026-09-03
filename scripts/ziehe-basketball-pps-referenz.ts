// ===================================================================================
// BASKETBALL-PPS-REFERENZ AUS DEM LIVE-SAVE-ABBILD ZIEHEN
//
// Auftrag: docs/design/pps-skalierung-opus.md Abschnitt 8 ("Praktikabilitaet: wie die Referenz
// entsteht und wann sie erneuert wird"), umgesetzt fuer docs/design/pps-skalierung-umsetzung.md.
//
// `computeIndividualBoxscorePpsFromFixtureResults()` (lib/resolve/battle-mode-arena-team-points.ts)
// braucht zwei Zahlen JE FELDGROESSE (2..6 Spieler je Seite): `iMittel` (Median-Impact, "ein
// mittelmaessiger Auftritt") und `iKrass` (99,5.-Perzentil-Impact, "ein krasser Auftritt"). Dieses
// Skript zieht sie aus einer echten Simulation gegen echte Liga-Kader -- NICHT aus dem kleinen
// Demokader des Mockups (`feldspielProbe`/`disziplinProbe` ohne `kaderFamilie`), aus demselben
// Grund, den das Opus-Dokument Abschnitt 1 nennt: der Demokader spannt Eignungen von rund 20 bis
// 70, ein echtes Liga-Feld spannt mehr, und ein Massstab aus der falschen Grundgesamtheit ist
// genau der Fehler, den diese Aenderung beheben soll.
//
// MECHANISMUS: `buildArenaTeam()` (dieselbe Bruecke wie scripts/ziehe-kader-familie.ts) liefert
// den echten Kader jedes Teams; die besten `n` Spieler nach Basketball-Eignung (`d.basketball`)
// werden ueber eine SYNTHETISCHE `LineupDraft`-Aufstellung (`ArenaAufstellung`, s.
// lib/foundation/battle-arena/arena-aufstellung-adapter.ts) fest in den Basketball-Slot gesetzt --
// derselbe `place[name] = {d,slot}`-Mechanismus, den auch eine echte Chris-Aufstellung fuellt.
// `runArenaFixtures()` (lib/battle/arena-headless-runner.ts, derselbe Weg wie im echten
// Matchday-Resolve) simuliert danach echte Duelle; `ArenaFixtureBoxscoreEintrag.wert` ist exakt
// der Rohwert, den `computeIndividualBoxscorePpsFromFixtureResults()` spaeter kurvt.
//
// UMFANG: mindestens 300 Fixtures je Feldgroesse, ueber viele verschiedene Team-Paarungen (nicht
// dieselben zwei Teams immer wieder) -- 19 Runden aus je 16 Paarungen (32 Teams, neu gemischt je
// Runde) ergeben 304. Bei playerCount 6 sind das 3.648 Spielerwerte je Feldgroesse, genug, um
// p99,5 stabil zu schaetzen (Opus-Dokument Abschnitt 8.2: "rund 18 Werte oberhalb").
//
// AUFRUF (nach dem ueblichen Weg an den Spielstand, s. CLAUDE.md "An die Spielstaende kommen"):
//
//   git fetch origin live-save
//   git show origin/live-save:data/online-saves/hetzner-live.sqlite.gz > /tmp/abbild.gz
//   gunzip -c /tmp/abbild.gz > /tmp/abbild.sqlite
//   OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/ziehe-basketball-pps-referenz.ts
//
// Ohne Argumente zieht das Skript ALLE fuenf Feldgroessen (2..6) NACHEINANDER in einem Lauf und
// schreibt direkt data/generated/basketball-pps-referenz.json (~15-35 min je Feldgroesse,
// s. Kommentar unten bei FIXTURES_ZIEL -- insgesamt gut zwei Stunden).
//
// PARALLELISIERBAR, WEIL EIN EINZELNER LAUF LANGE DAUERT: `--feldgroesse=<n>` zieht NUR diese eine
// Feldgroesse und schreibt einen Teil-Stand nach
// `data/generated/basketball-pps-referenz.partial-<n>.json` (bewusst NICHT der Zieldateiname --
// das ist ein Zwischenstand, kein Ergebnis). Fuenf parallele Aufrufe (einer je Feldgroesse, in
// fuenf Terminals/Prozessen) ziehen die Referenz in etwa einem Fuenftel der Zeit. `--merge` fasst
// alle fuenf `partial-*`-Dateien zur finalen `basketball-pps-referenz.json` zusammen und loescht
// die Teil-Staende danach -- bricht mit einer klaren Fehlermeldung ab, wenn eine der fuenf fehlt.
//
// ZUSAETZLICH: EIN DEMOKADER-MEDIAN JE FELDGROESSE, NUR FUER DEN DRIFT-WAECHTER
// (tests/basketball-pps-referenz-drift.test.ts). Der Waechter aus dem Opus-Dokument Abschnitt 8.3
// braucht einen fest eingefrorenen Vergleichswert AUS DERSELBEN Population, die er spaeter erneut
// misst (dem Demokader von `feldspielProbe`) -- ihn stattdessen gegen `iMittel` der ECHTEN
// Liga-Referenz zu pruefen, waere KEIN Drift-Test mehr, sondern ein staendiger Fehlalarm: der
// Demokader spannt Eignungen von rund 20 bis 70, ein echtes Liga-Feld spannt mehr (s. Kommentar
// oben), die beiden Mediane liegen deshalb systematisch auseinander, unabhaengig von jeder
// Motor-Aenderung. `zieheDemoKaderMedianAllerFeldgroessen()` haengt deshalb separat einen
// `demoKaderMedianFuerDriftpruefung` je Feldgroesse an -- ein einzelner, guenstiger Browser-Lauf
// (kein `runArenaFixtures()`, keine echten Kader, nur die eingebaute Demo-Aufstellung).
// ===================================================================================
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { chromium } from "playwright";

import { createSaveRepository } from "@/lib/persistence/save-repository";
import { listeArenaTeams, buildArenaTeam } from "@/lib/foundation/battle-arena/arena-kader-adapter";
import { runArenaFixtures } from "@/lib/battle/arena-headless-runner";

import type { GameState, LineupDraft, LineupDraftEntry } from "@/lib/data/olyDataTypes";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ZIEL_DATEI = path.join(WURZEL, "data/generated/basketball-pps-referenz.json");
const partialDatei = (n: number) => path.join(WURZEL, `data/generated/basketball-pps-referenz.partial-${n}.json`);

const FELDGROESSEN = [2, 3, 4, 5, 6] as const;
// Opus-Dokument Abschnitt 8.2: "mindestens 300 Fixtures je Feldgroesse". 19 Runden * 16 Paarungen
// (32 Teams) = 304 -- knapp darueber, nicht viel mehr, weil jede Fixture bei playerCount 6 real
// ueber eine halbe Minute Simulationszeit braucht (nachgemessen: ~6,5 s/Fixture inkl.
// Skript-Neueinhaengung, s. arena-headless-runner.ts).
const FIXTURES_ZIEL = 300;
const PAARUNGEN_JE_RUNDE = 16; // 32 Teams / 2

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function geseedetGemischt<T>(liste: readonly T[], seed: number): T[] {
  const kopie = [...liste];
  const zufall = mulberry32(seed);
  for (let i = kopie.length - 1; i > 0; i -= 1) {
    const j = Math.floor(zufall() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j]!, kopie[i]!];
  }
  return kopie;
}

function quantil(sortiert: readonly number[], p: number): number {
  if (sortiert.length === 0) return 0;
  const index = (sortiert.length - 1) * p;
  const unten = Math.floor(index);
  const oben = Math.ceil(index);
  if (unten === oben) return sortiert[unten]!;
  const anteil = index - unten;
  return sortiert[unten]! * (1 - anteil) + sortiert[oben]! * anteil;
}

function median(sortiert: readonly number[]): number {
  return quantil(sortiert, 0.5);
}

type FeldgroessenErgebnis = {
  n: number;
  fixtures: number;
  spielerwerte: number;
  iMittel: number;
  iKrass: number;
  quantile: Record<string, number>;
};

async function zieheFeldgroesse(gameState: GameState, saveId: string, n: number): Promise<FeldgroessenErgebnis> {
  const matchdayId = `pps-referenz-probe-${n}`;
  const teams = listeArenaTeams(gameState);

  // Fuer JEDES Team einmal die Top-n-Aufstellung nach Basketball-Eignung bauen -- unabhaengig
  // davon, gegen wen es in welcher Runde antritt (dieselbe Aufstellung gilt fuer alle Runden).
  const kaderNachTeam = new Map(teams.map((team) => [team.teamId, buildArenaTeam(gameState, team.teamId)] as const));
  const spielbareTeams = teams.filter((team) => (kaderNachTeam.get(team.teamId)?.length ?? 0) >= n);
  if (spielbareTeams.length < 2) {
    throw new Error(`ziehe-basketball-pps-referenz: keine zwei Teams mit >= ${n} einsatzfaehigen Spielern gefunden.`);
  }

  const lineupDrafts: LineupDraft[] = spielbareTeams.map((team) => {
    const kader = kaderNachTeam.get(team.teamId)!;
    const top = [...kader].sort((a, b) => (b.d.basketball ?? 0) - (a.d.basketball ?? 0)).slice(0, n);
    const entries: LineupDraftEntry[] = top.map((spieler, index) => ({
      disciplineId: "basketball",
      disciplineSide: "d1",
      slotIndex: index,
      playerId: spieler.id,
      activePlayerId: null,
    }));
    return {
      lineupId: `pps-referenz-${n}-${team.teamId}`,
      saveId,
      seasonId: gameState.season.id,
      matchdayId,
      teamId: team.teamId,
      status: "locked",
      entries,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  const runden = Math.ceil(FIXTURES_ZIEL / PAARUNGEN_JE_RUNDE);
  const fixtureInputs: { homeTeamId: string; awayTeamId: string; seed: string }[] = [];
  for (let runde = 0; runde < runden; runde += 1) {
    // Eigener Seed je Runde UND Feldgroesse -- verschiedene Feldgroessen sollen nicht zufaellig
    // dieselben Mischungen ziehen, verschiedene Runden derselben Feldgroesse auch nicht.
    const gemischt = geseedetGemischt(spielbareTeams, n * 1_000_003 + runde);
    for (let i = 0; i + 1 < gemischt.length; i += 2) {
      const heim = gemischt[i]!;
      const gast = gemischt[i + 1]!;
      fixtureInputs.push({
        homeTeamId: heim.teamId,
        awayTeamId: gast.teamId,
        seed: `pps-referenz:${n}:${runde}:${heim.teamId}:${gast.teamId}`,
      });
    }
  }

  const gameStateFuerLauf: GameState = {
    ...gameState,
    matchdayState: { ...(gameState.matchdayState ?? {}), matchdayId },
    seasonState: { ...gameState.seasonState, lineupDrafts },
  };

  console.log(
    `  n=${n}: ${fixtureInputs.length} Fixtures ueber ${runden} Runden, ${spielbareTeams.length} Teams -- das dauert...`,
  );
  const t0 = Date.now();
  // IN BATCHES, NICHT ALLE 300+ IN EINEM runArenaFixtures()-AUFRUF: nachgemessen (PPS-
  // Skalierung, 03.09.) waechst der Speicher EINER Browser-Seite ueber viele sequenzielle
  // `haengeMotorNeuEin()`-Neueinhaengungen hinweg unbegrenzt (2,7+ GB nach ~150 Fixtures, bei
  // fuenf parallelen Feldgroessen reichte das, den Host auf unter 1 GB freien Speicher zu
  // druecken UND die Simulation durch GC-Druck drastisch zu verlangsamen). `runArenaFixtures()`
  // startet und schliesst PRO AUFRUF einen frischen Browser (s. dessen Kopfkommentar) -- in
  // Batches von je `BATCH_GROESSE` Fixtures aufgerufen bleibt der Speicher pro Browser klein,
  // auf Kosten von ein paar zusaetzlichen Browser-Starts (Sekunden, nicht Minuten).
  const BATCH_GROESSE = 20;
  const ergebnisse: Awaited<ReturnType<typeof runArenaFixtures>> = [];
  for (let start = 0; start < fixtureInputs.length; start += BATCH_GROESSE) {
    const batch = fixtureInputs.slice(start, start + BATCH_GROESSE);
    const batchErgebnisse = await runArenaFixtures(gameStateFuerLauf, batch, "basketball");
    ergebnisse.push(...batchErgebnisse);
    console.log(
      `  n=${n}: ${ergebnisse.length}/${fixtureInputs.length} Fixtures fertig ` +
        `(${((Date.now() - t0) / 1000).toFixed(0)} s bisher)`,
    );
  }
  const dauerS = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`  n=${n}: fertig nach ${dauerS} s (${(Number(dauerS) / fixtureInputs.length).toFixed(2)} s/Fixture).`);

  const werte: number[] = [];
  for (const ergebnis of ergebnisse) {
    for (const eintrag of ergebnis.boxscore) {
      werte.push(eintrag.wert);
    }
  }
  werte.sort((a, b) => a - b);

  const quantile: Record<string, number> = {};
  for (const p of [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 0.995, 0.999]) {
    quantile[`p${p * 100}`.replace(".", "_")] = Math.round(quantil(werte, p) * 100) / 100;
  }

  return {
    n,
    fixtures: fixtureInputs.length,
    spielerwerte: werte.length,
    iMittel: Math.round(median(werte) * 100) / 100,
    iKrass: Math.round(quantil(werte, 0.995) * 100) / 100,
    quantile,
  };
}

function ermittleMotorSha1(): string {
  try {
    return execSync("sha1sum public/mockups/battle-mode.engine.js", { cwd: WURZEL, encoding: "utf8" }).trim().split(/\s+/)[0]!;
  } catch {
    return "unbekannt";
  }
}

function ermittleRepoCommit(): string {
  try {
    return execSync("git rev-parse HEAD", { cwd: WURZEL, encoding: "utf8" }).trim();
  } catch {
    return "unbekannt";
  }
}

/**
 * S. Kommentar am Dateikopf ("ZUSAETZLICH: EIN DEMOKADER-MEDIAN..."): ein GUENSTIGER,
 * einzelner Browser-Lauf gegen den eingebauten Demokader (kein `buildArenaTeam()`, kein
 * `runArenaFixtures()`) -- nur fuer `tests/basketball-pps-referenz-drift.test.ts`. Faellt dieser
 * Schritt aus (kein Chromium verfuegbar), bekommt die Ausgabedatei schlicht kein
 * `demoKaderMedianFuerDriftpruefung`-Feld -- der Drift-Test ist selbst per `describe.skipIf`
 * chromium-optional und toleriert ein fehlendes Feld ohnehin nicht besser als ein fehlendes
 * Chromium, beides ist derselbe Ausfall.
 */
async function zieheDemoKaderMedianAllerFeldgroessen(): Promise<Map<number, number>> {
  const ergebnis = new Map<number, number>();
  const seitenPfad = path.join(WURZEL, "public", "mockups", "battle-mode.html");
  const browser = await chromium.launch({
    headless: true,
    args: ["--proxy-server=direct://", "--host-resolver-rules=MAP * 0.0.0.0"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(seitenPfad).href);
    await page.waitForFunction(() => typeof (window as unknown as { __arena?: unknown }).__arena !== "undefined", {
      timeout: 15_000,
    });
    for (const n of FELDGROESSEN) {
      const werte = await page.evaluate((jeSeite) => {
        const arena = (
          window as unknown as {
            __arena: {
              feldspielProbe: (dId: string, opt: { n: number; jeSeite: number }) => {
                spiele: Array<{ spieler: Array<{ wert: number }> }>;
              };
            };
          }
        ).__arena;
        const lauf = arena.feldspielProbe("basketball", { n: 24, jeSeite });
        return lauf.spiele.flatMap((spiel) => spiel.spieler.map((spieler) => spieler.wert));
      }, n);
      werte.sort((a, b) => a - b);
      ergebnis.set(n, Math.round(median(werte) * 100) / 100);
    }
  } finally {
    await browser.close();
  }
  return ergebnis;
}

function schreibeErgebnis(
  ergebnisseNachGroesse: Map<number, FeldgroessenErgebnis>,
  quelle: { saveId: string; saveName: string },
  demoKaderMedianNachGroesse: Map<number, number>,
) {
  const feldgroessen: Record<string, unknown> = {};
  for (const n of FELDGROESSEN) {
    const ergebnis = ergebnisseNachGroesse.get(n);
    if (!ergebnis) continue;
    feldgroessen[String(n)] = {
      n: ergebnis.n,
      fixtures: ergebnis.fixtures,
      spielerwerte: ergebnis.spielerwerte,
      iMittel: ergebnis.iMittel,
      iKrass: ergebnis.iKrass,
      quantile: ergebnis.quantile,
      demoKaderMedianFuerDriftpruefung: demoKaderMedianNachGroesse.get(n) ?? null,
    };
  }
  const ausgabe = {
    disziplin: "basketball",
    hinweis:
      "iMittel (Median) und iKrass (99,5.-Perzentil) je Feldgroesse, gezogen aus echten Liga-" +
      "Kadern (buildArenaTeam(), s. scripts/ziehe-basketball-pps-referenz.ts) ueber " +
      "runArenaFixtures() -- NICHT aus dem Demokader des Mockups. Gelesen von " +
      "computeIndividualBoxscorePpsFromFixtureResults() in " +
      "lib/resolve/battle-mode-arena-team-points.ts. Neu ziehen nach jeder Aenderung, die den " +
      "rohen Boxscore-Impact verschiebt (feldspielWert()-Gewichte, Spieldauer/VIERTEL_*, " +
      "Basketball-Rezept, Kadergenerierung/Attributniveau der Liga) -- s. " +
      "docs/design/pps-skalierung-opus.md Abschnitt 8.3. `demoKaderMedianFuerDriftpruefung` je " +
      "Feldgroesse ist ein SEPARATER Wert, NUR fuer tests/basketball-pps-referenz-drift.test.ts " +
      "-- gemessen am eingebauten Demokader des Mockups (feldspielProbe), NICHT an echten " +
      "Liga-Kadern, damit der Drift-Waechter dieselbe Population misst, die er spaeter erneut " +
      "abfragt (sonst waere jede Abweichung zwischen Demokader und Liga-Feld ein Fehlalarm).",
    gezogenAm: new Date().toISOString(),
    motorSha1: ermittleMotorSha1(),
    repoCommit: ermittleRepoCommit(),
    quelle: { ...quelle, mechanismus: "runArenaFixtures gegen echte Liga-Kader (buildArenaTeam)" },
    fixturesJeFeldgroesse: FIXTURES_ZIEL,
    feldgroessen,
  };
  writeFileSync(ZIEL_DATEI, JSON.stringify(ausgabe, null, 1));
  console.log(`Geschrieben: ${ZIEL_DATEI}`);
}

async function main() {
  const args = process.argv.slice(2);
  const feldgroesseArg = args.find((a) => a.startsWith("--feldgroesse="));
  const mergeModus = args.includes("--merge");

  if (mergeModus) {
    const ergebnisseNachGroesse = new Map<number, FeldgroessenErgebnis>();
    const fehlend: number[] = [];
    for (const n of FELDGROESSEN) {
      const datei = partialDatei(n);
      if (!existsSync(datei)) {
        fehlend.push(n);
        continue;
      }
      const inhalt = JSON.parse(readFileSync(datei, "utf8")) as { ergebnis: FeldgroessenErgebnis; quelle: { saveId: string; saveName: string } };
      ergebnisseNachGroesse.set(n, inhalt.ergebnis);
    }
    if (fehlend.length > 0) {
      console.error(`Fehlende Teil-Staende fuer Feldgroesse(n): ${fehlend.join(", ")} -- zuerst mit --feldgroesse=<n> ziehen.`);
      process.exit(1);
    }
    const ersterInhalt = JSON.parse(readFileSync(partialDatei(FELDGROESSEN[0]), "utf8")) as { quelle: { saveId: string; saveName: string } };
    console.log("Ziehe Demokader-Mediane fuer den Drift-Waechter (ein guenstiger, separater Browser-Lauf)...");
    const demoKaderMedianNachGroesse = await zieheDemoKaderMedianAllerFeldgroessen();
    schreibeErgebnis(ergebnisseNachGroesse, ersterInhalt.quelle, demoKaderMedianNachGroesse);
    for (const n of FELDGROESSEN) unlinkSync(partialDatei(n));
    console.log("Teil-Staende zusammengefuehrt und geloescht.");
    return;
  }

  const repo = createSaveRepository();
  const koepfe = repo.listSaves();
  if (!koepfe.length) {
    console.error("Kein Spielstand im Store unter OLY_APP_SQLITE_PATH gefunden.");
    process.exit(1);
  }
  const kopf = koepfe[0];
  const gameState = repo.getSaveById(kopf.saveId)?.gameState as GameState | undefined;
  if (!gameState) {
    console.error(`Save ${kopf.saveId} hat keinen gameState.`);
    process.exit(1);
  }
  const quelle = { saveId: kopf.saveId, saveName: kopf.name };
  console.log(`Quelle: ${quelle.saveName} (${quelle.saveId})`);

  if (feldgroesseArg) {
    const n = Number(feldgroesseArg.split("=")[1]);
    if (!FELDGROESSEN.includes(n as (typeof FELDGROESSEN)[number])) {
      console.error(`--feldgroesse muss eine von ${FELDGROESSEN.join(", ")} sein, bekam ${feldgroesseArg}.`);
      process.exit(1);
    }
    const ergebnis = await zieheFeldgroesse(gameState, kopf.saveId, n);
    writeFileSync(partialDatei(n), JSON.stringify({ quelle, ergebnis }, null, 1));
    console.log(`Teil-Stand geschrieben: ${partialDatei(n)}`);
    return;
  }

  const ergebnisseNachGroesse = new Map<number, FeldgroessenErgebnis>();
  for (const n of FELDGROESSEN) {
    ergebnisseNachGroesse.set(n, await zieheFeldgroesse(gameState, kopf.saveId, n));
  }
  console.log("Ziehe Demokader-Mediane fuer den Drift-Waechter (ein guenstiger, separater Browser-Lauf)...");
  const demoKaderMedianNachGroesse = await zieheDemoKaderMedianAllerFeldgroessen();
  schreibeErgebnis(ergebnisseNachGroesse, quelle, demoKaderMedianNachGroesse);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
