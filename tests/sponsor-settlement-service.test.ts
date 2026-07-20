import { describe, expect, it } from "vitest";

import type { GameState, SponsorOfferComponent, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { applySponsorSettlement, previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";

function withSpecialContract(teamId: string, component: SponsorOfferComponent): GameState {
  const gs = structuredClone(createSingleplayerGameState());
  const contract: TeamSponsorContract = {
    seasonId: gs.season.id,
    teamId,
    offerId: "settlement-test-offer",
    archetype: "security",
    name: "Settlement Test",
    chosenAt: new Date().toISOString(),
    startRank: 16,
    components: [component],
    payouts: {},
    rarity: "magisch",
    teamQualityRankAtSign: 16,
  };
  gs.seasonState.sponsorContractsByTeamId = {
    ...(gs.seasonState.sponsorContractsByTeamId ?? {}),
    [teamId]: contract,
  };
  return gs;
}

function specialRow(gs: GameState, teamId: string) {
  const preview = previewSponsorSettlement(gs, "season_end");
  return preview.rows.find((row) => row.teamId === teamId && row.kind === "special") ?? null;
}

describe("sponsor settlement — special component fraction payout (Teil B)", () => {
  it("keeps binary specials backward-compatible (full rewardCash or 0)", () => {
    // form_color_cover ohne stages = Legacy-binär. Zielfarben 99 → unerfüllbar → 0.
    const gs = withSpecialContract(gs0Team(), {
      componentId: "special-roster-form",
      kind: "special",
      label: "Kader-Form",
      targetValue: "99 Farben",
      rewardCash: 8,
      specialKey: "form_color_cover",
    });
    const row = specialRow(gs, gs0Team());
    expect(row?.cashDelta).toBe(0);
    expect(row?.status).toBe("skipped");
  }, 60000);

  it("pays a staged special proportionally to the reached stage", () => {
    const teamId = gs0Team();
    const seasonId = createSingleplayerGameState().season.id;
    // transfer_trader Stufen: >0 → 0.4 / >12 → 0.7 / >24 → 1.0. Netto knapp positiv → Stufe 1 (0.4).
    const gs = withSpecialContract(teamId, {
      componentId: "special-transfer-trader",
      kind: "special",
      label: "Transfer-Händler",
      targetValue: "transfer_window",
      rewardCash: 10,
      specialKey: "transfer_trader",
      stages: [
        { threshold: 0.01, fraction: 0.4, label: "Netto >0" },
        { threshold: 12, fraction: 0.7, label: "Netto >12" },
        { threshold: 24, fraction: 1.0, label: "Netto >24" },
      ],
      spotlightBonus: 0.25,
    });
    gs.transferHistory = [
      { id: "s1", playerId: "p1", seasonId, transferType: "sell", fromTeamId: teamId, toTeamId: null, fee: 8, netCashImpact: 8 },
      { id: "b1", playerId: "p2", seasonId, transferType: "buy", fromTeamId: null, toTeamId: teamId, fee: 3, netCashImpact: 3 },
    ] as never;
    const row = specialRow(gs, teamId);
    // net = 8 − 3 = 5 → nur Stufe 1 (0.4) → 10 × 0.4 = 4.
    expect(row?.cashDelta).toBe(4);
    expect(row?.status).toBe("paid");
  }, 60000);

  it("scales fan_infrastructure continuously (levelSum / CAP)", () => {
    const teamId = gs0Team();
    const gs = withSpecialContract(teamId, {
      componentId: "special-fan-infrastructure",
      kind: "special",
      label: "Fan-Infrastruktur",
      targetValue: 1,
      rewardCash: 12,
      specialKey: "fan_infrastructure",
    });
    gs.seasonState.teamFacilities = {
      ...(gs.seasonState.teamFacilities ?? {}),
      [teamId]: { facilities: { fan_shop: { level: 3, enabled: true } } },
    } as never;
    const row = specialRow(gs, teamId);
    // levelSum 3 / CAP 6 = 0.5 → 12 × 0.5 = 6.
    expect(row?.cashDelta).toBe(6);
  }, 60000);

  it("applies the fractional special payout to team cash", () => {
    const teamId = gs0Team();
    const gs = withSpecialContract(teamId, {
      componentId: "special-solvency",
      kind: "special",
      label: "Solvenz",
      targetValue: "solvency",
      rewardCash: 5,
      specialKey: "solvency_series",
      stages: [{ threshold: 0.01, fraction: 1.0, label: "Kasse positiv" }],
    });
    gs.teams = gs.teams.map((team) => (team.teamId === teamId ? { ...team, cash: 100 } : team));
    const before = gs.teams.find((t) => t.teamId === teamId)!.cash;
    const applied = applySponsorSettlement({ gameState: gs, saveId: "settle-test", phase: "season_end", execute: true });
    const after = applied.gameState.teams.find((t) => t.teamId === teamId)!.cash;
    expect(applied.applied).toBe(true);
    expect(after).toBeGreaterThan(before); // voller Bonus (5) gutgeschrieben
  }, 60000);
});

function gs0Team(): string {
  return createSingleplayerGameState().teams[0]!.teamId;
}
