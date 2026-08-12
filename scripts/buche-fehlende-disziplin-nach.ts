/* eslint-disable no-console */
/**
 * BUCHT EINE FEHLENDE DISZIPLIN-SEITE EINES SPIELTAGS NACH.
 *
 * GEMELDET VON CHRIS: „hilfe ich hänge in MD4 fest und die spieltagsdaten werden anscheinend nicht
 * berechnet, er lässt mich den tag auf jeden fall nicht abschließen obwohl ich die punkte usw sehen
 * kann."
 *
 * BEFUND (am Live-Abbild gemessen, Save `new-game-1786465783606-0kalpx`, Saison 1, Spieltag 4):
 * Von den beiden geplanten Disziplinen war nur EINE gewertet — 32 `disciplineResults` für
 * `wettessen` (D1), null für `mini-dm` (D2). `getMatchdayScoringProgress` meldet deshalb
 * `completion: "partial"`, und der Spieltagswechsel blockt mit
 * `result_apply_incomplete_missing_d2_for_current_matchday`.
 *
 * DIE SPERRE IST RICHTIG UND WIRD HIER NICHT UMGANGEN. Sie steht seit dem Befund in
 * `matchday-progress-service.ts`: liesse man einen halben Spieltag durch, wäre D2 danach aus der
 * normalen Ansicht nicht mehr nachholbar, und alle Spieler, die in D2 standen, fehlten für diesen
 * Spieltag dauerhaft in `playerDisciplinePerformances` — sichtbar u. a. als zu niedriger
 * `appearances`-Wert in Moral und Gehaltsforderungen. Genau deshalb holt dieses Skript das nach,
 * was die Sperre erwartet, statt sie abzuschalten.
 *
 * WIE: über `runLocalMatchdayAutoRun` mit `commitThroughSide: "d2"` — derselbe Weg, den die Arena
 * geht. Sein Wiederaufnahme-Pfad kennt den Fall „D1 gebucht, D2 offen" ausdrücklich und überspringt
 * das Resolve NICHT (siehe `existingCommittedSides` dort). Nichts wird doppelt gebucht.
 *
 * SICHERHEITEN:
 *   - Standard ist der Trockenlauf. Geschrieben wird nur mit `--schreiben`.
 *   - Läuft nur gegen die Datenbank aus `OLY_APP_SQLITE_PATH`. Ohne die Variable bricht es ab.
 *   - Meldet vorher, welche Seite fehlt, und tut nichts, wenn beide schon gebucht sind.
 *   - `advanceAfterCashApply` bleibt AUS: dieses Skript bucht nur die fehlende Seite. Den
 *     Spieltagswechsel macht Chris danach wie immer im Spiel — die Sperre ist dann von selbst weg.
 *
 * Nutzung:
 *   OLY_APP_SQLITE_PATH=/app/data/persistence/oly-app.sqlite \
 *     npx tsx scripts/buche-fehlende-disziplin-nach.ts [--save <saveId>] [--matchday <id>] [--schreiben]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { runLocalMatchdayAutoRun, MATCHDAY_AUTO_RUN_CONFIRM_TOKEN } from "@/lib/season/matchday-auto-run-service";
import { getMatchdayScoringProgress } from "@/lib/season/season-discipline-schedule";

function parseArgs(argv: string[]) {
  let saveId: string | null = null;
  let matchdayId: string | null = null;
  let schreiben = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--save" && argv[i + 1]) {
      saveId = argv[i + 1]!;
      i += 1;
    } else if (argv[i] === "--matchday" && argv[i + 1]) {
      matchdayId = argv[i + 1]!;
      i += 1;
    } else if (argv[i] === "--schreiben") {
      schreiben = true;
    }
  }
  return { saveId, matchdayId, schreiben };
}

async function main() {
  const { saveId: gewaehlt, matchdayId: gewaehlterSpieltag, schreiben } = parseArgs(process.argv.slice(2));

  if (!process.env.OLY_APP_SQLITE_PATH) {
    console.error("OLY_APP_SQLITE_PATH ist nicht gesetzt.");
    process.exit(2);
    return;
  }

  const persistence = createPersistenceService();
  const save = gewaehlt ? persistence.getSaveById(gewaehlt) : persistence.getActiveSave();
  if (!save) {
    console.error("Kein Spielstand gefunden. --save <saveId> angeben oder OLY_APP_SQLITE_PATH prüfen.");
    process.exit(2);
    return;
  }

  const gameState = save.gameState;
  const seasonId = gameState.season.id;
  const matchdayId = gewaehlterSpieltag ?? gameState.matchdayState.matchdayId;

  console.log(`Datenbank  : ${process.env.OLY_APP_SQLITE_PATH}`);
  console.log(`Spielstand : ${save.saveId} — ${save.name}`);
  console.log(`Saison     : ${seasonId}, Spieltag ${matchdayId}`);
  console.log(`Modus      : ${schreiben ? "SCHREIBEN" : "Trockenlauf (es wird nichts geschrieben)"}`);

  const fortschritt = getMatchdayScoringProgress(gameState, matchdayId);
  console.log(`\nWERTUNGSSTAND: ${fortschritt.completion}`);
  console.log(
    `  D1: ${fortschritt.d1.disciplineId ?? "—"}  geplant=${fortschritt.d1.required}  gewertet=${fortschritt.d1.scored}`,
  );
  console.log(
    `  D2: ${fortschritt.d2.disciplineId ?? "—"}  geplant=${fortschritt.d2.required}  gewertet=${fortschritt.d2.scored}`,
  );

  if (fortschritt.completion === "complete") {
    console.log("\nBeide Seiten sind gebucht — nichts nachzuholen.");
    return;
  }
  if (fortschritt.completion === "none") {
    console.log(
      "\nEs ist noch GAR NICHTS gebucht — das ist kein Nachhol-Fall, sondern ein Spieltag, der noch bevorsteht.",
    );
    console.log("Hier bricht das Skript bewusst ab: den ganzen Spieltag fährt die Arena, nicht diese Reparatur.");
    return;
  }

  const fehlt = !fortschritt.d1.scored ? "D1" : "D2";
  console.log(`\nNACHZUBUCHEN: ${fehlt} (${(fehlt === "D1" ? fortschritt.d1 : fortschritt.d2).disciplineId ?? "—"})`);

  if (!schreiben) {
    console.log("\nTrockenlauf — es wurde nichts geschrieben. Mit --schreiben ausführen.");
    return;
  }

  const ergebnis = await runLocalMatchdayAutoRun(
    {
      source: "sqlite",
      saveId: save.saveId,
      seasonId,
      matchdayId,
      execute: true,
      dryRun: false,
      confirmToken: MATCHDAY_AUTO_RUN_CONFIRM_TOKEN,
      options: {
        commitThroughSide: "d2",
        // Der Spieltagswechsel gehoert Chris, nicht dieser Reparatur — sie holt nur die fehlende
        // Seite nach. Danach faellt die Sperre von selbst weg.
        advanceAfterCashApply: false,
      },
    },
    persistence,
  );

  console.log(`\nStatus: ${ergebnis.status}${ergebnis.ok ? "" : " (NICHT ok)"}`);
  if (ergebnis.blockingReasons.length > 0) {
    console.log("Blocker:");
    for (const grund of ergebnis.blockingReasons) console.log(`  - ${grund}`);
  }

  const danach = getMatchdayScoringProgress(persistence.getSaveById(save.saveId)!.gameState, matchdayId);
  console.log(`\nWERTUNGSSTAND DANACH: ${danach.completion}`);
  console.log(`  D1 gewertet=${danach.d1.scored}   D2 gewertet=${danach.d2.scored}`);
  if (danach.completion === "complete") {
    console.log("\nFERTIG — der Spieltag laesst sich jetzt im Spiel normal abschliessen.");
  } else {
    console.log("\nNoch nicht vollstaendig. Die Blocker oben nennen den Grund.");
  }
}

void main();
