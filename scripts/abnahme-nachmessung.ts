/* eslint-disable no-console */
/**
 * NACHMESSUNG AUF DEM ABNAHME-SPIELSTAND.
 *
 * `scripts/abnahme-neues-spiel.ts` laesst einen fertigen Spielstand liegen (Saison 2, nach dem
 * Kauffenster). Dieses Skript misst darauf die Dinge, die im Lauf selbst nichts verloren haben,
 * weil sie keine Fehler sondern Verteilungen sind:
 *
 *  - KADERGROESSEN: fuellt das Kauffenster die Kader wieder auf? (Chris' Praemisse zur
 *    Vertragsaufloesung unter Minimum haengt genau daran.)
 *  - VERTRAGSFORMEN: greift `front_loaded` ueberhaupt jemals? (offener Punkt P4)
 *  - GEHAELTER: verhandelt gegen Formel, je Team.
 *  - VERLETZUNGEN: gibt es welche, und traegt der Kader die Marke? (Chris' Wunsch fuer die
 *    Score-Tabelle setzt voraus, dass die Rohdaten sie ueberhaupt hergeben.)
 *
 * Nutzung:
 *   OLY_APP_SQLITE_PATH=<abnahme.sqlite> npx tsx scripts/abnahme-nachmessung.ts
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolveNegotiatedAnnualSalary } from "@/lib/foundation/player-economy-contract";

function z(wert: number, stellen = 2) {
  return wert.toFixed(stellen);
}

function verteilung(werte: number[]) {
  if (werte.length === 0) return "keine";
  const sortiert = [...werte].sort((a, b) => a - b);
  const median = sortiert[Math.floor(sortiert.length / 2)];
  return `min ${z(sortiert[0])} / median ${z(median)} / max ${z(sortiert[sortiert.length - 1])}`;
}

async function main() {
  const persistence = createPersistenceService();
  const saves = persistence.listSaves();
  const save = saves[saves.length - 1];
  if (!save) throw new Error("kein Spielstand in der Datei");
  const gameState = persistence.getSaveById(save.saveId)!.gameState;
  console.log(`=== NACHMESSUNG ${save.saveId} | Saison ${gameState.season.id} | Phase ${gameState.gamePhase} ===\n`);

  const rosters = gameState.rosters ?? [];
  const teams = gameState.teams;

  // ------------------------------------------------------------------ Kadergroessen
  const proTeam = new Map<string, number>();
  for (const team of teams) proTeam.set(team.teamId, 0);
  for (const eintrag of rosters) {
    if (eintrag.teamId && proTeam.has(eintrag.teamId)) {
      proTeam.set(eintrag.teamId, (proTeam.get(eintrag.teamId) ?? 0) + 1);
    }
  }
  const groessen = [...proTeam.values()];
  console.log("--- KADERGROESSEN ---");
  console.log(`  ${verteilung(groessen)} | Summe ${groessen.reduce((a, b) => a + b, 0)}`);
  const unterSechs = [...proTeam.entries()].filter(([, anzahl]) => anzahl < 6);
  console.log(`  Teams unter 6 Spielern: ${unterSechs.length}`);
  if (unterSechs.length > 0) {
    console.log(
      `    ${unterSechs
        .slice(0, 10)
        .map(([teamId, anzahl]) => `${teams.find((t) => t.teamId === teamId)?.name ?? teamId}=${anzahl}`)
        .join(", ")}`,
    );
  }

  // ------------------------------------------------------------------ Vertragsformen
  console.log("\n--- VERTRAGSFORMEN ---");
  const formen = new Map<string, number>();
  const laufzeiten: number[] = [];
  for (const eintrag of rosters) {
    const form = eintrag.contractShape ?? "(ohne)";
    formen.set(form, (formen.get(form) ?? 0) + 1);
    if (typeof eintrag.contractLength === "number") laufzeiten.push(eintrag.contractLength);
  }
  for (const [form, anzahl] of [...formen.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${form}: ${anzahl} (${z((anzahl / Math.max(1, rosters.length)) * 100, 1)} %)`);
  }
  console.log(`  Restlaufzeiten: ${verteilung(laufzeiten)}`);

  // ------------------------------------------------------------------ Gehaelter
  console.log("\n--- GEHAELTER (verhandelt) ---");
  const verhandeltProTeam = new Map<string, number>();
  const gezahltProTeam = new Map<string, number>();
  let ohneBenchmark = 0;
  for (const eintrag of rosters) {
    if (!eintrag.teamId) continue;
    const verhandelt = resolveNegotiatedAnnualSalary(eintrag).value;
    if (verhandelt == null) ohneBenchmark += 1;
    verhandeltProTeam.set(eintrag.teamId, (verhandeltProTeam.get(eintrag.teamId) ?? 0) + (verhandelt ?? 0));
    gezahltProTeam.set(eintrag.teamId, (gezahltProTeam.get(eintrag.teamId) ?? 0) + (eintrag.salary ?? 0));
  }
  console.log(`  Vertraege ohne Verhandlungs-Benchmark: ${ohneBenchmark}`);
  console.log(`  Verhandelte Teamgehaelter: ${verteilung([...verhandeltProTeam.values()])}`);
  console.log(`  Gezahlte Teamgehaelter:    ${verteilung([...gezahltProTeam.values()])}`);
  console.log(
    `  Liga verhandelt ${z([...verhandeltProTeam.values()].reduce((a, b) => a + b, 0))} | gezahlt ${z(
      [...gezahltProTeam.values()].reduce((a, b) => a + b, 0),
    )}`,
  );

  // ------------------------------------------------------------------ Verletzungen
  //
  // Die Verletzung haengt NICHT am Spieler und nicht am Rostereintrag, sondern an
  // `seasonState.playerAvailabilityState`. Genau das muss die Score-Tabelle lesen, wenn sie die
  // Marke zeigen soll (Chris' Wunsch) — deshalb wird hier gegen dieselbe Quelle gemessen.
  console.log("\n--- VERLETZUNGEN ---");
  const verfuegbarkeit = gameState.seasonState.playerAvailabilityState ?? [];
  const verletzt = verfuegbarkeit.filter((eintrag) => eintrag.injuryStatus === "injured");
  const erholend = verfuegbarkeit.filter((eintrag) => eintrag.injuryStatus === "recovering");
  console.log(`  Verfuegbarkeits-Datensaetze: ${verfuegbarkeit.length}`);
  console.log(`  verletzt: ${verletzt.length} | in Erholung: ${erholend.length}`);
  const betroffeneTeams = new Set([...verletzt, ...erholend].map((eintrag) => eintrag.teamId));
  console.log(`  betroffene Teams: ${betroffeneTeams.size} von ${teams.length}`);
  console.log(`  Verletzungs-Ereignisse in der Saison: ${(gameState.seasonState.injuryEvents ?? []).length}`);

  // ------------------------------------------------------------------ Kassen
  console.log("\n--- KASSEN ---");
  const kassen = teams.map((team) => team.cash ?? 0);
  console.log(`  ${verteilung(kassen)} | negativ: ${kassen.filter((wert) => wert < 0).length}`);

  // ------------------------------------------------------------------ Tabellenraenge
  //
  // Der Abnahmelauf meldet 2 von 32 Raengen abweichend von der REINEN Punktsortierung. Das darf
  // ein Gleichstand sein — aber nur, wenn die beiden Teams wirklich punktgleich sind. Steht da ein
  // echter Punktabstand, ist es ein Sortierfehler. Hier wird genau das auseinandergehalten.
  console.log("\n--- TABELLENRAENGE ---");
  const standings = gameState.seasonState.standings ?? {};
  const nachPunkten = [...teams].sort(
    (a, b) => (standings[b.teamId]?.points ?? 0) - (standings[a.teamId]?.points ?? 0),
  );
  const abweichend = nachPunkten
    .map((team, index) => ({ team, erwartet: index + 1, gebucht: standings[team.teamId]?.rank ?? 0 }))
    .filter((zeile) => zeile.erwartet !== zeile.gebucht);
  console.log(`  von reiner Punktsortierung abweichend: ${abweichend.length}`);
  for (const zeile of abweichend) {
    const punkte = standings[zeile.team.teamId]?.points ?? 0;
    const gleichstand = nachPunkten.filter(
      (anderes) => Math.abs((standings[anderes.teamId]?.points ?? 0) - punkte) < 0.001,
    ).length;
    console.log(
      `    ${zeile.team.name}: Rang gebucht ${zeile.gebucht}, Punktsortierung ${zeile.erwartet}, ` +
        `${z(punkte)} Punkte, punktgleich mit ${gleichstand - 1} Team(s)` +
        `${gleichstand > 1 ? "  → Gleichstandsregel, kein Fehler" : "  ! KEIN Gleichstand — Sortierfehler"}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
