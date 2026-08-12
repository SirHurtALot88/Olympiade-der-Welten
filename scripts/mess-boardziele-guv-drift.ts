/* eslint-disable no-console */
/**
 * MISST, OB DIE GuV-ZEILE „VORSTANDSZIELE" MIT DER KASSE WANDERT (Paket 3 im Plan).
 *
 * WARUM ES DAS BRAUCHT: mehrere Vorstandsziele werten gegen den LEBENDEN Kontostand
 * (`finance-rebuild-cash-buffer` misst den Liga-Rang von `cash`, `finance-salary-ratio` misst
 * `salary/(cash+salary)`). Die Saisonende-Kette bucht Sponsor und Gebaeude VOR den Zielen — jede
 * Buchung verschiebt die Liga-Cash-Raenge, ein Zielstatus kippt, und die Zeile „Vorstandsziele"
 * zeigt eine andere Zahl. Die Buchung selbst haelt ihre Wahrheit laengst fest
 * (`objectiveRewardApplyLogs[].payload.cashDeltaByTeamId`), aber der GuV-Resolver rechnete sie bei
 * jedem Aufruf neu.
 *
 * Gemessen werden drei Dinge, alle als WERTE je Team:
 *   1) Buchen der Sponsoren VOR der Zielbuchung: wie weit wandert die Zeile? (systembedingter
 *      Rest — vor der Buchung ist die Zeile eine Hochrechnung und als solche gekennzeichnet)
 *   2) Nach der Zielbuchung: `posten[boardziele] == log.payload.cashDeltaByTeamId[teamId]`,
 *      Toleranz 0,0. Das ist die eigentliche Abnahme.
 *   3) Beobachter-Invarianz: nach der Buchung `team.cash` in-memory um +20 verschieben — die Zeile
 *      darf sich um 0,00 aendern.
 *
 * Das Skript schreibt NICHTS in die Datenbank; alle Buchungen bleiben im Speicher.
 *
 * Nutzung:
 *   OLY_APP_SQLITE_PATH=/pfad/zur/kopie.sqlite npx tsx scripts/mess-boardziele-guv-drift.ts
 *   ... --save <saveId>
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState } from "@/lib/data/olyDataTypes";
import { applyTeamSeasonObjectiveRewards } from "@/lib/board/team-season-objectives-service";
import { resolveSeasonGuvByTeam } from "@/lib/finance/season-guv-resolver";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { applySponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";

function parseArgs(argv: string[]) {
  let saveId: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--save" && argv[i + 1]) {
      saveId = argv[i + 1];
      i += 1;
    }
  }
  return { saveId };
}

function boardzieleJeTeam(gameState: GameState): Map<string, number> {
  const guv = resolveSeasonGuvByTeam(gameState);
  return new Map(
    [...guv.entries()].map(
      ([teamId, entry]) => [teamId, entry.posten.find((posten) => posten.key === "boardziele")?.amount ?? 0] as const,
    ),
  );
}

function groessteAbweichung(links: Map<string, number>, rechts: Map<string, number>) {
  let maxTeam: string | null = null;
  let max = 0;
  let betroffen = 0;
  for (const [teamId, wert] of links) {
    const delta = Math.abs((rechts.get(teamId) ?? 0) - wert);
    if (delta > 0.0001) betroffen += 1;
    if (delta > max) {
      max = delta;
      maxTeam = teamId;
    }
  }
  return { max, maxTeam, betroffen, teams: links.size };
}

async function main() {
  const { saveId: gewaehlt } = parseArgs(process.argv.slice(2));
  const persistence = createPersistenceService();
  const save = gewaehlt ? persistence.getSaveById(gewaehlt) : persistence.getActiveSave();
  if (!save) {
    console.error("Kein Spielstand gefunden. --save <saveId> angeben oder OLY_APP_SQLITE_PATH pruefen.");
    process.exit(2);
    return;
  }

  console.log(`Abbild: ${process.env.OLY_APP_SQLITE_PATH ?? "(Standardpfad)"}`);
  console.log(`Save  : ${save.saveId}  (Saison ${save.gameState.season.id}, ${save.gameState.teams.length} Teams)`);

  // --- 1) Sponsoren buchen, solange die Ziele NOCH NICHT gebucht sind ------------------------
  const vorSponsor = boardzieleJeTeam(save.gameState);
  const sponsorApply = applySponsorSettlement({
    gameState: save.gameState,
    saveId: save.saveId,
    phase: "season_end",
    execute: true,
    deductSalary: true,
  });
  const nachSponsor = boardzieleJeTeam(sponsorApply.gameState);
  const driftHochrechnung = groessteAbweichung(vorSponsor, nachSponsor);
  console.log(
    `\n1) Sponsorbuchung VOR der Zielbuchung (Zeile ist Hochrechnung): ` +
      `${driftHochrechnung.betroffen}/${driftHochrechnung.teams} Teams wandern, max ` +
      `${driftHochrechnung.max.toFixed(2)} C (${driftHochrechnung.maxTeam ?? "—"})` +
      `${sponsorApply.applied ? "" : "   [Sponsor-Buchung nicht anwendbar]"}`,
  );

  // --- 2) Ziele buchen: danach IST die Zeile die gebuchte Zahl -------------------------------
  const zielApply = applyTeamSeasonObjectiveRewards(sponsorApply.gameState, {
    saveId: save.saveId,
    seasonId: sponsorApply.gameState.season.id,
    execute: true,
  });
  if (!zielApply.applied) {
    console.log(
      `\n2) Zielbuchung nicht ausgefuehrt (bereits gebucht: ${zielApply.duplicateDetected}). ` +
        "Ohne frische Buchung ist die Log-Gegenprobe nicht messbar.",
    );
    process.exit(0);
    return;
  }
  const gebucht = zielApply.gameState.seasonState.objectiveRewardApplyLogs?.find(
    (log) => log.seasonId === zielApply.gameState.season.id,
  );
  const gebuchtJeTeam = gebucht?.payload?.cashDeltaByTeamId ?? {};
  const nachZielbuchung = boardzieleJeTeam(zielApply.gameState);

  let abweichungen = 0;
  let maxAbweichung = 0;
  let maxTeam: string | null = null;
  for (const team of zielApply.gameState.teams) {
    const gezeigt = nachZielbuchung.get(team.teamId) ?? 0;
    const wirklich = gebuchtJeTeam[team.teamId] ?? 0;
    const delta = Math.abs(gezeigt - wirklich);
    if (delta > 0.0001) abweichungen += 1;
    if (delta > maxAbweichung) {
      maxAbweichung = delta;
      maxTeam = team.teamId;
    }
  }
  console.log(
    `\n2) GuV-Zeile gegen den Buchungsbeleg: ${abweichungen}/${zielApply.gameState.teams.length} Teams weichen ab, ` +
      `max ${maxAbweichung.toFixed(2)} C (${maxTeam ?? "—"})`,
  );

  // --- 3) Beobachter-Invarianz --------------------------------------------------------------
  const verschoben: GameState = {
    ...zielApply.gameState,
    teams: zielApply.gameState.teams.map((team) => ({ ...team, cash: (team.cash ?? 0) + 20 })),
  };
  const nachVerschiebung = boardzieleJeTeam(verschoben);
  const driftBeobachter = groessteAbweichung(nachZielbuchung, nachVerschiebung);
  console.log(
    `\n3) Beobachter-Invarianz (jedes Team +20 C in-memory): ${driftBeobachter.betroffen}/${driftBeobachter.teams} ` +
      `Teams wandern, max ${driftBeobachter.max.toFixed(2)} C (${driftBeobachter.maxTeam ?? "—"})`,
  );

  const bestanden = abweichungen === 0 && driftBeobachter.betroffen === 0;
  console.log(`\nErgebnis: ${bestanden ? "GEBUCHT == ANGEZEIGT, und beobachter-invariant" : "ABWEICHUNG — siehe oben"}`);
  process.exit(bestanden ? 0 : 1);
}

void main();
