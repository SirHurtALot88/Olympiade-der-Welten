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

describe("sponsor settlement — P3 overperformance + per-place improvement", () => {
  function withComponentAtRank(
    component: SponsorOfferComponent,
    currentRank: number,
    startRank = 16,
  ): { gs: GameState; teamId: string } {
    const teamId = gs0Team();
    const gs = structuredClone(createSingleplayerGameState());
    const contract: TeamSponsorContract = {
      seasonId: gs.season.id,
      teamId,
      offerId: "p3-test-offer",
      archetype: "performance",
      name: "P3 Test",
      chosenAt: new Date().toISOString(),
      startRank,
      components: [component],
      payouts: {},
      rarity: "magisch",
      teamQualityRankAtSign: 16,
    };
    gs.seasonState.sponsorContractsByTeamId = {
      ...(gs.seasonState.sponsorContractsByTeamId ?? {}),
      [teamId]: contract,
    };
    gs.seasonState.standings = {
      ...(gs.seasonState.standings ?? {}),
      [teamId]: { rank: currentRank, points: 100 },
    } as GameState["seasonState"]["standings"];
    return { gs, teamId };
  }
  function rowFor(gs: GameState, teamId: string, kind: SponsorOfferComponent["kind"]) {
    return previewSponsorSettlement(gs, "season_end").rows.find((r) => r.teamId === teamId && r.kind === kind) ?? null;
  }

  it("overperformance pays min(cap, rate × ranks above the frozen expected rank)", () => {
    const comp: SponsorOfferComponent = {
      componentId: "overperformance",
      kind: "overperformance",
      label: "Überperformance",
      targetValue: 16, // eingefrorener Erwartungsrang
      rewardCash: 14, // Cap
      ratePerUnitC: 1.8,
    };
    // Endrang 12 → 4 Plätze über Erwartung #16 → 1.8×4 = 7.2 C
    const a = withComponentAtRank(comp, 12);
    expect(rowFor(a.gs, a.teamId, "overperformance")?.cashDelta).toBeCloseTo(7.2, 1);
    // Endrang 2 → 14 Plätze → 1.8×14 = 25.2, gedeckelt bei 14
    const b = withComponentAtRank(comp, 2);
    expect(rowFor(b.gs, b.teamId, "overperformance")?.cashDelta).toBe(14);
    // Endrang = Erwartung (16) → 0, skipped
    const c = withComponentAtRank(comp, 16);
    expect(rowFor(c.gs, c.teamId, "overperformance")?.cashDelta).toBe(0);
    expect(rowFor(c.gs, c.teamId, "overperformance")?.status).toBe("skipped");
  }, 60000);

  it("per-place improvement pays min(cap, rate × places improved vs start rank)", () => {
    const comp: SponsorOfferComponent = {
      componentId: "improvement-target",
      kind: "improvement",
      label: "Tabellenziel",
      targetValue: 1,
      rewardCash: 9, // Cap = rate × maxUnits
      ratePerUnitC: 1.5,
      maxUnits: 6,
    };
    // startRank 16, Endrang 13 → +3 Plätze → 1.5×3 = 4.5 C
    const a = withComponentAtRank(comp, 13, 16);
    expect(rowFor(a.gs, a.teamId, "improvement")?.cashDelta).toBeCloseTo(4.5, 1);
    // Endrang 4 → +12 Plätze → 1.5×12 = 18, gedeckelt bei 9
    const b = withComponentAtRank(comp, 4, 16);
    expect(rowFor(b.gs, b.teamId, "improvement")?.cashDelta).toBe(9);
    // schlechter als Start (Endrang 20) → 0
    const c = withComponentAtRank(comp, 20, 16);
    expect(rowFor(c.gs, c.teamId, "improvement")?.cashDelta).toBe(0);
  }, 60000);

  it("keeps legacy binary improvement (no ratePerUnitC) backward-compatible", () => {
    const comp: SponsorOfferComponent = {
      componentId: "improvement-target",
      kind: "improvement",
      label: "≥ 2 Plätze verbessern",
      targetValue: 2,
      rewardCash: 3,
    };
    const a = withComponentAtRank(comp, 13, 16); // +3 ≥ 2 → voller Reward 3
    expect(rowFor(a.gs, a.teamId, "improvement")?.cashDelta).toBe(3);
    const b = withComponentAtRank(comp, 15, 16); // +1 < 2 → 0
    expect(rowFor(b.gs, b.teamId, "improvement")?.cashDelta).toBe(0);
  }, 60000);

  it("P4b clause fires a frozen malus only in the drop zone", () => {
    const clause: SponsorOfferComponent = {
      componentId: "clause-relegation",
      kind: "clause",
      label: "Abstiegs-Klausel: −7 C bei Platz ≥ 29",
      targetValue: 29,
      rewardCash: 0,
      penaltyCash: 7,
    };
    // Endrang 30 (≥ Schwelle 29) → Malus feuert.
    const dropZone = withComponentAtRank(clause, 30, 16);
    const dropRow = rowFor(dropZone.gs, dropZone.teamId, "clause");
    expect(dropRow?.cashDelta).toBe(-7);
    expect(dropRow?.status).toBe("failed_penalty");
    // Endrang 20 (< Schwelle) → kein Effekt.
    const safe = withComponentAtRank(clause, 20, 16);
    const safeRow = rowFor(safe.gs, safe.teamId, "clause");
    expect(safeRow?.cashDelta).toBe(0);
    expect(safeRow?.status).toBe("skipped");
    // Genau AUF der Schwelle (29) → feuert ebenfalls (≥).
    const onThreshold = withComponentAtRank(clause, 29, 16);
    expect(rowFor(onThreshold.gs, onThreshold.teamId, "clause")?.cashDelta).toBe(-7);
  }, 60000);
});

function gs0Team(): string {
  return createSingleplayerGameState().teams[0]!.teamId;
}
