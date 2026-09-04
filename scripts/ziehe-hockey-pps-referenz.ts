// ===================================================================================
// HOCKEY-PPS-REFERENZ AUS DEM LIVE-SAVE-ABBILD ZIEHEN
//
// Hockey-Analogon zu scripts/ziehe-basketball-pps-referenz.ts und
// scripts/ziehe-gewichtheben-pps-referenz.ts (dort ausfuehrlich begruendet -- hier nur die
// Unterschiede). Auftrag: docs/design/hockey-produktivierung.md Schritt 1.
//
// `computeIndividualBoxscorePpsFromFixtureResults()` (lib/resolve/battle-mode-arena-team-points.ts)
// braucht `iMittel` (Median) und `iKrass` (99,5.-Perzentil) des rohen Boxscore-Werts
// (`MOTOREN.hockey.wert()` = `feldspielWert(u,"hockey")`, battle-mode.engine.js).
//
// ZWEI GETRENNTE REFERENZEN, JE ROLLE (`feldgroessen` fuer Feldspieler, `feldgroessenTorwart`
// fuer den Torwart) -- ANDERS ALS BASKETBALL/GEWICHTHEBEN, EMPIRISCH BEGRUENDET (nicht aus dem
// Bauch, s. Auftrag docs/design/hockey-produktivierung.md): Hockeys Torwart-Wertformel
// (HK_TW_BASIS/HK_TW_REF, battle-mode.engine.js) ist auf EINEN Feldspieler-Mittelwert kalibriert,
// nicht auf jede Feldgroesse -- bei wenigen Feldspielern teilen sich diese denselben "Kuchen" an
// Punkten/Assists auf weniger Koepfe (deutlich hoeherer Medianwert je Spieler), waehrend der
// Torwart-Median unabhaengig von der Feldspielerzahl ungefaehr gleich bleibt. Gemessen (04.09.):
// bei n=3 liegt der Feldspieler-Median WEIT UEBER dem Torwart-Median (22,4 gegen 8,4 -- eine
// gemeinsame Referenz haette den Torwart systematisch unterbezahlt), bei n=6 ist es GENAU
// UMGEKEHRT (Feld 6,84 gegen Torwart 10,22 -- eine gemeinsame Referenz haette jeden
// durchschnittlichen Torwart ueberdurchschnittlich aussehen lassen, exakt die Art systematischer
// Verzerrung, die die Impact-Kurve eigentlich vermeiden soll). ALLE FUENF Feldgroessen kommen
// real vor, keine ist "die" Standardgroesse: Hockeys `Discipline.playerCount` im Katalog ist
// zwar 5, aber die tatsaechlich gewuerfelte Feldgroesse einer Saison liegt gleichverteilt
// zwischen 2 und 6 (jede der vier Fuenfer-Kategorien -- Hockey steht in "power" -- bekommt eine
// Permutation von [2,3,4,5,6] zugeteilt, s. `buildSeasonPlayerCountByDiscipline()` in
// lib/season/season-discipline-schedule.ts). Volle Zahlen/Herleitung:
// docs/design/hockey-produktivierung.md.
//
// WARUM EIN EXPLIZITER TORWART-SLOT NOETIG IST (statt wie bei Basketball/Gewichtheben einfach die
// besten n nach Disziplin-Eignung durchzureichen): Hockey kennt ab `n>=3` GENAU EINEN Torwart je
// Seite (`bestimmeTorwaerter()`, battle-mode.engine.js -- bei `n===2` bleibt das Tor leer, Chris
// woertlich: "im 2er spiel da gibts nur verteidiger und angreifer"). Ohne eine ECHTE
// Aufstellungs-Zuweisung (`u.slotGesetzt && TORWART_SLOTS.has(u.slotId)`) faellt der Motor auf
// seinen eigenen Ruecfall zurueck: der Spieler mit dem hoechsten PARADE-Wert IM TEAM wird Torwart
// -- PARADE ist aber ein motor-internes, aus `mische()` berechnetes Sub-Skill (Rezept:
// health*0,45+awareness*0,30+dexterity*0,15+will*0,10, battle-mode.rezepte.js), das dieses Skript
// von aussen nicht kennt und deshalb nicht zuverlaessig vorhersagen kann, WER im Ergebnis Torwart
// wurde -- die Rollentrennung braeuchte sonst Raten statt Wissen.
//
// Dieses Skript reserviert deshalb je Team den Spieler mit der besten NAEHERUNG an PARADE (dieselbe
// Gewichtsformel auf den rohen Attributbogen, ohne Klassen-/Rassen-/Form-Bonus -- eine Naeherung,
// aber nah genug fuer eine plausible Manager-Wahl) explizit fuer den Torwart-Slot (Index 2) und
// setzt die uebrigen n-1 (bzw. n bei n=2) Plaetze mit den besten Feldspielern nach Hockey-Eignung
// -- Slot-Indizes 0,1,3,4,5,6 (Index 2 bleibt dem Torwart vorbehalten, s. `FELD_SLOT_INDIZES`
// unten). Der Motor bekommt dadurch eine ECHTE, deterministische Zuweisung
// (`gewaehlt=team.find(u=>u.slotGesetzt&&u.slotId&&TORWART_SLOTS.has(u.slotId))` trifft sicher),
// UND (seit derselben Aenderung) reicht `window.__arena.spieleFeldspiel()`s Boxscore selbst ein
// `torwart`-Feld durch (s. battle-mode.engine.js) -- `ArenaFixtureBoxscoreEintrag.torwart`
// (arena-headless-runner.ts) macht die Rollen-Zuordnung damit eine reine Feldabfrage, kein
// zweites Raten ueber die selbst gebaute Aufstellung noetig (dieses Skript nutzt trotzdem die
// SELBST GEBAUTE `playerId`-Zuordnung als zweite, unabhaengige Bestaetigung, s.
// `torwartIdNachTeam` unten -- schadet nicht, mehr Sicherheit fuer eine Referenz-Ziehung).
//
// AUFRUF (nach dem ueblichen Weg an den Spielstand, s. CLAUDE.md "An die Spielstaende kommen"):
//
//   git fetch origin live-save
//   git show origin/live-save:data/online-saves/hetzner-live.sqlite.gz > /tmp/abbild.gz
//   gunzip -c /tmp/abbild.gz > /tmp/abbild.sqlite
//   OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/ziehe-hockey-pps-referenz.ts
//
// Ohne Argumente zieht das Skript ALLE fuenf Feldgroessen (2..6) NACHEINANDER und schreibt direkt
// data/generated/hockey-pps-referenz.json. `--feldgroesse=<n>` (Teil-Stand) und `--merge`
// funktionieren wie bei den beiden Vorlagen.
//
// KLEINERE STICHPROBE ALS BASKETBALL, WIE BEI GEWICHTHEBEN (60 statt 300+ Fixtures je
// Feldgroesse) -- dieselbe Zeitbudget-Entscheidung der Erstziehung, s. Skript-Kopfkommentar dort.
// FUER DIE TORWART-SEITE ZUSAETZLICH DUENN: nur 1 Torwart je Team und Fixture gegen 5 (bei n=6)
// Feldspieler -- 128 Torwart-Werte gegen 640 Feldspieler-Werte bei 64 Fixtures. p99,5 ist fuer den
// Torwart entsprechend weniger stabil geschaetzt; eine spaetere, groessere Nachziehung ist ohne
// Code-Aenderung moeglich, sobald mehr Rechenzeit zur Verfuegung steht.
// ===================================================================================
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createSaveRepository } from "@/lib/persistence/save-repository";
import { listeArenaTeams, buildArenaTeam, type ArenaSpieler } from "@/lib/foundation/battle-arena/arena-kader-adapter";
import { runArenaFixtures, type ArenaFixtureResult } from "@/lib/battle/arena-headless-runner";

import type { GameState, LineupDraft, LineupDraftEntry } from "@/lib/data/olyDataTypes";

const DISZIPLIN = "hockey";
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ZIEL_DATEI = path.join(WURZEL, "data/generated/hockey-pps-referenz.json");
const partialDatei = (n: number) => path.join(WURZEL, `data/generated/hockey-pps-referenz.partial-${n}.json`);

const FELDGROESSEN = [2, 3, 4, 5, 6] as const;
// S. Dateikopf-Kommentar ("KLEINERE STICHPROBE ALS BASKETBALL") -- 60 statt Basketballs 300+ je
// Feldgroesse, dieselbe Zeitbudget-Entscheidung wie bei Gewichtheben.
const FIXTURES_ZIEL = 60;
const PAARUNGEN_JE_RUNDE = 16; // 32 Teams / 2

// Slot-Index 2 ("goaltender" in DISCIPLINE_ROLE_THEMES.hockey) ist dem Torwart vorbehalten --
// diese Liste ist die Reihenfolge, in der die uebrigen Feldspieler-Plaetze befuellt werden.
// Ab n=6 werden alle sechs gebraucht (0,1,3,4,5,6), bei kleinerem n nur ein Praefix davon.
const FELD_SLOT_INDIZES = [0, 1, 3, 4, 5, 6] as const;
const TORWART_SLOT_INDEX = 2;

// NAEHERUNG AN DAS MOTOR-INTERNE PARADE-REZEPT (battle-mode.rezepte.js:
// PARADE:{health:45,awareness:30,dexterity:15,will:10}) auf dem rohen Attributbogen, OHNE
// Klassen-/Rassen-/Form-Bonus (den nur der Motor selbst via `mische()` kennt) -- s.
// Dateikopf-Kommentar fuer die Begruendung, warum eine Naeherung hier reicht.
function paradeNaeherung(spieler: ArenaSpieler): number {
  const a = spieler.a;
  return (a.health ?? 0) * 0.45 + (a.awareness ?? 0) * 0.3 + (a.dexterity ?? 0) * 0.15 + (a.will ?? 0) * 0.1;
}

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

function quantilTabelle(werte: readonly number[]): Record<string, number> {
  const sortiert = [...werte].sort((a, b) => a - b);
  const tabelle: Record<string, number> = {};
  for (const p of [0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 0.995, 0.999]) {
    tabelle[`p${p * 100}`.replace(".", "_")] = Math.round(quantil(sortiert, p) * 100) / 100;
  }
  return tabelle;
}

type FeldgroessenErgebnis = {
  n: number;
  fixtures: number;
  spielerwerte: number;
  iMittel: number;
  iKrass: number;
  quantile: Record<string, number>;
};

function baueFeldgroessenErgebnis(n: number, fixtures: number, werte: readonly number[]): FeldgroessenErgebnis {
  const sortiert = [...werte].sort((a, b) => a - b);
  return {
    n,
    fixtures,
    spielerwerte: sortiert.length,
    iMittel: Math.round(median(sortiert) * 100) / 100,
    iKrass: Math.round(quantil(sortiert, 0.995) * 100) / 100,
    quantile: quantilTabelle(sortiert),
  };
}

/** Baut fuer EIN Team die Aufstellung dieser Feldgroesse -- s. Dateikopf-Kommentar. */
function baueTeamAufstellung(
  kader: ArenaSpieler[],
  n: number,
): { entries: LineupDraftEntry[]; torwartId: string | null } {
  if (n < 3) {
    // Kein Torwart moeglich (Chris' Regel, s. Dateikopf-Kommentar) -- einfach die besten n nach
    // Hockey-Eignung, wie bei Basketball/Gewichtheben.
    const top = [...kader].sort((a, b) => (b.d[DISZIPLIN] ?? 0) - (a.d[DISZIPLIN] ?? 0)).slice(0, n);
    const entries = top.map((spieler, index) => ({
      disciplineId: DISZIPLIN,
      disciplineSide: "d1" as const,
      slotIndex: FELD_SLOT_INDIZES[index]!,
      playerId: spieler.id,
      activePlayerId: null,
    }));
    return { entries, torwartId: null };
  }

  const torwart = [...kader].sort((a, b) => paradeNaeherung(b) - paradeNaeherung(a))[0]!;
  const feldPool = kader.filter((spieler) => spieler.id !== torwart.id);
  const feldTop = [...feldPool].sort((a, b) => (b.d[DISZIPLIN] ?? 0) - (a.d[DISZIPLIN] ?? 0)).slice(0, n - 1);

  const entries: LineupDraftEntry[] = [
    { disciplineId: DISZIPLIN, disciplineSide: "d1", slotIndex: TORWART_SLOT_INDEX, playerId: torwart.id, activePlayerId: null },
    ...feldTop.map((spieler, index) => ({
      disciplineId: DISZIPLIN,
      disciplineSide: "d1" as const,
      slotIndex: FELD_SLOT_INDIZES[index]!,
      playerId: spieler.id,
      activePlayerId: null,
    })),
  ];
  return { entries, torwartId: torwart.id };
}

async function zieheFeldgroesse(
  gameState: GameState,
  saveId: string,
  n: number,
): Promise<{ feld: FeldgroessenErgebnis; torwart: FeldgroessenErgebnis | null }> {
  const matchdayId = `pps-referenz-probe-${n}`;
  const teams = listeArenaTeams(gameState);

  const kaderNachTeam = new Map(teams.map((team) => [team.teamId, buildArenaTeam(gameState, team.teamId)] as const));
  const spielbareTeams = teams.filter((team) => (kaderNachTeam.get(team.teamId)?.length ?? 0) >= n);
  if (spielbareTeams.length < 2) {
    throw new Error(`ziehe-hockey-pps-referenz: keine zwei Teams mit >= ${n} einsatzfaehigen Spielern gefunden.`);
  }

  // Zweite, unabhaengige Bestaetigung der Rollen-Zuordnung neben `eintrag.torwart` (s.
  // Dateikopf-Kommentar) -- diese Referenz-Ziehung darf sich keinen Zuordnungsfehler leisten.
  const torwartIdNachTeam = new Map<string, string | null>();
  const lineupDrafts: LineupDraft[] = spielbareTeams.map((team) => {
    const kader = kaderNachTeam.get(team.teamId)!;
    const { entries, torwartId } = baueTeamAufstellung(kader, n);
    torwartIdNachTeam.set(team.teamId, torwartId);
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
        seed: `pps-referenz-hockey:${n}:${runde}:${heim.teamId}:${gast.teamId}`,
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
  // In Batches, aus demselben Speichergrund wie Basketballs/Gewichthebens Skript.
  const BATCH_GROESSE = 20;
  const ergebnisse: ArenaFixtureResult[] = [];
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

  const feldWerte: number[] = [];
  const torwartWerte: number[] = [];
  let zuordnungAbweichung = 0;
  for (const ergebnis of ergebnisse) {
    const torwartHeim = torwartIdNachTeam.get(ergebnis.homeTeamId) ?? null;
    const torwartGast = torwartIdNachTeam.get(ergebnis.awayTeamId) ?? null;
    for (const eintrag of ergebnis.boxscore) {
      const selbstGebautTorwart =
        eintrag.playerId != null && (eintrag.playerId === torwartHeim || eintrag.playerId === torwartGast);
      if (!!eintrag.torwart !== selbstGebautTorwart) zuordnungAbweichung += 1;
      if (eintrag.torwart) torwartWerte.push(eintrag.wert);
      else feldWerte.push(eintrag.wert);
    }
  }
  if (zuordnungAbweichung > 0) {
    // Sollte nie passieren (s. Dateikopf-Kommentar) -- ein Abweichen hiesse, dass die Motor-
    // eigene `torwart`-Kennzeichnung (bestimmeTorwaerter()) NICHT auf den explizit gesetzten
    // Aufstellungs-Slot getroffen hat. Kein Abbruch (die Ziehung bleibt gueltig, sie nutzt
    // `eintrag.torwart` als Quelle der Wahrheit), aber laut genug fuer eine Nachschau.
    console.warn(
      `  n=${n}: WARNUNG -- ${zuordnungAbweichung} Boxscore-Eintraege, bei denen die Motor-Kennzeichnung ` +
        "(eintrag.torwart) von der selbst gebauten Aufstellungs-Zuordnung abweicht.",
    );
  }

  const feld = baueFeldgroessenErgebnis(n, fixtureInputs.length, feldWerte);
  const torwart = torwartWerte.length > 0 ? baueFeldgroessenErgebnis(n, fixtureInputs.length, torwartWerte) : null;
  console.log(
    `  n=${n}: Feld Median ${feld.iMittel} (n=${feld.spielerwerte}), p99,5 ${feld.iKrass}` +
      (torwart ? `; Torwart Median ${torwart.iMittel} (n=${torwart.spielerwerte}), p99,5 ${torwart.iKrass}.` : "; kein Torwart bei dieser Feldgroesse."),
  );

  return { feld, torwart };
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
  feldNachGroesse: Map<number, FeldgroessenErgebnis>,
  torwartNachGroesse: Map<number, FeldgroessenErgebnis | null>,
  quelle: { saveId: string; saveName: string },
) {
  const feldgroessen: Record<string, unknown> = {};
  const feldgroessenTorwart: Record<string, unknown> = {};
  for (const n of FELDGROESSEN) {
    const feld = feldNachGroesse.get(n);
    if (feld) feldgroessen[String(n)] = feld;
    const torwart = torwartNachGroesse.get(n);
    if (torwart) feldgroessenTorwart[String(n)] = torwart;
  }
  const ausgabe = {
    disziplin: DISZIPLIN,
    hinweis:
      "iMittel (Median) und iKrass (99,5.-Perzentil) DES ROHEN BOXSCORE-WERTS (MOTOREN.hockey.wert() " +
      "= feldspielWert(u,\"hockey\"), s. battle-mode.engine.js), JE FELDGROESSE UND JE ROLLE getrennt " +
      "gezogen -- `feldgroessen` fuer Feldspieler, `feldgroessenTorwart` fuer den Torwart (n=2 hat " +
      "keinen Torwart, s. Chris' Regel im Skript-Kopfkommentar). EMPIRISCH ALS NOETIG BEFUNDEN " +
      "(nicht aus dem Bauch): der Feldspieler- und der Torwart-Median liegen je Feldgroesse " +
      "unterschiedlich weit auseinander und WECHSELN SOGAR DIE RICHTUNG -- s. " +
      "docs/design/hockey-produktivierung.md fuer die volle Herleitung/Zahlen. Torwart-Zuordnung " +
      "ueber das Motor-eigene `torwart`-Feld im Boxscore (battle-mode.engine.js, " +
      "spieleFeldspiel()), gegengeprueft gegen einen explizit gesetzten Aufstellungs-Slot (Index 2, " +
      "'goaltender'), gewaehlt per PARADE-Naeherung auf dem rohen Attributbogen -- s. " +
      "Skript-Kopfkommentar. Gebaut von scripts/ziehe-hockey-pps-referenz.ts gegen echte Liga-Kader " +
      "(buildArenaTeam()) ueber runArenaFixtures()/spieleFeldspiel(). Gelesen von " +
      "computeIndividualBoxscorePpsFromFixtureResults() in lib/resolve/battle-mode-arena-team-points.ts " +
      "(ueber resolveArenaPpsReferenz(disciplineId, playerCount, rolle)). KLEINERE STICHPROBE ALS " +
      "BASKETBALLS REFERENZ (60 statt 300+ Fixtures je Feldgroesse) -- dieselbe Zeitbudget-" +
      "Entscheidung wie bei Gewichtheben, keine methodische -- UND ZUSAETZLICH DUENN FUER DIE " +
      "TORWART-SEITE (nur 1 Torwart je Team und Fixture gegen mehrere Feldspieler, s. " +
      "`spielerwerte`). Neu ziehen nach jeder Aenderung, die den rohen Boxscore-Wert verschiebt " +
      "(feldspielWert()/HK_*-Konstanten, BUEHNE_ART.hockey.rezept, Kadergenerierung/" +
      "Attributniveau der Liga).",
    gezogenAm: new Date().toISOString(),
    motorSha1: ermittleMotorSha1(),
    repoCommit: ermittleRepoCommit(),
    quelle: { ...quelle, mechanismus: "runArenaFixtures/spieleFeldspiel gegen echte Liga-Kader (buildArenaTeam)" },
    fixturesJeFeldgroesse: FIXTURES_ZIEL,
    feldgroessen,
    feldgroessenTorwart,
  };
  writeFileSync(ZIEL_DATEI, JSON.stringify(ausgabe, null, 1));
  console.log(`Geschrieben: ${ZIEL_DATEI}`);
}

async function main() {
  const args = process.argv.slice(2);
  const feldgroesseArg = args.find((a) => a.startsWith("--feldgroesse="));
  const mergeModus = args.includes("--merge");

  if (mergeModus) {
    const feldNachGroesse = new Map<number, FeldgroessenErgebnis>();
    const torwartNachGroesse = new Map<number, FeldgroessenErgebnis | null>();
    const fehlend: number[] = [];
    for (const n of FELDGROESSEN) {
      const datei = partialDatei(n);
      if (!existsSync(datei)) {
        fehlend.push(n);
        continue;
      }
      const inhalt = JSON.parse(readFileSync(datei, "utf8")) as {
        feld: FeldgroessenErgebnis;
        torwart: FeldgroessenErgebnis | null;
        quelle: { saveId: string; saveName: string };
      };
      feldNachGroesse.set(n, inhalt.feld);
      torwartNachGroesse.set(n, inhalt.torwart);
    }
    if (fehlend.length > 0) {
      console.error(`Fehlende Teil-Staende fuer Feldgroesse(n): ${fehlend.join(", ")} -- zuerst mit --feldgroesse=<n> ziehen.`);
      process.exit(1);
    }
    const ersterInhalt = JSON.parse(readFileSync(partialDatei(FELDGROESSEN[0]), "utf8")) as {
      quelle: { saveId: string; saveName: string };
    };
    schreibeErgebnis(feldNachGroesse, torwartNachGroesse, ersterInhalt.quelle);
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
    const { feld, torwart } = await zieheFeldgroesse(gameState, kopf.saveId, n);
    writeFileSync(partialDatei(n), JSON.stringify({ quelle, feld, torwart }, null, 1));
    console.log(`Teil-Stand geschrieben: ${partialDatei(n)}`);
    return;
  }

  const feldNachGroesse = new Map<number, FeldgroessenErgebnis>();
  const torwartNachGroesse = new Map<number, FeldgroessenErgebnis | null>();
  for (const n of FELDGROESSEN) {
    const { feld, torwart } = await zieheFeldgroesse(gameState, kopf.saveId, n);
    feldNachGroesse.set(n, feld);
    torwartNachGroesse.set(n, torwart);
  }
  schreibeErgebnis(feldNachGroesse, torwartNachGroesse, quelle);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
