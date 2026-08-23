/**
 * FUELLT KADER AUF, DIE EIN ABGEBROCHENER KAUFLAUF ZURUECKGELASSEN HAT.
 *
 * ANLASS (Chris): „schau mal warum die KI nicht nachkauft - es gab ein problem beim saisonstart …
 * ich musste dann auf ki picken manuell noch mal klicken vllt ist da schon was kaputt gewesen und
 * einige teams haben dann nur minimum an playern!"
 *
 * URSACHE (behoben in `lib/ai/ai-transfer-window-session-service.ts`): die Sperre
 * `skipIfExistingMarketTransfers` fragte „existiert IRGENDEIN Transfer dieser Saison?" und stieg
 * dann fuer die GANZE LIGA aus. Ein Lauf, der auf halber Strecke stehenblieb, galt damit als
 * erledigt — auch fuer die Teams, die noch nichts hatten.
 *
 * DER CODE IST REPARIERT, ABER EIN BESTEHENDER SPIELSTAND HOLT DAS NICHT VON SELBST NACH: die
 * Kaeufe passieren im Kauffenster, und das ist fuer diese Saison durch. Dieses Skript holt genau
 * diesen einen Lauf nach — ueber DENSELBEN Produktionspfad, den das Spiel selbst nimmt
 * (`runTransferWindowSession`, organischer Builder). Es baut keine eigene Kauflogik: alles, was
 * dort an Kasse, Gehaltsdecke, Identitaet und Kaderzielen haengt, gilt hier unveraendert.
 *
 * ES WIRD NICHTS GESCHRIEBEN, solange `--apply` fehlt. Ohne den Schalter gibt es nur den Bericht:
 * welche Teams stehen wie weit unter ihrem Ziel, und was wuerde der Lauf tun.
 *
 * MENSCHLICH GESTEUERTE TEAMS BLEIBEN AUSSEN VOR. Das ist keine Nebenbemerkung, sondern ein eigener
 * Vorfall gewesen („Wieso wird fuer mich gepickt und gedraftet???") — der Kader gehoert dem Spieler.
 *
 * Nutzung:
 *   npx tsx scripts/repair-kader-auffuellen.ts                    # nur Bericht (aktiver Spielstand)
 *   npx tsx scripts/repair-kader-auffuellen.ts --save <saveId>    # anderer Spielstand
 *   npx tsx scripts/repair-kader-auffuellen.ts --apply            # SCHREIBT (Sicherung vorher)
 *
 * Auf dem Server nicht von Hand starten, sondern:
 *   bash deploy/hetzner/kader-auffuellen.sh            (Bericht)
 *   bash deploy/hetzner/kader-auffuellen.sh --apply    (schreibt, mit Sicherung und Rueckweg)
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import fs from "node:fs";
import path from "node:path";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { runTransferWindowSession } from "@/lib/ai/ai-transfer-window-session-service";
import { getTeamOptTarget } from "@/lib/ai/ai-market-plan-convergence-service";
import { getTeamControlSettings } from "@/lib/foundation/team-control-settings";
import type { GameState } from "@/lib/data/olyDataTypes";

function argWert(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

function kaderGroessen(gameState: GameState): Map<string, number> {
  const zaehler = new Map<string, number>();
  for (const eintrag of gameState.rosters) {
    zaehler.set(eintrag.teamId, (zaehler.get(eintrag.teamId) ?? 0) + 1);
  }
  return zaehler;
}

type Zeile = {
  teamId: string;
  code: string;
  kader: number;
  ziel: number;
  luecke: number;
  cash: number;
};

function unterZiel(gameState: GameState): Zeile[] {
  const kader = kaderGroessen(gameState);
  return gameState.teams
    .filter((team) => {
      const modus =
        getTeamControlSettings(gameState, team.teamId)?.controlMode ??
        (team.humanControlled ? "manual" : "ai");
      return modus === "ai";
    })
    .map((team) => {
      const groesse = kader.get(team.teamId) ?? 0;
      const ziel = getTeamOptTarget(gameState, team.teamId);
      return {
        teamId: team.teamId,
        code: team.shortCode ?? team.teamId,
        kader: groesse,
        ziel,
        luecke: ziel - groesse,
        cash: team.cash ?? 0,
      };
    })
    .filter((zeile) => zeile.luecke > 0)
    .sort((links, rechts) => rechts.luecke - links.luecke);
}

function berichte(titel: string, zeilen: Zeile[]): void {
  console.log(`\n${titel}`);
  if (zeilen.length === 0) {
    console.log("   (keines)");
    return;
  }
  console.log("   Team  | Kader | Ziel | fehlt | Cash Mio");
  for (const zeile of zeilen) {
    console.log(
      `   ${zeile.code.padEnd(5)} | ${String(zeile.kader).padStart(5)} | ${String(zeile.ziel).padStart(4)} | ` +
        `${String(zeile.luecke).padStart(5)} | ${zeile.cash.toFixed(1).padStart(8)}`,
    );
  }
  console.log(
    `   ${zeilen.length} Team(s), ${zeilen.reduce((summe, zeile) => summe + zeile.luecke, 0)} fehlende Spieler.`,
  );
}

async function main(): Promise<void> {
  const schreiben = process.argv.includes("--apply");
  const persistence = createPersistenceService();
  const saveId = argWert("--save");
  const kopf = saveId ? persistence.getSaveById(saveId) : persistence.getActiveSave();
  if (!kopf?.gameState) {
    throw new Error("Kein Spielstand gefunden.");
  }
  const vorher = kopf.gameState as GameState;
  console.log(`Spielstand ${kopf.saveId} · ${vorher.season.id} · ${vorher.matchdayState?.matchdayId ?? "—"}`);
  console.log(`Kadereintraege gesamt: ${vorher.rosters.length}`);

  const luecken = unterZiel(vorher);
  berichte("KI-Teams unter ihrer Zielgroesse:", luecken);

  if (luecken.length === 0) {
    console.log("\nNichts zu tun — kein KI-Team steht unter seinem Ziel.");
    return;
  }

  if (!schreiben) {
    console.log("\nTROCKENLAUF — es wurde nichts geschrieben.");
    console.log("Mit `--apply` wird der Kauflauf tatsaechlich gefahren (vorher sichern!).");
    return;
  }

  // SICHERUNG NEBEN DIE DATENBANK, nicht ins Arbeitsverzeichnis.
  //
  // Auf dem Server laeuft dieses Skript in einem WEGWERF-Container (`docker compose run --rm`).
  // Alles, was dort unter `/app` landet und nicht im Volume liegt, ist nach dem Lauf weg — die
  // Sicherung waere also genau dann verschwunden, wenn man sie braucht, und der Pfad in der
  // Ausgabe zeigte ins Leere. `OLY_APP_SQLITE_PATH` zeigt auf die Datei IM Volume; daneben
  // ueberlebt die Sicherung den Container. Ohne gesetzten Pfad (lokaler Aufruf) bleibt es beim
  // Arbeitsverzeichnis.
  const sqlitePfad = process.env.OLY_APP_SQLITE_PATH ?? "";
  const sicherungsDir = sqlitePfad
    ? path.join(path.dirname(sqlitePfad), "save-backups")
    : path.join(process.cwd(), "data", "save-backups");
  fs.mkdirSync(sicherungsDir, { recursive: true });
  const sicherungsPfad = path.join(
    sicherungsDir,
    `${kopf.saveId}-vor-kader-auffuellen-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  fs.writeFileSync(sicherungsPfad, JSON.stringify(kopf, null, 2));
  console.log(`\nSicherung geschrieben: ${sicherungsPfad}`);

  console.log("\nKauflauf laeuft (derselbe Weg wie im Spiel) ...");
  const begonnen = Date.now();
  const sitzung = await runTransferWindowSession({
    saveId: kopf.saveId,
    seasonId: vorher.season.id,
    persistence,
    phase: "preseason",
    dryRun: false,
    teamScope: "ai",
    allowBuys: true,
    // Ausdruecklich die Teams nennen, die der Bericht oben zeigt. Die Sperre schneidet zusaetzlich
    // auf die noch unerledigten zu — ein Team, das inzwischen am Ziel ist, kauft also nicht doppelt.
    targetTeamIds: luecken.map((zeile) => zeile.teamId),
    progressLog: false,
  });
  console.log(`Fertig in ${((Date.now() - begonnen) / 1000).toFixed(1)}s.`);
  console.log(`   Ligarunden ${sitzung.leagueRounds} · Teamzyklen ${sitzung.teamCycles}`);
  if (sitzung.skipped) {
    console.log("   HINWEIS: Die Sitzung hat sich uebersprungen — kein Team stand mehr offen.");
  }
  for (const grund of sitzung.blockingReasons.slice(0, 10)) {
    console.log(`   BLOCK ${grund}`);
  }

  const nachher = persistence.getSaveById(kopf.saveId)?.gameState as GameState | undefined;
  if (!nachher) {
    throw new Error("Spielstand nach dem Lauf nicht lesbar.");
  }
  const kaderVorher = kaderGroessen(vorher);
  const kaderNachher = kaderGroessen(nachher);
  let dazu = 0;
  console.log("\nVeraenderte Teams:");
  for (const team of nachher.teams) {
    const alt = kaderVorher.get(team.teamId) ?? 0;
    const neu = kaderNachher.get(team.teamId) ?? 0;
    if (neu !== alt) {
      dazu += neu - alt;
      console.log(`   ${(team.shortCode ?? team.teamId).padEnd(5)} ${alt} -> ${neu}`);
    }
  }
  console.log(`\nSpieler dazugekommen: ${dazu}`);
  berichte("Danach noch unter Ziel:", unterZiel(nachher));
  console.log(`\nRueckweg: die Sicherung liegt unter ${sicherungsPfad}`);
}

main().catch((fehler) => {
  console.error(fehler);
  process.exitCode = 1;
});
