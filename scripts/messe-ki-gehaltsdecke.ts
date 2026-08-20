/* eslint-disable no-console */
/**
 * HAELT DIE KI IHRE EIGENE GEHALTSDECKE EIN — und welche Decke ueberhaupt?
 *
 * CHRIS: „die AI teams müssen das auch besser verstehen und bessere verträge verhandeln! das ist
 * überlebenswichtig!!!"
 *
 * ES GIBT ZWEI DECKEN, und sie beantworten verschiedene Fragen:
 *
 *   1. `resolveTeamApronSalaryCeiling` — die AMBITIONS-Decke an den Apron-Linien. Sie sagt, ab wann
 *      ein Team Luxussteuer zahlen WILL. Sie bremst nur (`resolveApronTighteningMultiplier`, Boden
 *      0,5) und stoppt nie.
 *   2. `computeTeamSalaryCeiling` (organic-squad/salary-ceiling.ts) — die TRAGFAEHIGKEITS-Decke aus
 *      den eigenen Einnahmen minus Fixkosten. Das ist die Ueberlebensfrage, und genau die, die
 *      Chris meint.
 *
 * DIE ZWEITE IST IN PRODUKTION AUS. Sie haengt an `OLY_SALARY_CEILING_V2 === "1"`
 * (organic-squad/draft-adapter.ts), und `deploy/hetzner/docker-compose.yml` reicht diese Variable
 * gar nicht erst in den Container — die dort gelistete Env-Liste ist abschliessend.
 *
 * WORAUF BEIM LESEN DER ZAHLEN ZU ACHTEN IST, sonst misst man Unsinn: `estimateTeamAnnualRevenue`
 * ist ein VORSAISON-Proxy und liest die zuletzt ABGERECHNETE Sponsorenzahlung. In Saison 1 gibt es
 * die noch nicht, der Proxy liegt dort rund um ein Drittel der echten Vertragsbasis (gemessen:
 * L-R 12,0 gegen 34,2 · T-T 16,8 gegen 47,9). Eine ligaweite Quote ueber ALLE Spielstaende zaehlt
 * deshalb vor allem Saison-1-Staende falsch. Belastbar ist die Messung ab Saison 2.
 *
 * Aufruf:
 *   OLY_APP_SQLITE_PATH=<pfad> npx tsx scripts/messe-ki-gehaltsdecke.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { computeTeamSalaryCeiling } from "@/lib/ai/organic-squad/salary-ceiling";
import { estimateTeamAnnualRevenue, getTeamAnnualLoanInstallment } from "@/lib/finance/loan-service";
import { calculateFacilityUpkeep, getTeamFacilityState } from "@/lib/facilities/facility-effects";
import { getTeamApronSalaryBase } from "@/lib/season/apron-service";
import { getTeamSponsorContract } from "@/lib/sponsor/sponsor-offer-read";
import type { GameState } from "@/lib/data/olyDataTypes";
const persistence = createPersistenceService();
const r = (x: number) => (Number.isFinite(x) ? (Math.round(x * 10) / 10).toFixed(1) : "∞");
for (const [saveEnd, teams] of [["0kalpx", ["L-R", "T-T", "A-A"]], ["hwz8fk", ["M-M", "L-R"]]] as const) {
  const kopf = persistence.listSaves().find((k) => k.saveId.endsWith(saveEnd));
  if (!kopf) continue;
  const gs = persistence.getSaveById(kopf.saveId)!.gameState as GameState;
  console.log(`\n=== ${saveEnd} · ${gs.season.id}`);
  for (const teamId of teams) {
    const cash = (gs.teams.find((t) => t.teamId === teamId) as any)?.cash ?? 0;
    const proxy = estimateTeamAnnualRevenue(gs, teamId);
    const upkeep = calculateFacilityUpkeep(getTeamFacilityState(gs, teamId));
    const kredit = getTeamAnnualLoanInstallment(gs, teamId);
    const d: any = computeTeamSalaryCeiling(gs, teamId, { teamCash: cash });
    const v: any = getTeamSponsorContract(gs, teamId);
    const basis = (v?.components ?? []).find((c: any) => c.kind === "base")?.rewardCash ?? null;
    console.log(`  ${teamId.padEnd(5)} Gehalt ${r(getTeamApronSalaryBase(gs, teamId)).padStart(6)} · Einnahme-Proxy ${r(proxy).padStart(6)} (Vertragsbasis ${basis == null ? "—" : r(basis)})`);
    console.log(`        Fixkosten ${r(upkeep + kredit)} (Gebaeude ${r(upkeep)} + Kredit ${r(kredit)}) → tragfaehig ${r(d.sustainableSalary)} · Decke ${r(d.salaryCeiling)} · Cash ${r(cash)}`);
  }
}
