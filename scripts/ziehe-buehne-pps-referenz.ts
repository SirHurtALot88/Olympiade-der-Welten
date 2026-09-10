// ===================================================================================
// BUEHNEN-PPS-REFERENZ AUS DEM LIVE-SAVE-ABBILD ZIEHEN — GENERISCH FUER MEHRERE DISZIPLINEN
//
// Auftrag: PRODUKTIVIERUNGSWELLE 2 (docs/pm-briefings/opus-overseer-plan-naechste-disziplinen-09-09.md,
// Abschnitt 4). Fuenf weitere Buehnen-Disziplinen (Eiskunstlauf, Breaking, Wettessen, Tennis,
// Fechten) werden arena-aufgeloest — alle fuenf ueber die BEIDEN BEREITS BESTEHENDEN
// Buehnen-Chassis (`spieleBuehneAuftritt()` / `spieleBuehneDuell()`, aus Welle 1), ohne eine
// einzige neue Motor-Funktion.
//
// WARUM EIN GENERISCHES SKRIPT STATT FUENF KOPIEN. Die drei Skripte aus Welle 1
// (`ziehe-gewichtheben-pps-referenz.ts`, `ziehe-showcase-pps-referenz.ts`,
// `ziehe-speed-schach-pps-referenz.ts`) sind untereinander bereits zu ueber 95 % wortgleich —
// nachgemessen, nicht geschaetzt: der Diff zwischen dem Showcase- und dem Speed-Schach-Skript
// besteht, Kommentare abgezogen, aus GENAU SECHS geaenderten Stellen (Disziplins-Konstante,
// zwei Dateipfade, ein Fehlertext, ein Seed-Praefix, die Hinweistexte der Ausgabe). Fuenf
// weitere Kopien haetten rund 1650 Zeilen reine Duplikation ergeben — mit dem bekannten
// Folgerisiko, dass eine kuenftige methodische Korrektur (z.B. an `FIXTURES_ZIEL` oder an der
// Quantil-Berechnung) in acht Dateien nachgezogen werden muesste und dabei eine vergessen wird.
// Dieses Skript zieht die Unterschiede stattdessen in EINE Tabelle (`DISZIPLINEN` unten).
//
// DIE DREI SKRIPTE AUS WELLE 1 BLEIBEN UNANGETASTET. Sie sind in der Provenienz der bereits
// gezogenen JSON-Dateien namentlich genannt (`hinweis`-Feld) und in mehreren Kommentaren in
// `lib/resolve/battle-mode-arena-team-points.ts` referenziert — sie hier einzuschmelzen waere
// eine zweite, unabhaengige Aenderung mit eigenem Risiko und gehoert nicht in diese Welle.
// Die METHODE ist identisch (dieselbe `FIXTURES_ZIEL`-Zahl, dieselbe Paarungs-/Seed-Mechanik,
// dieselben Quantile), damit die Referenzen aus Welle 1 und Welle 2 vergleichbar bleiben.
//
// MECHANISMUS (unveraendert aus Welle 1): `buildArenaTeam()` liefert den echten Kader jedes
// Teams, die besten `n` Spieler nach Disziplin-Eignung (`d[disziplin]`) werden ueber eine
// synthetische `LineupDraft`-Aufstellung fest in den Disziplin-Slot gesetzt,
// `runArenaFixtures()` simuliert echte Duelle/Auftritte gegen echte Liga-Kader (nicht gegen den
// Demokader des Mockups).
//
// VORAUSSETZUNG: die Disziplin muss BEREITS in ihrer Chassis-Menge stehen
// (`ARENA_BUEHNE_AUFTRITT_DISCIPLINE_IDS` bzw. `ARENA_BUEHNE_DUELL_DISCIPLINE_IDS`,
// lib/battle/arena-headless-runner.ts) — sonst ruft `runArenaFixtures()` `spieleFeldspiel()`
// auf und scheitert mit "lieferte null". Sie muss dagegen NOCH NICHT in
// `ARENA_RESOLVED_DISCIPLINE_IDS`/`ARENA_IMPACT_KONFIG_JE_DISZIPLIN` stehen: dieses Skript
// importiert `battle-mode-arena-team-points.ts` bewusst NICHT (nachgesehen — auch
// `arena-headless-runner.ts` und `arena-kader-adapter.ts` importieren es nicht), damit die
// Referenz gezogen werden kann, BEVOR der Eintrag existiert, der genau diese Referenz-Datei
// importieren wird. Ohne diese Reihenfolge gaebe es ein Henne-Ei-Problem: der Fail-Fast beim
// Modul-Laden von `battle-mode-arena-team-points.ts` verlangt einen Impact-Konfig-Eintrag, der
// eine noch nicht existierende JSON-Datei importiert.
//
// AUFRUF (nach dem ueblichen Weg an den Spielstand, s. CLAUDE.md "An die Spielstaende kommen"):
//
//   git fetch origin live-save
//   git show origin/live-save:data/online-saves/hetzner-live.sqlite.gz > /tmp/abbild.gz
//   gunzip -c /tmp/abbild.gz > /tmp/abbild.sqlite
//   OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/ziehe-buehne-pps-referenz.ts eiskunstlauf
//
// Ohne weitere Argumente zieht das Skript ALLE fuenf Feldgroessen (2..6) nacheinander und
// schreibt direkt `data/generated/<disziplin>-pps-referenz.json`. `--feldgroesse=<n>` zieht nur
// eine (Teil-Stand `<disziplin>-pps-referenz.partial-<n>.json`), `--merge` fuehrt die
// Teil-Staende zusammen — beides wie in den Welle-1-Skripten.
// ===================================================================================
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createSaveRepository } from "@/lib/persistence/save-repository";
import { listeArenaTeams, buildArenaTeam } from "@/lib/foundation/battle-arena/arena-kader-adapter";
import { runArenaFixtures } from "@/lib/battle/arena-headless-runner";

import type { GameState, LineupDraft, LineupDraftEntry } from "@/lib/data/olyDataTypes";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * DIE EINZIGE STELLE, AN DER SICH DIE FUENF DISZIPLINEN UEBERHAUPT UNTERSCHEIDEN.
 *
 * `katalogStandardgroesse` ist `Discipline.playerCount` aus `lib/data/dataAdapter.ts` — JE
 * DISZIPLIN EINZELN NACHGESEHEN, nicht von einer Vorlage kopiert (genau der Fehler, vor dem die
 * Kommentare in `ARENA_IMPACT_KONFIG_JE_DISZIPLIN` warnen; die Motor-Feldgroesse
 * `BUEHNE_ART[d].jeSeite` ist fuer alle fuenf 6 und waere der falsche Wert). Sie landet
 * unveraendert in `ARENA_IMPACT_KONFIG_JE_DISZIPLIN.katalogStandardgroesse` und ist NUR der
 * Rueckfall fuer einen Spieltag ohne ermittelbare Feldgroesse — die tatsaechlich gewuerfelte
 * Feldgroesse liegt fuer jede der zwanzig Disziplinen gleichverteilt zwischen 2 und 6
 * (`buildSeasonPlayerCountByDiscipline()`), deshalb zieht dieses Skript trotzdem alle fuenf.
 *
 * `chassis` dient hier NUR der Dokumentation im `hinweis`-Feld der Ausgabe und der
 * Plausibilitaetspruefung unten — welche Browser-Funktion wirklich gerufen wird, entscheidet
 * allein die Chassis-Mengen-Zugehoerigkeit in `arena-headless-runner.ts` (s. dortiger
 * Kommentar: "NUR DIESE MENGE ENTSCHEIDET").
 */
const DISZIPLINEN = {
  eiskunstlauf: {
    chassis: "auftritt",
    katalogStandardgroesse: 3,
    wertHerkunft: "MOTOREN.eiskunstlauf.wert() = u.summe, s. WERTUNG_AUFTRITT()",
    rezeptOrt: "BUEHNE_ART.eiskunstlauf.rezept, WERTUNG_AUFTRITT()",
  },
  breaking: {
    chassis: "auftritt",
    katalogStandardgroesse: 4,
    wertHerkunft: "MOTOREN.breaking.wert() = u.summe, s. WERTUNG_AUFTRITT()",
    rezeptOrt: "BUEHNE_ART.breaking.rezept, WERTUNG_AUFTRITT()",
  },
  wettessen: {
    chassis: "auftritt",
    katalogStandardgroesse: 5,
    wertHerkunft: "MOTOREN.wettessen.wert() = u.summe, s. WERTUNG_AUFTRITT()",
    rezeptOrt: "BUEHNE_ART.wettessen.rezept, WERTUNG_AUFTRITT()",
  },
  tennis: {
    chassis: "duell",
    katalogStandardgroesse: 3,
    wertHerkunft: "MOTOREN.tennis.wert() = u.summe, s. WERTUNG_DUELL()",
    rezeptOrt: "BUEHNE_ART.tennis.rezept, WERTUNG_DUELL()",
  },
  fechten: {
    chassis: "duell",
    katalogStandardgroesse: 5,
    wertHerkunft: "MOTOREN.fechten.wert() = u.summe, s. WERTUNG_DUELL()",
    rezeptOrt: "BUEHNE_ART.fechten.rezept, WERTUNG_DUELL()",
  },
  // ====================== BAHN-PRODUKTIVIERUNG (10.09., Ziel 3 Abschnitt 6.3c) ======================
  // VIERTES CHASSIS, `chassis:"bahn"` -- `window.__arena.spieleBahn()` statt der beiden Buehnen-
  // Funktionen oben. `wertHerkunft` dokumentiert HIER bewusst `bahnTeamstand().punkte`, NICHT
  // `MOTOREN[bd].wert()`: der rohe Boxscore-Wert, den `spieleBahn()` tatsaechlich liefert, kommt aus
  // `bahnTeamstand().punkte` (ordnungsidentische, nicht-negative Zwillingsgroesse -- s. Kommentar an
  // `spieleBahn()` in battle-mode.engine.js), weil `MOTOREN[bd].wert()` fuer Rang/Etappe NEGATIVE
  // Zahlen liefert und die Impact-Kurve daraus fuer jeden Bahn-Laeufer 0 PPs machen wuerde.
  // `katalogStandardgroesse` EINZELN in lib/data/dataAdapter.ts nachgesehen, NICHT `BAHN_ART[d].
  // jeSeite` (Motor-Feldgroesse, hier der falsche Wert) -- staffel 3, spurt 2, takeshis-castle 4,
  // time-trial 4, keine ist 6.
  staffel: {
    chassis: "bahn",
    katalogStandardgroesse: 3,
    wertHerkunft: "bahnTeamstand().punkte, wertung:\"etappe\" -- Rang der Etappenleistung (bahnLeistung), s. spieleBahn()",
    rezeptOrt: "BAHN_ART.staffel, stepSpurt()/bauSpurt()",
  },
  spurt: {
    chassis: "bahn",
    katalogStandardgroesse: 2,
    wertHerkunft: "bahnTeamstand().punkte, wertung:\"rang\" -- Rangpunkte aus bahnRangliste(), s. spieleBahn()",
    rezeptOrt: "BAHN_ART.spurt, stepSpurt()/bauSpurt()",
  },
  "takeshis-castle": {
    chassis: "bahn",
    katalogStandardgroesse: 4,
    wertHerkunft: "bahnTeamstand().punkte, wertung:\"burg\" -- burgwertung() je Laeufer, s. spieleBahn()",
    rezeptOrt: "BAHN_ART[\"takeshis-castle\"], stepSpurt()/bauSpurt()",
  },
  "time-trial": {
    chassis: "bahn",
    katalogStandardgroesse: 4,
    wertHerkunft: "bahnTeamstand().punkte, wertung:\"rang\" -- Rangpunkte aus bahnRangliste(), s. spieleBahn()",
    rezeptOrt: "BAHN_ART[\"time-trial\"], stepSpurt()/bauSpurt()",
  },
} as const;

type DisziplinId = keyof typeof DISZIPLINEN;

const FELDGROESSEN = [2, 3, 4, 5, 6] as const;
// UNVERAENDERT AUS WELLE 1 (s. dortige Skripte, "KLEINERE STICHPROBE ALS BASKETBALL"): dieselbe
// Zeitbudget-Entscheidung, damit die Referenzen beider Wellen methodisch vergleichbar bleiben.
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

async function zieheFeldgroesse(
  disziplin: DisziplinId,
  gameState: GameState,
  saveId: string,
  n: number,
): Promise<FeldgroessenErgebnis> {
  const matchdayId = `pps-referenz-probe-${n}`;
  const teams = listeArenaTeams(gameState);

  const kaderNachTeam = new Map(teams.map((team) => [team.teamId, buildArenaTeam(gameState, team.teamId)] as const));
  const spielbareTeams = teams.filter((team) => (kaderNachTeam.get(team.teamId)?.length ?? 0) >= n);
  if (spielbareTeams.length < 2) {
    throw new Error(
      `ziehe-buehne-pps-referenz (${disziplin}): keine zwei Teams mit >= ${n} einsatzfaehigen Spielern gefunden.`,
    );
  }

  const lineupDrafts: LineupDraft[] = spielbareTeams.map((team) => {
    const kader = kaderNachTeam.get(team.teamId)!;
    const top = [...kader].sort((a, b) => (b.d[disziplin] ?? 0) - (a.d[disziplin] ?? 0)).slice(0, n);
    const entries: LineupDraftEntry[] = top.map((spieler, index) => ({
      disciplineId: disziplin,
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
        // Disziplins-eigenes Praefix (Welle 1 nutzte ein Chassis-Praefix): zwei Disziplinen
        // desselben Chassis bekommen dadurch unabhaengige Saaten statt derselben.
        seed: `pps-referenz-${disziplin}:${n}:${runde}:${heim.teamId}:${gast.teamId}`,
      });
    }
  }

  const gameStateFuerLauf: GameState = {
    ...gameState,
    matchdayState: { ...(gameState.matchdayState ?? {}), matchdayId },
    seasonState: { ...gameState.seasonState, lineupDrafts },
  };

  console.log(
    `  ${disziplin} n=${n}: ${fixtureInputs.length} Fixtures ueber ${runden} Runden, ` +
      `${spielbareTeams.length} Teams -- das dauert...`,
  );
  const t0 = Date.now();
  // In Batches, aus demselben Speichergrund wie in den Welle-1-Skripten (s. dortige Kommentare).
  const BATCH_GROESSE = 20;
  const ergebnisse: Awaited<ReturnType<typeof runArenaFixtures>> = [];
  for (let start = 0; start < fixtureInputs.length; start += BATCH_GROESSE) {
    const batch = fixtureInputs.slice(start, start + BATCH_GROESSE);
    const batchErgebnisse = await runArenaFixtures(gameStateFuerLauf, batch, disziplin);
    ergebnisse.push(...batchErgebnisse);
    console.log(
      `  ${disziplin} n=${n}: ${ergebnisse.length}/${fixtureInputs.length} Fixtures fertig ` +
        `(${((Date.now() - t0) / 1000).toFixed(0)} s bisher)`,
    );
  }
  const dauerS = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(
    `  ${disziplin} n=${n}: fertig nach ${dauerS} s (${(Number(dauerS) / fixtureInputs.length).toFixed(2)} s/Fixture).`,
  );

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
    return execSync("sha1sum public/mockups/battle-mode.engine.js", { cwd: WURZEL, encoding: "utf8" })
      .trim()
      .split(/\s+/)[0]!;
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

const zielDatei = (d: DisziplinId) => path.join(WURZEL, `data/generated/${d}-pps-referenz.json`);
const partialDatei = (d: DisziplinId, n: number) =>
  path.join(WURZEL, `data/generated/${d}-pps-referenz.partial-${n}.json`);

function schreibeErgebnis(
  disziplin: DisziplinId,
  ergebnisseNachGroesse: Map<number, FeldgroessenErgebnis>,
  quelle: { saveId: string; saveName: string },
) {
  const konfig = DISZIPLINEN[disziplin];
  const motorFunktion =
    konfig.chassis === "bahn" ? "spieleBahn" : konfig.chassis === "duell" ? "spieleBuehneDuell" : "spieleBuehneAuftritt";
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
    disziplin,
    hinweis:
      `iMittel (Median) und iKrass (99,5.-Perzentil) DES ROHEN BUEHNEN-WERTS (${konfig.wertHerkunft} ` +
      "in public/mockups/battle-mode.engine.js), JE FELDGROESSE getrennt gezogen -- gebaut von " +
      `scripts/ziehe-buehne-pps-referenz.ts gegen echte Liga-Kader (buildArenaTeam()) ueber ` +
      `runArenaFixtures()/${motorFunktion}(). Gelesen von ` +
      "computeIndividualBoxscorePpsFromFixtureResults() in " +
      `lib/resolve/battle-mode-arena-team-points.ts. KATALOG-STANDARDGROESSE IST ` +
      `${konfig.katalogStandardgroesse}, NICHT 6 (Discipline.playerCount in lib/data/dataAdapter.ts; ` +
      "BUEHNE_ART[d].jeSeite im Motor ist 6, das ist die MOTOR-Feldgroesse und der falsche Wert " +
      "dafuer) -- nur der Fallback fuer eine nicht ermittelbare Feldgroesse, s. Skript-Kopfkommentar. " +
      "KLEINERE STICHPROBE ALS BASKETBALLS REFERENZ (60 statt 300+ Fixtures je Feldgroesse) -- " +
      "unveraendert dieselbe Zeitbudget-Entscheidung wie in Produktivierungswelle 1 (06.09.2026), " +
      "keine methodische. Neu ziehen nach jeder Aenderung, die den rohen Wert verschiebt " +
      `(${konfig.rezeptOrt}, Kadergenerierung/Attributniveau der Liga).`,
    gezogenAm: new Date().toISOString(),
    motorSha1: ermittleMotorSha1(),
    repoCommit: ermittleRepoCommit(),
    quelle: {
      ...quelle,
      mechanismus: `runArenaFixtures/${motorFunktion} gegen echte Liga-Kader (buildArenaTeam)`,
    },
    fixturesJeFeldgroesse: FIXTURES_ZIEL,
    feldgroessen,
  };
  writeFileSync(zielDatei(disziplin), JSON.stringify(ausgabe, null, 1));
  console.log(`Geschrieben: ${zielDatei(disziplin)}`);
}

async function main() {
  const args = process.argv.slice(2);
  const disziplin = args.find((a) => !a.startsWith("--")) as DisziplinId | undefined;
  if (!disziplin || !(disziplin in DISZIPLINEN)) {
    console.error(
      `Erstes Argument muss eine dieser Disziplinen sein: ${Object.keys(DISZIPLINEN).join(", ")} -- bekam ${disziplin ?? "nichts"}.`,
    );
    process.exit(1);
  }
  const feldgroesseArg = args.find((a) => a.startsWith("--feldgroesse="));
  const mergeModus = args.includes("--merge");

  if (mergeModus) {
    const ergebnisseNachGroesse = new Map<number, FeldgroessenErgebnis>();
    const fehlend: number[] = [];
    for (const n of FELDGROESSEN) {
      const datei = partialDatei(disziplin, n);
      if (!existsSync(datei)) {
        fehlend.push(n);
        continue;
      }
      const inhalt = JSON.parse(readFileSync(datei, "utf8")) as {
        ergebnis: FeldgroessenErgebnis;
        quelle: { saveId: string; saveName: string };
      };
      ergebnisseNachGroesse.set(n, inhalt.ergebnis);
    }
    if (fehlend.length > 0) {
      console.error(`Fehlende Teil-Staende fuer Feldgroesse(n): ${fehlend.join(", ")} -- zuerst mit --feldgroesse=<n> ziehen.`);
      process.exit(1);
    }
    const ersterInhalt = JSON.parse(readFileSync(partialDatei(disziplin, FELDGROESSEN[0]), "utf8")) as {
      quelle: { saveId: string; saveName: string };
    };
    schreibeErgebnis(disziplin, ergebnisseNachGroesse, ersterInhalt.quelle);
    for (const n of FELDGROESSEN) unlinkSync(partialDatei(disziplin, n));
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
  console.log(`Disziplin: ${disziplin} (Chassis "${DISZIPLINEN[disziplin].chassis}")`);
  console.log(`Quelle: ${quelle.saveName} (${quelle.saveId})`);

  if (feldgroesseArg) {
    const n = Number(feldgroesseArg.split("=")[1]);
    if (!FELDGROESSEN.includes(n as (typeof FELDGROESSEN)[number])) {
      console.error(`--feldgroesse muss eine von ${FELDGROESSEN.join(", ")} sein, bekam ${feldgroesseArg}.`);
      process.exit(1);
    }
    const ergebnis = await zieheFeldgroesse(disziplin, gameState, kopf.saveId, n);
    writeFileSync(partialDatei(disziplin, n), JSON.stringify({ quelle, ergebnis }, null, 1));
    console.log(`Teil-Stand geschrieben: ${partialDatei(disziplin, n)}`);
    return;
  }

  const ergebnisseNachGroesse = new Map<number, FeldgroessenErgebnis>();
  for (const n of FELDGROESSEN) {
    ergebnisseNachGroesse.set(n, await zieheFeldgroesse(disziplin, gameState, kopf.saveId, n));
  }
  schreibeErgebnis(disziplin, ergebnisseNachGroesse, quelle);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
