/* eslint-disable no-console */
/**
 * WAS DIE BANK EINEM KI-TEAM ZUTRAUT — und warum sie auch dann Ja sagt, wenn die Fixkosten die
 * Einnahmen längst übersteigen.
 *
 * Chris' Frage zu `cankgm`: „darf ein Team mit 115 Gehalt und 1,2 Cash überhaupt aufnehmen?"
 *
 * DER KREDITRAHMEN entsteht in `disposableDebtServiceBudget` (ai-loan-decision-service.ts):
 *
 *     nachFixkosten = Einnahme − Gehalt × SALARY_SERVICE_WEIGHT − Gebäude-Unterhalt
 *     RAHMEN        = max(Einnahme × MIN_DEBT_SERVICE_FLOOR, nachFixkosten)
 *
 * Zwei Stellen darin entscheiden mehr, als sie aussehen:
 *
 *   1. `SALARY_SERVICE_WEIGHT = 0,6` — nur 60 % des Gehalts zählen als Fixkosten. Der größte
 *      Posten wird also systematisch zu klein angesetzt.
 *   2. `MIN_DEBT_SERVICE_FLOOR = 0,15` — der Rahmen fällt NIE unter 15 % der Einnahme, auch wenn
 *      `nachFixkosten` tief negativ ist. Ein Team, dessen Gehalt seine gesamte Einnahme
 *      übersteigt, bekommt damit trotzdem Kreditrahmen.
 *
 * Dieses Skript zählt aus, wie oft der Boden trägt statt der Rechnung.
 *
 * Nutzung:
 *   OLY_APP_SQLITE_PATH=/pfad/zur/kopie.sqlite npx tsx scripts/messe-ki-kreditrahmen.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getTeamSalarySum } from "@/lib/ai/ai-cash-salary-target-service";
import { estimateTeamAnnualRevenue } from "@/lib/finance/loan-service";
import { calculateFacilityUpkeep, getTeamFacilityState } from "@/lib/facilities/facility-effects";

const SALARY_SERVICE_WEIGHT = 0.6;
const MIN_DEBT_SERVICE_FLOOR = 0.15;

const p = createPersistenceService();
let gesamtBoden = 0;
let gesamtTeams = 0;
for (const e of p.listSaves()) {
  const gs = p.getSaveById(e.saveId)?.gameState as GameState | undefined;
  if (!gs?.teams?.length) continue;
  const zeilen = gs.teams.map((t) => {
    const einnahme = estimateTeamAnnualRevenue(gs, t.teamId);
    const gehalt = getTeamSalarySum(gs, t.teamId);
    const unterhalt = calculateFacilityUpkeep(getTeamFacilityState(gs, t.teamId));
    const nachFixkosten = einnahme - gehalt * SALARY_SERVICE_WEIGHT - unterhalt;
    const boden = einnahme * MIN_DEBT_SERVICE_FLOOR;
    return { id: t.teamId, einnahme, gehalt, unterhalt, nachFixkosten, boden, budget: Math.max(boden, nachFixkosten), cash: t.cash ?? 0 };
  });
  const amBoden = zeilen.filter((z) => z.nachFixkosten < z.boden && z.einnahme > 0);
  const echtNegativ = zeilen.filter((z) => z.nachFixkosten < 0);
  gesamtBoden += amBoden.length;
  gesamtTeams += zeilen.length;
  console.log(
    `${String(e.saveId).slice(-6)}  Teams deren Rahmen NUR vom Boden kommt: ${String(amBoden.length).padStart(2)}/${zeilen.length}` +
      `   davon rechnerisch NEGATIV: ${echtNegativ.length}`,
  );
  for (const z of echtNegativ.sort((a, b) => a.nachFixkosten - b.nachFixkosten).slice(0, 3)) {
    console.log(
      `      ${z.id.padEnd(4)} Einnahme ${z.einnahme.toFixed(1).padStart(6)}  Gehalt ${z.gehalt.toFixed(1).padStart(6)} (x0,6 = ${(z.gehalt * 0.6).toFixed(1)})  Unterhalt ${z.unterhalt.toFixed(1)}` +
        `  ->  nach Fixkosten ${z.nachFixkosten.toFixed(1).padStart(7)}   Boden ${z.boden.toFixed(1).padStart(5)}   RAHMEN ${z.budget.toFixed(1).padStart(5)}   Cash ${z.cash.toFixed(1)}`,
    );
  }
}
console.log(`\nGESAMT: ${gesamtBoden} von ${gesamtTeams} Teamzeilen bekommen ihren Kreditrahmen NUR ueber den Boden.`);
