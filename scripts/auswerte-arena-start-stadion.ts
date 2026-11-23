/**
 * START-STADION UND START-FANS JE TEAM (23.11., Fan-Modell organisch): liest einen frisch angelegten Messlauf-Spielstand
 * (`scripts/miss-teamfinanzen-saison.ts --nur-anlage --keep`, Wegwerf-SQLite) und zeigt je Team Liga, Matrix-Beliebtheit, Budget und das
 * Start-Stadion samt Start-Fanbasis (`neuerArenaStand`). OLY_APP_SQLITE_PATH=<Kopie> npx tsx scripts/auswerte-arena-start-stadion.ts <saveId>
 */
import { neuerArenaStand } from "@/lib/arena/arena-stand";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const saveId = process.argv[2];
const save = saveId ? createPersistenceService().getSaveById(saveId) : null;
if (!save) throw new Error("Aufruf: auswerte-arena-start-stadion.ts <saveId>");
const gs = save.gameState;
console.log("Team | Liga | Beliebtheit (Matrix) | Budget | Start-Plaetze | Start-Fanbasis");
const zeilen = gs.teams.map((t) => {
  const h = neuerArenaStand(gs, t.teamId);
  const pop = gs.teamIdentities?.find((i) => i.teamId === t.teamId)?.popularity ?? 0;
  const pl = h.plaetze.steh + h.plaetze.sitz + h.plaetze.loge;
  return { id: t.teamId, liga: gs.seasonState.leagueByTeamId?.[t.teamId] ?? "-", pop, budget: t.budget, pl, fans: h.fanbasis };
});
zeilen.sort((a, b) => b.pl - a.pl || b.fans - a.fans);
for (const z of zeilen) console.log(`${z.id} | ${z.liga} | ${z.pop} | ${z.budget} | ${z.pl} | ${z.fans}`);
