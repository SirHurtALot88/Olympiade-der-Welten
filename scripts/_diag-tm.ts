/* eslint-disable no-console */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { previewLocalTransfermarktBuy } from "@/lib/market/transfermarkt-local-service";

async function main() {
  const persistence = createPersistenceService();
  const saveId = process.argv[2];
  const nameQ = process.argv[3] ?? "Brightpaw";
  const teamId = process.argv[4] ?? "";
  const save = persistence.getSaveById(saveId);
  if (!save) { console.log("no save"); return; }
  const gs = save.gameState;
  console.log("teams", gs.teams.map((t: any) => `${t.teamId}:${t.shortCode}`).join(" "));
  const p = gs.players.filter((x: any) => x.name.includes(nameQ));
  console.log(p.map((x: any) => `${x.id} ${x.name} sal=${x.salaryDemand} mv=${x.marketValue} tr+=${x.traitsPositive} tr-=${x.traitsNegative}`));
  if (!teamId) return;
  for (const len of [undefined, 1, 2, 3, 4]) {
    const r: any = previewLocalTransfermarktBuy({ saveId, teamId, playerId: p[0].id, contractLength: len, dryRun: true } as any);
    console.log(len, "salary(liste)=", r.salary, "expected=", r.expectedSalary, "base=", r.baseExpectedSalary, "mult=", r.demandMultiplier, "len", r.contractLength, r.contractShape, "accept>=", r.acceptThresholdSalary, "verdict", r.verdict);
    if (len === undefined) console.log(JSON.stringify(r.demandBreakdown?.map((d: any) => `${d.key}:${d.multiplier}`)));
  }
}
main();
