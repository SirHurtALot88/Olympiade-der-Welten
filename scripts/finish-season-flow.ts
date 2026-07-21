/* eslint-disable no-console */
// Focused continuation of the season playthrough: takes an ALREADY season-completed save
// and exercises the remaining human flow — season completion settle → pre-season S2 setup
// → sell a player → buy a player in S2 → report. Backend service layer (same functions the
// full-season UI harness uses); UI rendering of these flows was verified separately.
import { loadEnvConfig } from "@next/env";

import {
  executeLocalTransfermarktBuy,
  executeLocalTransfermarktSell,
  listLocalTransfermarktFreeAgents,
  previewLocalTransfermarktBuy,
  previewLocalTransfermarktSell,
} from "@/lib/market/transfermarkt-local-service";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  applyPreSeasonNextSeasonSetupLightweight,
  buildPreSeasonNextSeasonSetupToken,
} from "@/lib/season/preseason-workflow-service";
import { runLocalSeasonCompletion, SEASON_COMPLETION_CONFIRM_TOKEN } from "@/lib/season/season-completion-service";

loadEnvConfig(process.cwd());

const SAVE_ID = process.env.FLOW_SAVE ?? "fresh-season-1-1784625881771";
const TEAM_ID = process.env.FLOW_TEAM ?? "A-A";

function req<T>(v: T | null | undefined, msg: string): T {
  if (v == null) throw new Error(msg);
  return v;
}

async function main() {
  const persistence = createPersistenceService();
  const steps: Array<{ label: string; status: "ok" | "fail" | "skip"; detail: string }> = [];
  const add = (label: string, status: "ok" | "fail" | "skip", detail: string) => {
    steps.push({ label, status, detail });
    console.log(`${status.toUpperCase()} ${label} — ${detail}`);
  };

  let save = req(persistence.getSaveById(SAVE_ID), `Save ${SAVE_ID} not found`);
  const s1 = save.gameState.season.id;
  const teamCashBefore = save.gameState.teams.find((t) => t.teamId === TEAM_ID)?.cash ?? null;
  add("load", "ok", `save=${SAVE_ID} team=${TEAM_ID} season=${s1} phase=${save.gameState.gamePhase} cash=${teamCashBefore}`);

  // 1) Season completion settle (S1 → review). Idempotent if already completed.
  const completion = await runLocalSeasonCompletion(
    { saveId: SAVE_ID, seasonId: s1, source: "sqlite", execute: true, dryRun: false, confirmToken: SEASON_COMPLETION_CONFIRM_TOKEN },
    persistence,
  );
  add("season-completion", completion.ok && completion.applied ? "ok" : "fail", completion.ok && completion.applied ? "S1 abgeschlossen/settled." : `blocked: ${completion.blockingReasons?.join(" | ") ?? "?"}`);

  // 2) Pre-season → S2 setup (season transition).
  save = req(persistence.getSaveById(SAVE_ID), "Save missing after completion.");
  const token = buildPreSeasonNextSeasonSetupToken(save).confirmToken;
  const s2setup = applyPreSeasonNextSeasonSetupLightweight(save, token, persistence);
  save = req(persistence.getSaveById(SAVE_ID), "Save missing after S2 setup.");
  const s2 = save.gameState.season.id;
  add("season-transition", s2setup.applied ? "ok" : "fail", s2setup.applied ? `S2 aktiv: season=${s2} phase=${save.gameState.gamePhase ?? "—"}.` : `blocked: ${s2setup.blockingReasons?.join(" | ") ?? "?"}`);

  // 3) Sell a roster player in S2 (season transition transfer window).
  const rosterEntry = save.gameState.rosters.find((r) => r.teamId === TEAM_ID);
  if (!rosterEntry) {
    add("sell", "skip", "kein Roster-Eintrag für Team.");
  } else {
    const sellPreview = previewLocalTransfermarktSell({ saveId: SAVE_ID, seasonId: s2, teamId: TEAM_ID, activePlayerId: rosterEntry.id });
    if (!sellPreview.canSell) {
      add("sell", "skip", `Verkauf gesperrt: ${(sellPreview.blockingReasons ?? []).join(" | ") || "canSell=false"}`);
    } else {
      const sellResult = executeLocalTransfermarktSell({ saveId: SAVE_ID, seasonId: s2, teamId: TEAM_ID, activePlayerId: rosterEntry.id });
      add("sell", sellResult.canSell ? "ok" : "fail", sellResult.canSell ? `Spieler ${rosterEntry.playerId} verkauft.` : "Verkauf-Apply fehlgeschlagen.");
      save = req(persistence.getSaveById(SAVE_ID), "Save missing after sell.");
    }
  }

  // 4) Buy a free agent in S2 ("nochmal Spieler kaufen").
  const freeAgents = listLocalTransfermarktFreeAgents({ saveId: SAVE_ID, seasonId: s2, teamId: TEAM_ID, limit: 60 });
  const buyCandidate = freeAgents.items.find((item) =>
    previewLocalTransfermarktBuy({ saveId: SAVE_ID, seasonId: s2, teamId: TEAM_ID, playerId: item.playerId }).canBuy,
  );
  if (!buyCandidate) {
    add("buy-s2", "skip", `kein kaufbarer Free Agent (von ${freeAgents.items.length} geprüft).`);
  } else {
    const buyResult = executeLocalTransfermarktBuy({ saveId: SAVE_ID, seasonId: s2, teamId: TEAM_ID, playerId: buyCandidate.playerId });
    add("buy-s2", buyResult.canBuy ? "ok" : "fail", buyResult.canBuy ? `Free Agent ${buyCandidate.playerId} in S2 gekauft.` : "Kauf-Apply fehlgeschlagen.");
    save = req(persistence.getSaveById(SAVE_ID), "Save missing after buy.");
  }

  const teamCashAfter = save.gameState.teams.find((t) => t.teamId === TEAM_ID)?.cash ?? null;
  const rosterCount = save.gameState.rosters.filter((r) => r.teamId === TEAM_ID).length;
  add("final", "ok", `S2=${save.gameState.season.id} phase=${save.gameState.gamePhase} cash=${teamCashAfter} rosterSize(${TEAM_ID})=${rosterCount}`);

  const failed = steps.filter((s) => s.status === "fail");
  console.log(`\n===== FINISH-FLOW ${failed.length === 0 ? "OK" : "HAD FAILURES"} (${steps.filter((s)=>s.status==="ok").length} ok / ${steps.filter((s)=>s.status==="skip").length} skip / ${failed.length} fail) =====`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
  process.exit(1);
});
