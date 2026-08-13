import { describe, expect, it } from "vitest";

import { applyAiMarketPlanLocally } from "@/lib/ai/ai-market-plan-apply-service";
import { AI_MARKET_APPLY_CONFIRM_TOKEN } from "@/lib/ai/ai-market-plan-apply-contract";
import { countSeasonBuyTransfers } from "@/lib/season/transfer-season-policy";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { executeLocalTransfermarktBuy } from "@/lib/market/transfermarkt-local-service";
import { SEASON_ONE_MARKET_BUY_BLOCKER } from "@/lib/season/transfer-season-policy";

// Course correction (2026-07-04): S1 buys are NOT forbidden — the draft is just the first
// ordinary application of the same acquisition engine to empty rosters with starting budget. A
// team that sells down (or organically drops) below hardMin/Opt in S1 must be able to rebuy in
// the same season via the Unified-backed convergence/apply path, exactly like any later season.
// This test used to assert the opposite (S1 market buys hard-blocked); it now asserts the new,
// intended behaviour.
/**
 * ZEITLIMIT: Nachgemessen braucht der zweite Fall `createFreshSeasonOneSave` 4,8 s plus
 * `applyAiMarketPlanLocally` 55,4 s — zusammen 60,1 s gegen ein Limit von 60 s. Er ist also
 * nicht am Inhalt gescheitert, sondern um 100 ms am Budget: Die geprueften Zusagen
 * (`season_market_buy_forbidden` kommt nicht mehr vor) waren jedes Mal erfuellt.
 *
 * 180 s geben dem echten Liga-Durchlauf Luft, ohne eine Verlangsamung zu verstecken — der
 * gemessene Lauf braucht ein Drittel davon.
 */
const S1_MARKTLAUF_TIMEOUT_MS = 180_000;

describe("season-one long-run market buy (course-corrected)", () => {
  it("permits a S1 market buy through applyAiMarketPlanLocally and direct execute", async () => {
    const persistence = createPersistenceService();
    const fresh = persistence.createFreshSeasonOneSave({
      name: `S1 market buy regression ${Date.now()}`,
    });
    const seasonId = fresh.gameState.season.id;
    const teamId = fresh.gameState.teams[0]?.teamId;
    const playerId = fresh.gameState.players.find((player) =>
      !fresh.gameState.rosters.some((entry) => entry.playerId === player.id),
    )?.id;
    expect(teamId).toBeTruthy();
    expect(playerId).toBeTruthy();

    /**
     * GEMESSEN WIRD DER ZUWACHS, NICHT DER ABSOLUTE STAND.
     *
     * Frueher stand hier `expect(counts.marketBuyCount).toBe(1)` — ein frischer Spielstand
     * hatte keine Kaeufe. Das gilt nicht mehr: P-S kauft seit dem Nula-Befund schon beim
     * Anlegen des Spielstands sein Maskottchen (`nula_mascot_rule_buy`,
     * lib/foundation/ensure-nula-on-project-suicide.ts), und diese Quelle steht NICHT in
     * `SEASON_ONE_DRAFT_BUY_SOURCES` — sie zaehlt also als MARKTKAUF. Der frische Stand
     * startet damit bei 1, der Test sah 2.
     *
     * Die Zusicherung dieses Tests ist „ein Marktkauf in S1 ist erlaubt und wird gebucht" —
     * das ist eine Aussage ueber den ZUWACHS. Absolut gemessen haengt sie an jeder kuenftigen
     * Regel, die beim Anlegen etwas kauft, und sagt trotzdem nichts mehr ueber den Kauf, um
     * den es geht.
     *
     * Ob der Maskottchen-Kauf in der Marktkauf-Statistik auftauchen SOLL, ist eine offene
     * Frage an Chris (docs/ROTE_TESTS_TRIAGE.md). Er wird nirgends als Sperre ausgewertet,
     * nur in Audits und Berichten.
     */
    const vorher = countSeasonBuyTransfers(fresh.gameState.transferHistory, seasonId);

    const directBuy = executeLocalTransfermarktBuy({
      saveId: fresh.saveId,
      seasonId,
      teamId: teamId!,
      playerId: playerId!,
      transferSource: "ai_preseason_market_buy",
    });
    expect(directBuy.blockingReasons).not.toContain(SEASON_ONE_MARKET_BUY_BLOCKER);
    expect(directBuy.transferCreated).toBe(true);

    const after = persistence.getSaveById(fresh.saveId);
    expect(after).toBeTruthy();
    const counts = countSeasonBuyTransfers(after!.gameState.transferHistory, seasonId);
    expect(counts.marketBuyCount - vorher.marketBuyCount).toBe(1);
    // Und er landet als MARKTkauf, nicht als Draft-Kauf — sonst waere die Zusage umgangen.
    expect(counts.draftBuyCount).toBe(vorher.draftBuyCount);
  }, S1_MARKTLAUF_TIMEOUT_MS);

  it("no longer forbids S1 market buys in applyAiMarketPlanLocally's marketBuysAllowed gate", async () => {
    const persistence = createPersistenceService();
    const fresh = persistence.createFreshSeasonOneSave({
      name: `S1 market apply regression ${Date.now()}`,
    });
    const seasonId = fresh.gameState.season.id;

    const marketApply = await applyAiMarketPlanLocally({
      source: "sqlite",
      saveId: fresh.saveId,
      seasonId,
      dryRun: false,
      transferPhase: "manual_transfer_window",
      confirmToken: AI_MARKET_APPLY_CONFIRM_TOKEN,
      options: {
        applyBuySteps: true,
        applySellSteps: false,
      },
    });

    expect(marketApply.warnings).not.toContain("season_market_buy_forbidden");
  }, S1_MARKTLAUF_TIMEOUT_MS);
});
