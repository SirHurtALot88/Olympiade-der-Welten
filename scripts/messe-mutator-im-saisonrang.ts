/* eslint-disable no-console */
/**
 * GEMELDET (`qg6cpy`): „Beim Spieltagsranking ist immernoch ein Team 1. mit 6,5 + 0,3 Mutator
 * punkten was korrekt ist! ABER im Season rank steht rang 2 weil da nur 6,5 kalkuliert werden."
 *
 * Dieses Skript haelt die GEBUCHTE Saisonpunktzahl je Team gegen die Summe, die sich aus den
 * Spieltagsergebnissen ergibt — einmal ohne und einmal MIT Mutator-Bonus. Steht die Buchung auf
 * der Ohne-Summe, ist Chris' Befund belegt und die Luecke exakt beziffert.
 *
 *   OLY_APP_SQLITE_PATH=/tmp/abbild-neu.sqlite npx tsx scripts/messe-mutator-im-saisonrang.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolveTeamMutatorPpsBonus } from "@/lib/foundation/player-points-total";

const p = createPersistenceService();
for (const eintrag of p.listSaves()) {
  const gs = p.getSaveById(eintrag.saveId)?.gameState as GameState | undefined;
  if (!gs?.teams?.length) continue;
  const seasonId = gs.season?.id;
  const ergebnisse = (gs.seasonState?.matchdayResults ?? []).filter(
    (r) => (r as { seasonId?: string }).seasonId === seasonId,
  );
  if (ergebnisse.length === 0) continue;

  const zeilen = gs.teams.map((team) => {
    let ohne = 0;
    let mutator = 0;
    for (const ergebnis of ergebnisse) {
      const reihe = ((ergebnis as { teams?: Array<Record<string, unknown>> }).teams ?? []).find(
        (t) => t.teamId === team.teamId,
      );
      ohne += Number(reihe?.d1Points ?? 0) + Number(reihe?.d2Points ?? 0);
      mutator += resolveTeamMutatorPpsBonus({
        performances: gs.seasonState?.playerDisciplinePerformances ?? [],
        matchdayResultId: (ergebnis as { id?: string }).id ?? null,
        teamId: team.teamId,
      });
    }
    const gebucht = Number(
      (gs.seasonState?.standings ?? []).find((s) => (s as { teamId?: string }).teamId === team.teamId)?.points ??
        (team as { seasonPoints?: number }).seasonPoints ??
        NaN,
    );
    return { id: team.teamId, ohne: Math.round(ohne * 10) / 10, mutator: Math.round(mutator * 10) / 10, gebucht };
  });

  const mitMutator = zeilen.filter((z) => z.mutator > 0);
  const gebuchtBekannt = zeilen.filter((z) => Number.isFinite(z.gebucht));
  console.log(
    `\n${String(eintrag.saveId).slice(-6)}  ${seasonId} MD${gs.season?.currentMatchday}` +
      `  Spieltage gebucht: ${ergebnisse.length}  Teams mit Mutator-Punkten: ${mitMutator.length}/${zeilen.length}`,
  );
  console.log(`  Mutator-Summe ligaweit: ${zeilen.reduce((s, z) => s + z.mutator, 0).toFixed(1)}`);
  if (gebuchtBekannt.length > 0) {
    const passtOhne = gebuchtBekannt.filter((z) => Math.abs(z.gebucht - z.ohne) < 0.05).length;
    const passtMit = gebuchtBekannt.filter((z) => Math.abs(z.gebucht - (z.ohne + z.mutator)) < 0.05).length;
    console.log(`  gebuchte Punkte passen zu OHNE Mutator: ${passtOhne}/${gebuchtBekannt.length}`);
    console.log(`  gebuchte Punkte passen zu MIT  Mutator: ${passtMit}/${gebuchtBekannt.length}`);
  } else {
    console.log("  (keine gebuchte Saisonpunktzahl im Spielstand gefunden — Feldname pruefen)");
  }
  for (const z of mitMutator.slice(0, 3)) {
    console.log(`    ${z.id}  ohne ${z.ohne}  +Mutator ${z.mutator}  = ${(z.ohne + z.mutator).toFixed(1)}  gebucht ${z.gebucht}`);
  }
}
