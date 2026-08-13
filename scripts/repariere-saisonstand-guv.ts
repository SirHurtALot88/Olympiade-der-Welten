/**
 * ZIEHT DIE GESPEICHERTE GuV EINER BEREITS ABGERECHNETEN SAISON AUF DEN GEBUCHTEN STAND.
 *
 * GEMELDET VON CHRIS an der Historie von L-K: „warum so viel minus in der aktiven season?" Die
 * Zeile wies −33,4 aus, die gebuchten Bewegungen ergaben −18,8.
 *
 * BEFUND: `standings[team].guvPosten` entsteht in `writeLocalCashPrizeApply` und damit VOR den
 * eigentlichen Buchungen — am Live-Spielstand 0,5 bis 16 Sekunden davor. Apron und Vorstandsziele
 * stehen dort als Hochrechnung; der Apron trägt sogar „noch nicht gebucht" und zählt deshalb nicht
 * in die Summe. Die Reihenfolge ist ab jetzt geheilt (`season-guv-nachbuchung.ts`, aufgerufen am
 * Ende beider Saisonende-Wege), aber SCHON ABGERECHNETE Saisons tragen die alte Zeile weiter — und
 * sie wandert beim nächsten Saisonwechsel in den Snapshot und damit dauerhaft in die Historie.
 * Dieses Skript ist der Weg, sie vorher zu korrigieren.
 *
 * ES IST KEINE ZWEITE RECHNUNG: geschrieben wird, was `resolveSeasonGuvByTeam` liefert — dieselbe
 * Funktion, aus der die Zeile ursprünglich stammt und mit der die Oberfläche live rechnet. Sie
 * liest inzwischen bei jedem Posten den Buchungsbeleg, sobald es einen gibt (Sponsor, Apron,
 * Vorstandsziele). Cash wird NICHT angefasst — die Konten sind richtig, nur ihre Beschreibung war
 * es nicht.
 *
 * SICHERHEITEN:
 *   - Standard ist der Trockenlauf: rechnen, Vorher/Nachher zeigen, nichts schreiben.
 *     Geschrieben wird nur mit `--schreiben`.
 *   - Läuft nur gegen die Datenbank, auf die `OLY_APP_SQLITE_PATH` zeigt — bitte auf eine KOPIE
 *     zeigen lassen (siehe CLAUDE.md, Branch `live-save`). Ohne die Variable bricht das Skript ab.
 *
 * Nutzung:
 *   OLY_APP_SQLITE_PATH=/pfad/zur/kopie.sqlite \
 *     npx tsx scripts/repariere-saisonstand-guv.ts [--save <saveId>] [--schreiben]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { SeasonGuvPosten } from "@/lib/finance/season-end-guv";
import { zieheSaisonstandGuvNach } from "@/lib/finance/season-guv-nachbuchung";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

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

function posten(liste: SeasonGuvPosten[] | null | undefined, key: string): SeasonGuvPosten | null {
  return (liste ?? []).find((eintrag) => eintrag.key === key) ?? null;
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

  const { saveId: gewaehlt, schreiben } = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();
  const save = gewaehlt ? persistence.getSaveById(gewaehlt) : persistence.getActiveSave();
  if (!save) {
    console.error("Kein Spielstand gefunden. --save <saveId> angeben oder OLY_APP_SQLITE_PATH pruefen.");
    process.exit(2);
    return;
  }

  const seasonId = save.gameState.season.id;
  console.log(`Abbild     : ${process.env.OLY_APP_SQLITE_PATH}`);
  console.log(`Spielstand : ${save.saveId} — ${save.name}`);
  console.log(`Saison     : ${seasonId}, Spieltag ${save.gameState.season.currentMatchday}, Phase ${save.gameState.gamePhase}`);
  console.log(`Modus      : ${schreiben ? "SCHREIBEN" : "Trockenlauf (nichts wird geschrieben)"}\n`);

  const vorher = save.gameState.seasonState.standings ?? {};
  const ergebnis = zieheSaisonstandGuvNach(save.gameState);

  if (ergebnis.geaenderteTeams.length === 0) {
    console.log("Nichts nachzuziehen — entweder ist die Saison noch nicht abgerechnet, oder die Zeilen stimmen bereits.");
    return;
  }

  const nachher = ergebnis.gameState.seasonState.standings ?? {};
  console.log("Team   Apron alt          → neu     Ziele alt → neu   Sponsor alt → neu     GuV alt →   neu   Differenz");
  let summeDifferenz = 0;
  for (const teamId of ergebnis.geaenderteTeams.sort()) {
    const alt = vorher[teamId];
    const neu = nachher[teamId];
    const apronAlt = posten(alt?.guvPosten, "apron");
    const apronNeu = posten(neu?.guvPosten, "apron");
    const zielAlt = posten(alt?.guvPosten, "boardziele");
    const zielNeu = posten(neu?.guvPosten, "boardziele");
    const sponsorAlt = posten(alt?.guvPosten, "sponsor");
    const sponsorNeu = posten(neu?.guvPosten, "sponsor");
    const differenz = (neu?.guv ?? 0) - (alt?.guv ?? 0);
    summeDifferenz += differenz;
    console.log(
      `${teamId.padEnd(6)}` +
        `${zahl(apronAlt?.amount).padStart(6)} (${apronAlt?.counted ? "zählt" : "zählt nicht"})`.padEnd(22) +
        `→ ${zahl(apronNeu?.amount).padStart(6)}   ` +
        `${zahl(zielAlt?.amount).padStart(6)} → ${zahl(zielNeu?.amount).padStart(6)}   ` +
        `${zahl(sponsorAlt?.amount).padStart(7)} → ${zahl(sponsorNeu?.amount).padStart(7)}   ` +
        `${zahl(alt?.guv).padStart(7)} → ${zahl(neu?.guv).padStart(7)}   ` +
        `${(differenz >= 0 ? "+" : "") + differenz.toFixed(1)}`,
    );
  }
  console.log(
    `\n${ergebnis.geaenderteTeams.length} von ${Object.keys(vorher).length} Teams betroffen, ` +
      `Summe der Korrektur ${summeDifferenz >= 0 ? "+" : ""}${summeDifferenz.toFixed(1)}.`,
  );

  if (!schreiben) {
    console.log("\nTrockenlauf — nichts geschrieben. Mit --schreiben ausfuehren, um die Zeilen zu korrigieren.");
    return;
  }

  persistence.saveSingleplayerState(save.saveId, ergebnis.gameState);
  console.log("\nGeschrieben. Cash wurde NICHT angefasst — nur die Beschreibung der Saison.");
}

main();
