/**
 * ZIEHT DIE SAISONSTAND-PUNKTE EINER LAUFENDEN SAISON AUF DEN GEBUCHTEN LEDGER-STAND.
 *
 * Der Befund, die Messung und die Sicherungen stehen in
 * `lib/standings/saisonstand-punkte-nachbuchung.ts` — kurz: der Mutator-Aufschlag fehlte in
 * `standings[team].points`, das dreht Plaetze, und die Buchung ist ab jetzt geheilt. Dieses Skript
 * ist der Weg fuer die Spieltage, die VOR dem Fix gebucht wurden.
 *
 * SICHERHEITEN:
 *   - Standard ist der Trockenlauf: rechnen, Vorher/Nachher zeigen, nichts schreiben.
 *     Geschrieben wird nur mit `--schreiben`.
 *   - Laeuft nur gegen die Datenbank, auf die `OLY_APP_SQLITE_PATH` zeigt — bitte auf eine KOPIE
 *     zeigen lassen (siehe CLAUDE.md, Branch `live-save`). Ohne die Variable bricht das Skript ab.
 *   - Ist der Spielstand beschnitten (Disziplin-Ergebnisse fehlen), wird NICHTS geschrieben,
 *     sondern der Grund genannt.
 *
 * Nutzung:
 *   OLY_APP_SQLITE_PATH=/pfad/zur/kopie.sqlite \
 *     npx tsx scripts/repariere-saisonstand-punkte.ts [--save <saveId>] [--alle] [--schreiben]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { zieheSaisonstandPunkteNach } from "@/lib/standings/saisonstand-punkte-nachbuchung";

function parseArgs(argv: string[]) {
  let saveId: string | null = null;
  let schreiben = false;
  let alle = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--save" && argv[i + 1]) {
      saveId = argv[i + 1]!;
      i += 1;
    } else if (argv[i] === "--schreiben") {
      schreiben = true;
    } else if (argv[i] === "--trocken") {
      schreiben = false;
    } else if (argv[i] === "--alle") {
      alle = true;
    }
  }
  return { saveId, schreiben, alle };
}

function zahl(value: number | null | undefined): string {
  return value == null ? "—" : value.toFixed(1);
}

function main() {
  if (!process.env.OLY_APP_SQLITE_PATH) {
    console.error(
      "OLY_APP_SQLITE_PATH ist nicht gesetzt. Bitte auf eine KOPIE des Spielstands zeigen lassen —\n" +
        "dieses Skript schreibt mit --schreiben in genau diese Datei.",
    );
    process.exit(2);
    return;
  }

  const { saveId: gewaehlt, schreiben, alle } = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();

  const saveIds = alle
    ? persistence.listSaves().map((eintrag) => eintrag.saveId)
    : [gewaehlt ?? persistence.getActiveSave()?.saveId ?? null].filter((id): id is string => id != null);

  if (saveIds.length === 0) {
    console.error("Kein Spielstand gefunden. --save <saveId> oder --alle angeben.");
    process.exit(2);
    return;
  }

  console.log(`Abbild : ${process.env.OLY_APP_SQLITE_PATH}`);
  console.log(`Modus  : ${schreiben ? "SCHREIBEN" : "Trockenlauf (nichts wird geschrieben)"}\n`);

  for (const id of saveIds) {
    const save = persistence.getSaveById(id);
    if (!save) {
      console.log(`${id}: nicht ladbar — uebersprungen.\n`);
      continue;
    }

    const seasonId = save.gameState.season.id;
    console.log(
      `── ${save.saveId} — ${save.name}\n` +
        `   Saison ${seasonId}, Spieltag ${save.gameState.season.currentMatchday}, Phase ${save.gameState.gamePhase}`,
    );

    const ergebnis = zieheSaisonstandPunkteNach(save.gameState, seasonId);
    if (ergebnis.uebersprungen != null) {
      console.log(`   Nicht nachgebucht: ${ergebnis.uebersprungen}.\n`);
      continue;
    }
    if (ergebnis.geaenderteTeams.length === 0) {
      console.log("   Stimmt bereits — nichts nachzuziehen.\n");
      continue;
    }

    console.log("   Team    Punkte alt →    neu   Differenz   Rang alt → neu");
    let rangwechsel = 0;
    for (const aenderung of [...ergebnis.geaenderteTeams].sort((l, r) => r.punkteNachher - l.punkteNachher)) {
      const differenz = aenderung.punkteNachher - (aenderung.punkteVorher ?? 0);
      if (aenderung.rangVorher !== aenderung.rangNachher) rangwechsel += 1;
      console.log(
        `   ${aenderung.teamId.padEnd(7)}` +
          `${zahl(aenderung.punkteVorher).padStart(7)} → ${zahl(aenderung.punkteNachher).padStart(6)}   ` +
          `${((differenz >= 0 ? "+" : "") + differenz.toFixed(1)).padStart(7)}   ` +
          `${String(aenderung.rangVorher ?? "—").padStart(4)} → ${String(aenderung.rangNachher ?? "—").padStart(3)}` +
          `${aenderung.rangVorher !== aenderung.rangNachher ? "  ←" : ""}`,
      );
    }
    console.log(
      `   ${ergebnis.geaenderteTeams.length} Team(s) korrigiert, davon ${rangwechsel} mit geaendertem Rang.`,
    );

    if (schreiben) {
      persistence.saveSingleplayerState(save.saveId, ergebnis.gameState);
      console.log("   Geschrieben.\n");
    } else {
      console.log("");
    }
  }

  if (!schreiben) {
    console.log("Trockenlauf — nichts geschrieben. Mit --schreiben ausfuehren.");
  }
}

main();
