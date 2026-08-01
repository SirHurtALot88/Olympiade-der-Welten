/**
 * SETTLEMENT DES SONDERZIELS unter dem V3-Sponsormodell.
 *
 * Was sich gegenueber V2 geaendert hat und warum diese Datei anders prueft als vorher:
 *  - Die Zielpraemie steht NICHT mehr in `component.rewardCash`, sondern im Vertrag (`goalSize`,
 *    nach Rarity). Ein Test, der `rewardCash × fraction` erwartet, wuerde eine Groesse pruefen, die
 *    das Settlement gar nicht mehr liest.
 *  - Das Ziel ist FAIR BEPREIST: die Zeile enthaelt zusaetzlich den Sockelabzug `−p·G`, der auch bei
 *    Misserfolg faellig wird. Absolute Betraege sind deshalb nicht mehr die interessante Groesse —
 *    die Zusage des Entwurfs ist, dass die DIFFERENZ zwischen "erreicht" und "verfehlt" exakt
 *    `fraction × G` ist. Genau das wird hier geprueft.
 *  - Die Komponentenarten `improvement` und `overperformance` gibt es nicht mehr: die Rangleiter IST
 *    die Preisgeld-Benchmark und traegt Verbesserung und Ueberperformance bereits in sich
 *    (Platzierungsbonus gegen den Startrang). Die frueheren Tests dafuer sind mit den Modulen
 *    entfallen.
 */
import { describe, expect, it } from "vitest";

import type { GameState, SponsorOfferComponent, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { applySponsorSettlement, previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { sponsorV3GoalSizeFor } from "@/lib/sponsor/sponsor-v3-offer-service";

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

/**
 * Die Zielzeile bei VERFEHLTEM Ziel — der reine Sockelabzug −p·G. Gegen ihn wird gemessen, wie viel
 * eine erreichte Stufe wirklich zusaetzlich bringt.
 */
function missedGoalRow(component: SponsorOfferComponent): number {
  const teamId = gs0Team();
  const gs = withSpecialContract(teamId, component);
  // Ohne jede Datengrundlage erreicht kein Ziel eine Stufe.
  return specialRow(gs, teamId)?.cashDelta ?? 0;
}

const GOAL_SIZE_MAGISCH = sponsorV3GoalSizeFor("magisch");

describe("sponsor settlement — Sonderziel-Stufen unter dem V3-Modell", () => {
  it("ein verfehltes Ziel kostet den Sockelabzug — und nur ihn", () => {
    // form_color_cover ohne stages = binaeres Legacy-Ziel. Zielfarben 99 → unerfuellbar.
    const teamId = gs0Team();
    const gs = withSpecialContract(teamId, {
      componentId: "special-roster-form",
      kind: "special",
      label: "Kader-Form",
      targetValue: "99 Farben",
      rewardCash: 8,
      specialKey: "form_color_cover",
    });
    const row = specialRow(gs, teamId);
    // Der Abzug ist p·G und liegt damit im Band (0,15 … 0,72) × 7,5 C.
    expect(row?.cashDelta).toBeLessThan(0);
    expect(row?.cashDelta).toBeGreaterThanOrEqual(-GOAL_SIZE_MAGISCH * 0.72 - 0.05);
    expect(row?.status).toBe("skipped");
  }, 60000);

  it("eine erreichte Stufe zahlt exakt fraction × G ueber dem verfehlten Fall", () => {
    const teamId = gs0Team();
    const seasonId = createSingleplayerGameState().season.id;
    const component: SponsorOfferComponent = {
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
    };
    const gs = withSpecialContract(teamId, component);
    gs.transferHistory = [
      { id: "s1", playerId: "p1", seasonId, transferType: "sell", fromTeamId: teamId, toTeamId: null, fee: 8, netCashImpact: 8 },
      { id: "b1", playerId: "p2", seasonId, transferType: "buy", fromTeamId: null, toTeamId: teamId, fee: 3, netCashImpact: 3 },
    ] as never;
    const reached = specialRow(gs, teamId)?.cashDelta ?? 0;
    // net = 8 − 3 = 5 → Stufe 1 (fraction 0.4). Der Aufschlag gegen den verfehlten Fall ist 0.4 × G.
    expect(reached - missedGoalRow(component)).toBeCloseTo(0.4 * GOAL_SIZE_MAGISCH, 1);
    expect(specialRow(gs, teamId)?.status).toBe("paid");
  }, 60000);

  it("skaliert fan_infrastructure weiter stufenlos (levelSum / CAP)", () => {
    const teamId = gs0Team();
    const component: SponsorOfferComponent = {
      componentId: "special-fan-infrastructure",
      kind: "special",
      label: "Fan-Infrastruktur",
      targetValue: 1,
      rewardCash: 12,
      specialKey: "fan_infrastructure",
    };
    const gs = withSpecialContract(teamId, component);
    gs.seasonState.teamFacilities = {
      ...(gs.seasonState.teamFacilities ?? {}),
      [teamId]: { facilities: { fan_shop: { level: 3, enabled: true } } },
    } as never;
    const reached = specialRow(gs, teamId)?.cashDelta ?? 0;
    // levelSum 3 / CAP 6 = 0.5 → Aufschlag 0.5 × G gegenueber dem verfehlten Fall.
    expect(reached - missedGoalRow(component)).toBeCloseTo(0.5 * GOAL_SIZE_MAGISCH, 1);
  }, 60000);

  it("bucht die Auszahlung auf die Teamkasse", () => {
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
    // Die Saisonbasis der Benchmark-Leiter liegt weit ueber dem Sonderziel-Sockelabzug.
    expect(after).toBeGreaterThan(before);
  }, 60000);
});

function gs0Team(): string {
  return createSingleplayerGameState().teams[0]!.teamId;
}
