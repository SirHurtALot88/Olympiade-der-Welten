/* eslint-disable no-console */
/**
 * IST DAS SAVE-ABBILD AKTUELL — ODER FEHLT DIE WAL?
 *
 * DIESES SKRIPT GIBT ES WEGEN EINES KONKRETEN BEINAHE-UNFALLS.
 *
 * Ein Abbild vom Branch `live-save` wurde analysiert, ein Spielstand darauf repariert und zum
 * Einspielen bereitgelegt. Chris sah in seinem Browser aber drei Spieler und ein Cash, die im
 * Abbild nicht vorkamen. Die Rechnung ging exakt auf: die drei Spieler kosteten zusammen 90,55 —
 * genau die Differenz zwischen dem Cash im Abbild (91,32) und dem auf seinem Schirm (0,8).
 *
 * Der Browser hatte recht, das Abbild war veraltet. Grund: die App laeuft mit `journal_mode = WAL`.
 * Frische Schreibvorgaenge liegen in `oly-app.sqlite-wal`, bis ein Checkpoint sie einarbeitet.
 * `push-live-save.sh` kopierte nur die Hauptdatei — und meldete dabei Erfolg. Der Push lief alle
 * zehn Minuten und lieferte trotzdem einen Stand von vor eineinhalb Tagen.
 *
 * Waere die Reparatur eingespielt worden, haette sie den Fortschritt seit diesem Zeitpunkt
 * geloescht. Das Sicherungs-Skript haette brav gesichert und trotzdem Schaden angerichtet.
 *
 * DESHALB: vor jeder Arbeit an einem Abbild diese Pruefung. Sie vergleicht, wann der Snapshot
 * gepusht wurde, mit dem juengsten `updated_at` der Spielstaende darin. Klaffen die weit
 * auseinander, fehlt mit hoher Wahrscheinlichkeit die WAL.
 *
 * Nutzung:
 *   OLY_APP_SQLITE_PATH=/pfad/zum/abbild.sqlite \
 *     npx tsx scripts/pruefe-save-abbild-frische.ts --gepusht "2026-08-06T19:50:06Z"
 *
 * `--gepusht` ist der Commit-Zeitpunkt des Abbilds:
 *   git log -1 --format=%cI origin/live-save
 *
 * Ohne `--gepusht` wird gegen die aktuelle Zeit geprueft (grober, aber besser als nichts).
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { getDatabase, getDatabasePath } from "@/lib/persistence/sqlite";

/**
 * Ab wann gilt der Abstand als verdaechtig?
 *
 * SQLite macht von sich aus einen Checkpoint, sobald die WAL rund 1000 Seiten gross ist — bei
 * regem Spielbetrieb also durchaus im Minutentakt. Eine Stunde Abstand kann trotzdem harmlos sein
 * (niemand hat gespielt). Sechs Stunden sind es nicht mehr: entweder wurde wirklich lange nicht
 * gespielt, oder der Snapshot ist blind. Beides will man wissen, bevor man etwas repariert.
 */
const WARNSCHWELLE_STUNDEN = 6;

function parseArgs(argv: string[]) {
  let gepusht: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--gepusht" && argv[i + 1]) {
      gepusht = argv[i + 1];
      i += 1;
    }
  }
  return { gepusht };
}

function main() {
  const { gepusht } = parseArgs(process.argv.slice(2));
  const bezug = gepusht ? new Date(gepusht) : new Date();
  if (Number.isNaN(bezug.getTime())) {
    console.error(`--gepusht ist kein lesbares Datum: ${gepusht}`);
    process.exit(2);
    return;
  }

  const zeilen = getDatabase()
    .prepare("SELECT save_id, name, updated_at FROM saves ORDER BY updated_at DESC")
    .all() as Array<{ save_id: string; name: string; updated_at: string }>;

  if (zeilen.length === 0) {
    console.error("Keine Spielstaende in diesem Abbild.");
    process.exit(2);
    return;
  }

  console.log(`Abbild   : ${getDatabasePath()}`);
  console.log(`Gepusht  : ${bezug.toISOString()}${gepusht ? "" : "  (angenommen: jetzt)"}`);
  console.log(`Staende  : ${zeilen.length}`);
  console.log("");

  const juengste = new Date(zeilen[0].updated_at);
  const abstandStunden = (bezug.getTime() - juengste.getTime()) / 3_600_000;

  for (const zeile of zeilen.slice(0, 5)) {
    const alter = (bezug.getTime() - new Date(zeile.updated_at).getTime()) / 3_600_000;
    console.log(`  ${zeile.name.slice(0, 44).padEnd(44)} zuletzt geschrieben vor ${alter.toFixed(1)} h`);
  }

  console.log("");
  console.log("------------------------------------------------------------------");
  if (abstandStunden > WARNSCHWELLE_STUNDEN) {
    console.log(`ACHTUNG — der juengste Schreibvorgang liegt ${abstandStunden.toFixed(1)} Stunden vor dem Push.`);
    console.log("");
    console.log("Wahrscheinlichste Ursache: dem Snapshot fehlt die WAL. `push-live-save.sh` auf dem");
    console.log("Server hat dann keinen `wal_checkpoint(TRUNCATE)` vor dem Kopieren — pruefen mit:");
    console.log("    grep -c wal_checkpoint deploy/hetzner/push-live-save.sh");
    console.log("");
    console.log("KEINE REPARATUR AUF DIESEM ABBILD BAUEN. Sie wuerde beim Einspielen alles loeschen,");
    console.log("was seit dem letzten Checkpoint gespielt wurde. Erst einen Stand MIT WAL holen:");
    console.log("    <auf dem Server> deploy/hetzner/push-live-save.sh");
    console.log("------------------------------------------------------------------");
    process.exit(1);
  }

  console.log(`Abbild sieht frisch aus (juengster Schreibvorgang ${abstandStunden.toFixed(1)} h vor dem Push).`);
  console.log("------------------------------------------------------------------");
}

main();
