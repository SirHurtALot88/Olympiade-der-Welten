/* eslint-disable no-console */
/**
 * Laesst die KI-Teams ihr Kauffenster NACHTRAEGLICH organisch fahren — fuer Spielstaende, in denen
 * das Fenster schon gelaufen ist und aufgeraeumt werden musste.
 *
 * GEMELDET: „schau mal die neuen spieler bei N-N sind alles so filler … wir müssen die noch mal raus
 * nehmen im save und dann auch den korrekten lauf einmal durch laufen lassen organic picking" — und
 * danach die Frage, die dieses Skript noetig macht: „wie machen wir es denn dass die teams dann
 * kaufen? weil ich bin ja nun schon in S2?"
 *
 * DAS PROBLEM: das Kauffenster laeuft beim SAISONSTART
 * (`app/api/ai/preseason-background/route.ts`). Steht der Spielstand mitten in der Saison, feuert es
 * nicht mehr. Nimmt man dort die Fueller heraus, stehen die Teams mit Loechern im Kader und vollem
 * Konto da — und niemand kauft nach.
 *
 * WAS ES TUT: genau den Schritt, den die Preseason-Kette auch macht, und nur diesen —
 * `runTransferWindowSession` in der Phase `preseason` fuer die KI-Teams. Kein Fuell-Lauf (der ist ab
 * Saison 2 gesperrt, siehe `auto-roster-fill-service`), keine Manager-Aktionen, keine Verkaeufe.
 *
 * MANUELL GEFUEHRTE TEAMS BLEIBEN AUSSEN VOR. Die Teamliste kommt aus den `teamControlSettings`;
 * wer nicht auf `controlMode: "ai"` steht, wird nicht angefasst. Das ist dieselbe Grenze, die auch
 * Markt und Manager-Plan benutzen — und der Grund, warum es sie gibt: „S-C hat gekauft. das ist MEIN
 * TEAM."
 *
 * ES WIRD NICHTS GESCHRIEBEN, solange `--apply` fehlt. Ohne den Schalter laeuft der Kauf auf einer
 * KOPIE des Spielstands und es gibt nur den Bericht: wer haette was gekauft, fuer wie viel, und wie
 * die Kader danach dastuenden.
 *
 * Nutzung:
 *   npx tsx scripts/organischen-nachkauf-fahren.ts --save <saveId>            # nur Bericht
 *   npx tsx scripts/organischen-nachkauf-fahren.ts --save <saveId> --apply    # SCHREIBT
 *
 * REIHENFOLGE, die eingehalten werden MUSS:
 *   1. Container auf einen Stand bringen, der den Fuell-Lauf sperrt (ab 0.4.31).
 *   2. Fueller zuruecknehmen (`repair-auto-buys-am-saisonende.ts --nur-quelle ai_roster_fill`).
 *   3. Dieses Skript.
 * Andersherum kauft die alte Logik denselben Ramsch ein zweites Mal ein.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";
import { baueNachkaufSitzung, ermittleKiTeamIds } from "@/lib/ai/organischer-nachkauf-eingabe";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

import type { GameState } from "@/lib/data/olyDataTypes";

/** Qualitaetsstufe eines Zugangs am gezahlten Preis — die Stufen aus Chris' Vorgabe „stars, gute
 *  spieler und ergaenzungsspieler", damit der Bericht zeigt, ob wieder Fueller gekauft wurden. */
function stufe(preis: number): "stark" | "mittel" | "schwach" {
  if (preis >= 25) return "stark";
  if (preis >= 12) return "mittel";
  return "schwach";
}

function runde(wert: number) {
  return Number(wert.toFixed(2));
}

function parseArgs(argv: string[]) {
  let saveId: string | null = null;
  let apply = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") apply = true;
    else if (arg === "--save") saveId = argv[++i] ?? null;
  }
  return { saveId, apply };
}

function kaderBericht(gameState: GameState) {
  let unterMin = 0;
  let unterOpt = 0;
  let kleinster = Number.POSITIVE_INFINITY;
  for (const team of gameState.teams) {
    const anzahl = gameState.rosters.filter((entry) => entry.teamId === team.teamId).length;
    const ziel = deriveRosterTargets(
      team,
      gameState.teamIdentities.find((entry) => entry.teamId === team.teamId),
    );
    if (anzahl < ziel.playerMin) unterMin += 1;
    if (anzahl < ziel.playerOpt) unterOpt += 1;
    kleinster = Math.min(kleinster, anzahl);
  }
  return { kader: gameState.rosters.length, kleinster, unterMin, unterOpt };
}

async function main() {
  const { saveId: saveIdArg, apply } = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();

  const saveId = saveIdArg ?? persistence.getActiveSave()?.saveId ?? null;
  if (!saveId) {
    console.error("Kein Spielstand angegeben und kein aktiver gefunden. Bitte --save <saveId> nutzen.");
    process.exitCode = 1;
    return;
  }

  const start = persistence.getSaveById(saveId);
  if (!start) {
    console.error(`Spielstand ${saveId} nicht gefunden.`);
    process.exitCode = 1;
    return;
  }

  const seasonId = start.gameState.season.id;
  const vorher = kaderBericht(start.gameState);
  const bekannteTransfers = new Set((start.gameState.transferHistory ?? []).map((entry) => entry.id));

  const kiTeams = ermittleKiTeamIds(start.gameState);
  const menschlich = start.gameState.teams
    .filter((team) => !kiTeams.includes(team.teamId))
    .map((team) => `${team.name} (${team.shortCode})`);

  console.log(`\nSpielstand : ${saveId}`);
  console.log(`Saison     : ${seasonId} (${start.gameState.season.name}), Phase ${start.gameState.gamePhase ?? "?"}`);
  console.log(`Kader jetzt: ${vorher.kader} Spieler, kleinster ${vorher.kleinster}, ${vorher.unterMin} unter Min, ${vorher.unterOpt} unter Opt`);
  console.log(`KI-Teams   : ${kiTeams.length} von ${start.gameState.teams.length}`);
  if (menschlich.length > 0) console.log(`Nicht angefasst (menschlich gefuehrt): ${menschlich.join(", ")}`);

  if (!apply) {
    console.log(
      "\nNUR BERICHT — dieses Skript wuerde jetzt `runTransferWindowSession` in der Phase\n" +
        "`preseason` fuer die KI-Teams fahren. Der Kauf laesst sich nicht gefahrlos simulieren, ohne\n" +
        "ihn auszufuehren; deshalb steht hier nur, WAS liefe und fuer WEN.\n" +
        "Zum Anwenden denselben Aufruf mit --apply wiederholen (vorher ein Backup ueber\n" +
        "`deploy/hetzner/push-live-save.sh` sichern).",
    );
    return;
  }

  console.log("\nKauffenster laeuft ...");
  const sitzung = await runTransferWindowSession(
    baueNachkaufSitzung({ saveId, seasonId, persistence, kiTeamIds: kiTeams }),
  );

  if (sitzung.skipped) {
    console.error(
      "\nABGEBROCHEN: die Sitzung hat sich selbst uebersprungen und NICHTS gekauft." +
        (sitzung.warnings.length > 0 ? `\nGrund: ${sitzung.warnings.join(", ")}` : ""),
    );
    process.exitCode = 1;
    return;
  }
  if (sitzung.warnings.length > 0) {
    console.log(`\nHinweise der Sitzung: ${sitzung.warnings.slice(0, 8).join(", ")}`);
  }

  const ende = persistence.getSaveById(saveId)!.gameState;
  const neue = (ende.transferHistory ?? []).filter(
    (entry) => !bekannteTransfers.has(entry.id) && entry.transferType === "buy",
  );
  const verteilung = { stark: 0, mittel: 0, schwach: 0 } as Record<string, number>;
  for (const entry of neue) verteilung[stufe(entry.fee ?? 0)] += 1;
  const nachher = kaderBericht(ende);

  console.log("\n==============================================================================");
  console.log("ERLEDIGT");
  console.log(`  Zugaenge          : ${neue.length}`);
  console.log(`  Ausgegeben        : ${runde(neue.reduce((summe, entry) => summe + (entry.fee ?? 0), 0))} Mio`);
  console.log(`  davon stark/mittel/schwach: ${verteilung.stark}/${verteilung.mittel}/${verteilung.schwach}`);
  console.log(`  Kader             : ${vorher.kader} -> ${nachher.kader}`);
  console.log(`  unter Minimum     : ${vorher.unterMin} -> ${nachher.unterMin}`);
  console.log(`  unter Optimum     : ${vorher.unterOpt} -> ${nachher.unterOpt}`);
  console.log("==============================================================================\n");

  const fueller = neue.filter((entry) => String(entry.source) === "ai_roster_fill");
  if (fueller.length > 0) {
    console.log(
      `ACHTUNG: ${fueller.length} Zugaenge tragen die Quelle ai_roster_fill. Der Fuell-Lauf ist ab\n` +
        "Saison 2 gesperrt — taucht er hier auf, laeuft der Container auf einem zu alten Stand.\n" +
        "Dann diesen Spielstand zurueckrollen und erst neu bauen.",
    );
  }
}

void main();
