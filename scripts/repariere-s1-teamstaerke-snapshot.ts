/* eslint-disable no-console */
/**
 * REPARIERT DIE TEAMSTÄRKE-RÄNGE EINES BESTEHENDEN SAISON-SCHNAPPSCHUSSES.
 *
 * GEMELDET VON CHRIS (Ranks-Matrix): „achtung auch hier bei den ranks müssen sich die snapshots
 * für die ranking änderungen auf den season 1 lauf beziehen vor verkäufen! Bitte korrigiere den
 * S1 snapshot weil da ist N-N zb 32. P-S weit unten das kann nicht der stand während der saison
 * gewesen sein!"
 *
 * BEFUND: `createSeasonSnapshot` lief am 2026-08-08 06:05 — vier Tage nach dem letzten gewerteten
 * Spieltag (2026-08-04 18:23). Dazwischen lagen 49 Verkäufe unter `seasonId: season-1`, ohne einen
 * einzigen Zugang. Die Rangrechnung nahm den Live-Kader zum Abschluss, also den Nach-Ausverkauf-
 * Stand: N-N (5 Abgänge) Rang 32, P-S (3 Abgänge) Rang 26, S-C Rang 31.
 *
 * Für neue Abschlüsse ist das an der Quelle behoben (Erfassung bei der Spieltagswertung, siehe
 * `teamStrengthRankCaptures`). Dieses Skript korrigiert den BEREITS GESCHRIEBENEN Schnappschuss:
 * es wickelt alle Kaderbewegungen nach dem letzten gewerteten Spieltag über die Transferhistorie
 * rückwärts ab, setzt die Disziplinwerte auf den Vorsaison-Stand und rechnet die Ränge mit
 * DERSELBEN Funktion wie der Live-Pfad (`buildTeamDisciplineRankSnapshotRecords`) neu.
 *
 * ZWEI ZEITEBENEN, BEWUSST GETRENNT (am Live-Abbild nachgemessen):
 *   - KADER: der alte Lauf nahm den Nach-Ausverkauf-Kader — das ist der gemeldete Fehler.
 *   - WERTE: der alte Lauf nahm bereits die NACH der Saisonwechsel-Entwicklung fortgeschriebenen
 *     Disziplinwerte (die alten Punktzahlen unbewegter Teams stimmen exakt mit den heutigen
 *     Werten überein, nicht mit den in `lastSeasonDisciplineValues` festgehaltenen Saisonwerten).
 *     Der reparierte Satz nimmt die SAISONWERTE — denselben Stand, den die neue Erfassung bei der
 *     Spieltagswertung festhält, damit Saison für Saison dasselbe gemessen wird.
 *
 * SICHERHEITEN:
 *   - Standard ist der Trockenlauf: rechnen, Vorher/Nachher zeigen, nichts schreiben.
 *     Geschrieben wird nur mit `--schreiben`.
 *   - Plausibilitätspflicht (Kader-Probe): mit UNVERÄNDERTEN heutigen Werten gerechnet, müssen
 *     Teams ohne Bewegung zwischen Stichzeit und altem Snapshot exakt ihre alte Punktzahl
 *     (scorePack.total) reproduzieren — nur dann ist die rückabgewickelte Kaderzugehörigkeit
 *     nachweislich richtig. Schlägt das fehl, verweigert das Skript das Schreiben, statt neue
 *     falsche Zahlen zu liefern.
 *   - Werte-Deckung: jeder rekonstruierte Kaderspieler muss festgehaltene Vorsaison-Werte
 *     (`lastSeasonDisciplineValues`) tragen; Lücken werden ausgewiesen.
 *   - Läuft nur gegen die Datenbank, auf die `OLY_APP_SQLITE_PATH` zeigt — bitte auf eine KOPIE
 *     zeigen lassen (siehe CLAUDE.md, Branch `live-save`). Ohne die Variable bricht das Skript ab.
 *
 * Nutzung:
 *   OLY_APP_SQLITE_PATH=/pfad/zur/kopie.sqlite \
 *     npx tsx scripts/repariere-s1-teamstaerke-snapshot.ts --save <saveId> [--saison season-1] [--schreiben]
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { SeasonSnapshotRecord } from "@/lib/data/olyDataTypes";
import { buildTeamDisciplineRankSnapshotRecords } from "@/lib/foundation/team-discipline-rank-engine";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { buildSeasonEndReconstructedGameState } from "@/lib/season/team-strength-rank-reconstruction";

function parseArgs(argv: string[]) {
  let saveId: string | null = null;
  let seasonId = "season-1";
  let schreiben = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--save" && argv[i + 1]) {
      saveId = argv[i + 1]!;
      i += 1;
    } else if (argv[i] === "--saison" && argv[i + 1]) {
      seasonId = argv[i + 1]!;
      i += 1;
    } else if (argv[i] === "--schreiben") {
      schreiben = true;
    } else if (argv[i] === "--trocken") {
      schreiben = false;
    }
  }
  return { saveId, seasonId, schreiben };
}

function spalte(text: string | number | null | undefined, breite: number) {
  return String(text ?? "—").padStart(breite);
}

function main() {
  const { saveId: gewaehlt, seasonId, schreiben } = parseArgs(process.argv.slice(2));

  if (!process.env.OLY_APP_SQLITE_PATH) {
    console.error(
      "OLY_APP_SQLITE_PATH ist nicht gesetzt. Dieses Skript läuft nur gegen eine ausdrücklich",
    );
    console.error("benannte KOPIE des Spielstands, nie gegen den Standardpfad. Abbruch.");
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
  console.log(`Modus      : ${schreiben ? "SCHREIBEN (Snapshot wird ersetzt)" : "Trockenlauf (es wird nichts geschrieben)"}`);

  const snapshots = gameState.seasonState.seasonSnapshots ?? [];
  const snapshot = snapshots.find((entry) => entry.seasonId === seasonId) ?? null;
  if (!snapshot) {
    console.error(`Kein Saison-Schnappschuss für ${seasonId} in diesem Spielstand. Abbruch.`);
    process.exit(2);
    return;
  }
  const alteRaenge = snapshot.teamDisciplineRankSnapshots ?? [];
  if (alteRaenge.length === 0) {
    console.error(`Der Schnappschuss ${seasonId} trägt keine Teamstärke-Ränge. Nichts zu reparieren.`);
    process.exit(2);
    return;
  }

  // Letzter gewerteter Spieltag der Saison: jüngstes angewandtes Ergebnis im Schnappschuss selbst
  // (Rückfall: seasonState), dessen createdAt ist der Stichzeitpunkt.
  const ergebnisse = [
    ...(snapshot.matchdayResults ?? []),
    ...((gameState.seasonState.matchdayResults ?? []).filter((entry) => entry.seasonId === seasonId)),
  ].filter((entry) => entry.status === "preview_applied");
  if (ergebnisse.length === 0) {
    console.error(`Keine gewerteten Spieltagsergebnisse für ${seasonId} auffindbar — kein Stichzeitpunkt. Abbruch.`);
    process.exit(2);
    return;
  }
  const letztes = [...ergebnisse].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).at(-1)!;
  const stichzeit = String(letztes.createdAt);
  console.log(`Stichzeit  : ${stichzeit} (letzter gewerteter Spieltag: ${letztes.matchdayId})`);

  // Kaderstand zum Stichzeitpunkt rekonstruieren — einmal mit Saisonwerten (Ziel), einmal mit
  // unveränderten heutigen Werten (Messsonde für die Kader-Probe).
  const rekonstruktion = buildSeasonEndReconstructedGameState(gameState, stichzeit);
  const kaderProbe = buildSeasonEndReconstructedGameState(gameState, stichzeit, { ratingsSource: "current" });
  const bewegungen = gameState.transferHistory.filter((entry) => entry.happenedAt > stichzeit);
  const nachTyp = new Map<string, number>();
  for (const bewegung of bewegungen) {
    const schluessel = `${bewegung.seasonId}/${bewegung.transferType}`;
    nachTyp.set(schluessel, (nachTyp.get(schluessel) ?? 0) + 1);
  }
  console.log(
    `Bewegungen : ${rekonstruktion.movementsReverted} rückabgewickelt (${[...nachTyp.entries()]
      .map(([key, count]) => `${key}: ${count}`)
      .join(", ")})`,
  );
  if (rekonstruktion.warnings.length > 0) {
    console.log(`Warnungen  : ${rekonstruktion.warnings.length}`);
    for (const warnung of rekonstruktion.warnings.slice(0, 10)) console.log(`  - ${warnung}`);
    if (rekonstruktion.warnings.length > 10) console.log(`  … und ${rekonstruktion.warnings.length - 10} weitere`);
  }
  if (rekonstruktion.playersMissing.length > 0) {
    console.error(
      `Nicht rekonstruierbar: ${rekonstruktion.playersMissing.length} Spieler ohne Datensatz im Spielstand ` +
        `(${rekonstruktion.playersMissing.slice(0, 5).join(", ")}${rekonstruktion.playersMissing.length > 5 ? ", …" : ""}).`,
    );
    console.error("Keine erfundenen Zahlen — Abbruch ohne Ergebnis.");
    process.exit(1);
    return;
  }

  console.log(
    `Wertequelle: ${rekonstruktion.membersWithPreviousSeasonValues}/${rekonstruktion.membersTotal} Kaderspieler mit festgehaltenen Vorsaison-Werten (lastSeasonDisciplineValues)`,
  );

  // Dieselbe Rangfunktion wie im Live-Pfad — keine zweite Rechnung.
  const neueRaenge = buildTeamDisciplineRankSnapshotRecords(rekonstruktion.gameState);
  const probeRaenge = buildTeamDisciplineRankSnapshotRecords(kaderProbe.gameState);

  // PLAUSIBILITÄT 1 — Kader-Probe. Der alte (falsche) Lauf rechnete zum Zeitpunkt `archivedAt`
  // mit den bereits entwickelten Werten. Für ein Team OHNE Bewegung zwischen Stichzeit und
  // `archivedAt` sah er exakt den Spieltags-Kader (Bewegungen NACH `archivedAt` — Vertragsenden,
  // Folgesaison-Käufe — wickelt die Rekonstruktion zurück). Rechnet man den rekonstruierten Kader
  // mit den heutigen Werten, muss für diese Teams also exakt die alte Punktzahl herauskommen.
  // Nur dann ist die Rückabwicklung der Kaderzugehörigkeit nachweislich richtig.
  const snapshotZeit = String(snapshot.archivedAt ?? snapshot.createdAt ?? "");
  const betroffeneTeams = new Set<string>();
  for (const bewegung of bewegungen) {
    if (snapshotZeit && bewegung.happenedAt > snapshotZeit) continue;
    if (bewegung.fromTeamId) betroffeneTeams.add(bewegung.fromTeamId);
    if (bewegung.toTeamId) betroffeneTeams.add(bewegung.toTeamId);
  }
  const altNachTeam = new Map(alteRaenge.map((entry) => [entry.teamId, entry] as const));
  const neuNachTeam = new Map(neueRaenge.map((entry) => [entry.teamId, entry] as const));
  const probeNachTeam = new Map(probeRaenge.map((entry) => [entry.teamId, entry] as const));
  const fixpunktFehler: string[] = [];
  let fixpunkte = 0;
  for (const team of gameState.teams) {
    if (betroffeneTeams.has(team.teamId)) continue;
    fixpunkte += 1;
    const altTotal = altNachTeam.get(team.teamId)?.scorePack?.total ?? null;
    const probeTotal = probeNachTeam.get(team.teamId)?.scorePack?.total ?? null;
    if (altTotal == null || probeTotal == null || Math.abs(altTotal - probeTotal) > 0.005) {
      fixpunktFehler.push(`${team.teamId}: alt=${altTotal} kaderprobe=${probeTotal}`);
    }
  }
  console.log(
    `Kader-Probe: ${fixpunkte - fixpunktFehler.length}/${fixpunkte} unbewegte Teams reproduzieren mit heutigen Werten exakt ihre alte Punktzahl`,
  );

  // PLAUSIBILITÄT 2 — Abgleich mit dem Punkte-Endstand derselben Saison.
  const endstand = new Map(
    (snapshot.finalStandings ?? []).map((entry) => [entry.teamId, entry] as const),
  );

  console.log(`\nVORHER/NACHHER — Teamstärke-Ränge ${seasonId} (sortiert nach neuem Rang):`);
  console.log(
    `${"Team".padEnd(26)}${spalte("Punkte-Rang", 12)}${spalte("Rang alt", 10)}${spalte("Rang neu", 10)}${spalte("Δ", 5)}${spalte("Total alt", 11)}${spalte("Total neu", 11)}`,
  );
  const zeilen = [...neueRaenge].sort((a, b) => a.totalRank - b.totalRank);
  const verschiebungen: Array<{ team: string; alt: number; neu: number }> = [];
  for (const neu of zeilen) {
    const alt = altNachTeam.get(neu.teamId) ?? null;
    const punkte = endstand.get(neu.teamId) ?? null;
    const delta = alt ? alt.totalRank - neu.totalRank : null;
    if (alt && delta !== 0 && delta != null) {
      verschiebungen.push({ team: `${neu.teamCode ?? neu.teamId}`, alt: alt.totalRank, neu: neu.totalRank });
    }
    console.log(
      `${`${neu.teamCode ?? "?"} ${neu.teamName}`.slice(0, 25).padEnd(26)}${spalte(punkte?.rank ?? null, 12)}${spalte(alt?.totalRank ?? null, 10)}${spalte(neu.totalRank, 10)}${spalte(delta == null ? "—" : delta > 0 ? `+${delta}` : `${delta}`, 5)}${spalte(alt?.scorePack?.total ?? null, 11)}${spalte(neu.scorePack?.total ?? null, 11)}`,
    );
  }

  const groessteVerschiebungen = verschiebungen
    .sort((a, b) => Math.abs(b.alt - b.neu) - Math.abs(a.alt - a.neu))
    .slice(0, 6);
  if (groessteVerschiebungen.length > 0) {
    console.log(
      `\nGrößte Korrekturen: ${groessteVerschiebungen
        .map((entry) => `${entry.team} ${entry.alt}→${entry.neu}`)
        .join(", ")}`,
    );
  }

  const top3 = (snapshot.finalStandings ?? []).filter((entry) => entry.rank != null && entry.rank <= 3);
  for (const team of top3) {
    const neu = neuNachTeam.get(team.teamId) ?? null;
    console.log(
      `Endstand-Probe: ${team.teamCode ?? team.teamId} beendete die Saison als ${team.rank}. und steht in der Teamstärke neu auf Rang ${neu?.totalRank ?? "—"} (alt ${altNachTeam.get(team.teamId)?.totalRank ?? "—"}).`,
    );
  }

  if (fixpunktFehler.length > 0) {
    console.error(`\nKader-Probe GESCHEITERT für ${fixpunktFehler.length} Team(s):`);
    for (const fehler of fixpunktFehler) console.error(`  - ${fehler}`);
    console.error("Die rückabgewickelte Kaderzugehörigkeit trifft den alten Bezugswert nicht — eine so");
    console.error("gerechnete Korrektur wäre genauso falsch wie der alte Snapshot. Es wird NICHT geschrieben.");
    process.exit(1);
    return;
  }

  if (rekonstruktion.membersWithPreviousSeasonValues < rekonstruktion.membersTotal) {
    const fehlend = rekonstruktion.membersTotal - rekonstruktion.membersWithPreviousSeasonValues;
    console.warn(
      `\nACHTUNG: ${fehlend} Kaderspieler ohne festgehaltene Vorsaison-Werte — für sie greift der ` +
        "dokumentierte Rückfall (previousDisciplineRatings bzw. aktuelle Werte). Bitte prüfen, bevor geschrieben wird.",
    );
  }

  if (!schreiben) {
    console.log("\nTrockenlauf beendet — nichts geschrieben. Zum Übernehmen mit --schreiben aufrufen.");
    return;
  }

  const jetzt = new Date().toISOString();
  const reparierterSnapshot: SeasonSnapshotRecord = {
    ...snapshot,
    teamDisciplineRankSnapshots: neueRaenge,
    teamDisciplineRankSnapshotMeta: {
      source: "transfer_history_reconstruction",
      matchdayId: letztes.matchdayId,
      capturedAt: stichzeit,
      note: `Rekonstruiert am ${jetzt}: ${rekonstruktion.movementsReverted} Bewegungen nach dem letzten gewerteten Spieltag rückabgewickelt (scripts/repariere-s1-teamstaerke-snapshot.ts).`,
    },
    warnings: Array.from(
      new Set([...(snapshot.warnings ?? []), `team_discipline_ranks_reconstructed_from_transfer_history:${jetzt}`]),
    ),
  };
  const nextSnapshots = snapshots.map((entry) => (entry.seasonId === seasonId ? reparierterSnapshot : entry));

  persistence.saveSingleplayerState(start.saveId, {
    ...gameState,
    seasonState: {
      ...gameState.seasonState,
      seasonSnapshots: nextSnapshots,
    },
  });

  console.log(`\nGeschrieben: teamDisciplineRankSnapshots für ${seasonId} ersetzt, Herkunft vermerkt.`);
}

main();
