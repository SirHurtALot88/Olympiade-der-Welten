/* eslint-disable no-console */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { bewerteKiRehaFuerTeam } from "@/lib/ai/ai-reha-bau-service";
import { previewFacilityUpgrade } from "@/lib/facilities/facility-upgrade-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { berechneVorstandBudgetStand } from "@/lib/finance/vorstand-budgetfreigabe";

const SAVE_ID = process.env.OLY_MESS_SAVE ?? "new-game-1795114260527-nzr0z9";
const p = createPersistenceService();
const save = p.getSaveById(SAVE_ID)!;
const gs = save.gameState;
console.log("Saison", gs.season.id, "Spieltag", gs.matchdayState.matchdayId);
const rows = [];
for (const t of gs.teams) {
  const b = bewerteKiRehaFuerTeam(gs, t.teamId);
  const v = previewFacilityUpgrade(save, t.teamId, "recovery_center");
  const st = berechneVorstandBudgetStand(gs, t.teamId);
  rows.push({
    team: t.teamId,
    cash: Number((t.cash ?? 0).toFixed(1)),
    stufe: b?.aktuelleStufe,
    frei: Number((b?.freiesGeld ?? 0).toFixed(1)),
    ziel: b?.zielStufe,
    bauen: b?.bauen,
    geld: b?.amGeldGescheitert,
    grund: b?.grund.join(","),
    prevOk: v.ok,
    block: v.blockingReasons.join(","),
    gedeckelt: st.gedeckelt,
  });
}
console.table(rows);
