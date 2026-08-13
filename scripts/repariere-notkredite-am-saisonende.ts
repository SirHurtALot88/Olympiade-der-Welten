/* eslint-disable no-console */
/**
 * NIMMT DIE ZWANGS-NOTKREDITE DER SAISONABRECHNUNG AUS EINEM SPIELSTAND ZURÜCK.
 *
 * Die Begründung, die Erkennungsmerkmale und der Nachweis, dass die Rücknahme exakt ist, stehen in
 * `lib/finance/notkredit-ruecknahme.ts`. Dieses Skript ist nur die Bedienung dazu.
 *
 * SICHERHEITEN:
 *   - Standard ist der Trockenlauf: rechnen, Vorher/Nachher zeigen, nichts schreiben. Geschrieben
 *     wird nur mit `--schreiben`.
 *   - Läuft nur gegen die Datenbank, auf die `OLY_APP_SQLITE_PATH` zeigt — bitte auf eine KOPIE
 *     zeigen lassen (siehe CLAUDE.md, Branch `live-save`). Ohne die Variable bricht das Skript ab.
 *   - Bank-Kredite derselben Saison, die die Merkmale NICHT erfüllen, werden mit Grund ausgewiesen,
 *     damit sichtbar ist, was bewusst stehen bleibt.
 *
 * Nutzung:
 *   OLY_APP_SQLITE_PATH=/pfad/zur/kopie.sqlite \
 *     npx tsx scripts/repariere-notkredite-am-saisonende.ts [--save <saveId>] [--schreiben]
 *
 * Zurück auf den Server danach NUR über `deploy/hetzner/pull-repaired-save.sh` — von Hand kopieren
 * zerlegt die Datenbank, weil die WAL-Datei zum alten Stand gehört (siehe CLAUDE.md).
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { planeNotkreditRuecknahme } from "@/lib/finance/notkredit-ruecknahme";

function parseArgs(argv: string[]) {
  let saveId: string | null = null;
  let schreiben = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--save" && argv[i + 1]) {
      saveId = argv[i + 1]!;
      i += 1;
    } else if (argv[i] === "--schreiben") {
      schreiben = true;
    } else if (argv[i] === "--trocken") {
      schreiben = false;
    }
  }
  return { saveId, schreiben };
}

function spalte(text: string | number, breite: number) {
  return String(text).padStart(breite);
}

function main() {
  const { saveId: gewaehlt, schreiben } = parseArgs(process.argv.slice(2));

  if (!process.env.OLY_APP_SQLITE_PATH) {
    console.error(
      "OLY_APP_SQLITE_PATH ist nicht gesetzt. Bitte auf eine KOPIE des Spielstands zeigen lassen — nicht auf die laufende Datenbank.",
    );
    process.exit(2);
    return;
  }

  const persistence = createPersistenceService();
  const start = gewaehlt ? persistence.getSaveById(gewaehlt) : persistence.getActiveSave();
  if (!start) {
    console.error("Kein Spielstand gefunden. --save <saveId> angeben oder OLY_APP_SQLITE_PATH prüfen.");
    process.exit(2);
    return;
  }

  const gameState = start.gameState;
  console.log(`Datenbank  : ${process.env.OLY_APP_SQLITE_PATH}`);
  console.log(`Spielstand : ${start.saveId} — ${start.name}`);
  console.log(`Saison     : ${gameState.season.id}, Spieltag ${gameState.season.currentMatchday}`);
  console.log(`Modus      : ${schreiben ? "SCHREIBEN" : "Trockenlauf (es wird nichts geschrieben)"}`);

  const plan = planeNotkreditRuecknahme(gameState);

  if (plan.behalten.length > 0) {
    console.log(`\nBLEIBEN STEHEN (Bank-Kredite derselben Saison, aber kein Zwangs-Notkredit):`);
    for (const eintrag of plan.behalten) {
      console.log(`  ${eintrag.teamId.padEnd(6)} ${eintrag.loanId} — ${eintrag.grund}`);
    }
  }

  if (plan.zeilen.length === 0) {
    console.log("\nNichts zu tun: dieser Spielstand trägt keine Zwangs-Notkredite aus der Saisonabrechnung.");
    return;
  }

  const teamNamen = new Map(gameState.teams.map((team) => [team.teamId, team.name]));
  console.log(`\nZURÜCKZUNEHMEN — ${plan.zeilen.length} Notkredit(e), zusammen ${plan.summe.toFixed(1)}:`);
  console.log(`  ${"Team".padEnd(24)}${spalte("Kredit", 9)}${spalte("Cash vorher", 13)}${spalte("Cash nachher", 14)}`);
  for (const zeile of plan.zeilen) {
    console.log(
      `  ${(teamNamen.get(zeile.teamId) ?? zeile.teamId).padEnd(24)}${spalte(zeile.principal.toFixed(1), 9)}${spalte(zeile.cashVorher.toFixed(1), 13)}${spalte(zeile.cashNachher.toFixed(1), 14)}`,
    );
  }

  const nachher = plan.gameStateRepariert!;
  console.log(`\nLIGA-BILD:`);
  console.log(
    `  Teams auf exakt 0,0 : ${gameState.teams.filter((team) => team.cash === 0).length} → ${nachher.teams.filter((team) => team.cash === 0).length}`,
  );
  console.log(
    `  Teams im Minus      : ${gameState.teams.filter((team) => team.cash < 0).length} → ${nachher.teams.filter((team) => team.cash < 0).length}`,
  );
  console.log(
    `  Kredite gesamt      : ${(gameState.seasonState.loans ?? []).length} → ${(nachher.seasonState.loans ?? []).length}`,
  );

  if (!schreiben) {
    console.log("\nTrockenlauf — es wurde nichts geschrieben. Mit --schreiben ausführen, um zu übernehmen.");
    return;
  }

  persistence.saveSingleplayerState(start.saveId, nachher);
  console.log(`\nGeschrieben: ${plan.zeilen.length} Notkredit(e) über ${plan.summe.toFixed(1)} zurückgenommen.`);
  console.log("Zurück auf den Server NUR über deploy/hetzner/pull-repaired-save.sh (WAL-Falle, siehe CLAUDE.md).");
}

main();
