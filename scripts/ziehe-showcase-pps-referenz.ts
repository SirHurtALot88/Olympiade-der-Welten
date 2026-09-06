// ===================================================================================
// SHOWCASE-PPS-REFERENZ AUS DEM LIVE-SAVE-ABBILD ZIEHEN
//
// Showcase-Analogon zu scripts/ziehe-gewichtheben-pps-referenz.ts (dort ausfuehrlich
// begruendet -- hier nur die Unterschiede). Auftrag: Produktivierungswelle 1 (PM-Briefing
// 06.09., Abschnitt 4/6.3), docs/design/speed-schach-showcase-produktivierung.md.
//
// `computeIndividualBoxscorePpsFromFixtureResults()` (lib/resolve/battle-mode-arena-team-points.ts)
// braucht auch fuer Showcase zwei Zahlen JE FELDGROESSE: `iMittel` (Median) und `iKrass`
// (99,5.-Perzentil) des rohen Boxscore-Werts (`MOTOREN.showcase.wert()` = `u.summe`, s.
// WERTUNG_AUFTRITT() in battle-mode.engine.js -- ANDERS ALS SPEED-SCHACH keine Zweikampf-Note,
// sondern ein eigenstaendiger Auftrittswert je Teilnehmer, s. Kopfkommentar
// spieleBuehneAuftritt() im Motor).
//
// MECHANISMUS: identisch zu Gewichthebens Skript -- `buildArenaTeam()` liefert den echten Kader
// jedes Teams, die besten `n` Spieler nach Showcase-Eignung (`d.showcase`) werden ueber
// eine synthetische `LineupDraft`-Aufstellung fest in den Showcase-Slot gesetzt,
// `runArenaFixtures()` (mit dem neuen `spieleBuehneAuftritt()`-Motor-Einstiegspunkt, s.
// arena-headless-runner.ts) simuliert echte Auftritte.
//
// KATALOG-STANDARDGROESSE 5, NICHT 6 (nachgesehen, nicht kopiert): `Discipline.playerCount` fuer
// "showcase" ist in lib/data/dataAdapter.ts 5 -- BUEHNE_ART.showcase.jeSeite im Motor
// ist trotzdem 6 (die MOTOR-Feldgroesse, die tatsaechlich gespielte "Auftritte je Seite"-Zahl).
// Wie bei Hockey (playerCount 5, jeSeite 6 im Feldspiel-Chassis) ist der Katalogwert nur der
// Fallback fuer `ARENA_IMPACT_KONFIG_JE_DISZIPLIN.katalogStandardgroesse`, wenn ein Spieltag
// ueberhaupt keine ermittelbare Feldgroesse hat -- die tatsaechlich GEWUERFELTE Feldgroesse
// einer Saison liegt fuer jede der zwanzig Disziplinen gleichverteilt zwischen 2 und 6,
// unabhaengig vom Katalogwert. Diese Ziehung deckt trotzdem alle fuenf Feldgroessen ab.
//
// AUFRUF (nach dem ueblichen Weg an den Spielstand, s. CLAUDE.md "An die Spielstaende kommen"):
//
//   git fetch origin live-save
//   git show origin/live-save:data/online-saves/hetzner-live.sqlite.gz > /tmp/abbild.gz
//   gunzip -c /tmp/abbild.gz > /tmp/abbild.sqlite
//   OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/ziehe-showcase-pps-referenz.ts
//
// Ohne Argumente zieht das Skript ALLE fuenf Feldgroessen (2..6) NACHEINANDER und schreibt direkt
// data/generated/showcase-pps-referenz.json. `--feldgroesse=<n>` (Teil-Stand,
// `showcase-pps-referenz.partial-<n>.json`) und `--merge` funktionieren wie beim
// Gewichtheben-Skript.
// ===================================================================================
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createSaveRepository } from "@/lib/persistence/save-repository";
import { listeArenaTeams, buildArenaTeam } from "@/lib/foundation/battle-arena/arena-kader-adapter";
import { runArenaFixtures } from "@/lib/battle/arena-headless-runner";

import type { GameState, LineupDraft, LineupDraftEntry } from "@/lib/data/olyDataTypes";

const DISZIPLIN = "showcase";
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ZIEL_DATEI = path.join(WURZEL, "data/generated/showcase-pps-referenz.json");
const partialDatei = (n: number) => path.join(WURZEL, `data/generated/showcase-pps-referenz.partial-${n}.json`);

const FELDGROESSEN = [2, 3, 4, 5, 6] as const;
// S. Dateikopf-Kommentar Gewichtheben-Skript ("KLEINERE STICHPROBE ALS BASKETBALL") -- dieselbe
// Zeitbudget-Entscheidung fuer die Erstziehung dieser Welle.
const FIXTURES_ZIEL = 60;
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

  const kaderNachTeam = new Map(teams.map((team) => [team.teamId, buildArenaTeam(gameState, team.teamId)] as const));
  const spielbareTeams = teams.filter((team) => (kaderNachTeam.get(team.teamId)?.length ?? 0) >= n);
  if (spielbareTeams.length < 2) {
    throw new Error(`ziehe-showcase-pps-referenz: keine zwei Teams mit >= ${n} einsatzfaehigen Spielern gefunden.`);
  }

  const lineupDrafts: LineupDraft[] = spielbareTeams.map((team) => {
    const kader = kaderNachTeam.get(team.teamId)!;
    const top = [...kader].sort((a, b) => (b.d[DISZIPLIN] ?? 0) - (a.d[DISZIPLIN] ?? 0)).slice(0, n);
    const entries: LineupDraftEntry[] = top.map((spieler, index) => ({
      disciplineId: DISZIPLIN,
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
    const gemischt = geseedetGemischt(spielbareTeams, n * 1_000_003 + runde);
    for (let i = 0; i + 1 < gemischt.length; i += 2) {
      const heim = gemischt[i]!;
      const gast = gemischt[i + 1]!;
      fixtureInputs.push({
        homeTeamId: heim.teamId,
        awayTeamId: gast.teamId,
        seed: `pps-referenz-auftritt:${n}:${runde}:${heim.teamId}:${gast.teamId}`,
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
  // In Batches, aus demselben Speichergrund wie Gewichthebens Skript (s. dortiger Kommentar).
  const BATCH_GROESSE = 20;
  const ergebnisse: Awaited<ReturnType<typeof runArenaFixtures>> = [];
  for (let start = 0; start < fixtureInputs.length; start += BATCH_GROESSE) {
    const batch = fixtureInputs.slice(start, start + BATCH_GROESSE);
    const batchErgebnisse = await runArenaFixtures(gameStateFuerLauf, batch, DISZIPLIN);
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

function schreibeErgebnis(
  ergebnisseNachGroesse: Map<number, FeldgroessenErgebnis>,
  quelle: { saveId: string; saveName: string },
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
    };
  }
  const ausgabe = {
    disziplin: DISZIPLIN,
    hinweis:
      "iMittel (Median) und iKrass (99,5.-Perzentil) DES ROHEN AUFTRITTSWERTS " +
      "(MOTOREN.showcase.wert() = u.summe, s. WERTUNG_AUFTRITT() in " +
      "public/mockups/battle-mode.engine.js), JE FELDGROESSE getrennt gezogen -- gebaut von " +
      "scripts/ziehe-showcase-pps-referenz.ts gegen echte Liga-Kader (buildArenaTeam()) ueber " +
      "runArenaFixtures()/spieleBuehneAuftritt(). Gelesen von " +
      "computeIndividualBoxscorePpsFromFixtureResults() in " +
      "lib/resolve/battle-mode-arena-team-points.ts. KATALOG-STANDARDGROESSE IST 5, NICHT 6 " +
      "(Discipline.playerCount in lib/data/dataAdapter.ts) -- nur der Fallback fuer eine nicht " +
      "ermittelbare Feldgroesse, s. Skript-Kopfkommentar. KLEINERE STICHPROBE ALS BASKETBALLS " +
      "REFERENZ (60 statt 300+ Fixtures je Feldgroesse) -- eine Zeitbudget-Entscheidung der " +
      "Erstziehung (06.09.2026), keine methodische. Neu ziehen nach jeder Aenderung, die den " +
      "rohen Auftrittswert verschiebt (BUEHNE_ART.showcase.rezept, WERTUNG_AUFTRITT(), " +
      "Kadergenerierung/Attributniveau der Liga).",
    gezogenAm: new Date().toISOString(),
    motorSha1: ermittleMotorSha1(),
    repoCommit: ermittleRepoCommit(),
    quelle: { ...quelle, mechanismus: "runArenaFixtures/spieleBuehneAuftritt gegen echte Liga-Kader (buildArenaTeam)" },
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
    schreibeErgebnis(ergebnisseNachGroesse, ersterInhalt.quelle);
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
  schreibeErgebnis(ergebnisseNachGroesse, quelle);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
