import { describe, expect, it } from "vitest";

import {
  adjustBuyDecisionForDoctrine,
  adjustSellScoreForDoctrine,
  formatPersonaBlend,
  getPersonaBlendWeight,
  resolveTransferDoctrineFromProfile,
} from "@/lib/ai/ai-transfer-doctrine-layer";
import { loadSourceTeams, loadSourceTeamIdentities } from "@/lib/data/dataAdapter";
import { buildTeamStrategyProfileMap } from "@/lib/foundation/team-strategy-profiles";
import type { TeamStrategyProfile } from "@/lib/data/olyDataTypes";

function profile(overrides: Partial<TeamStrategyProfile["bias"]> = {}, extra?: Partial<TeamStrategyProfile>): TeamStrategyProfile {
  return {
    teamId: "T-T",
    strategySummary: "Test profile",
    preferredArchetypes: [],
    preferredClasses: [],
    buyStyle: "",
    rosterStyle: "",
    bias: {
      starPriority: 5,
      cashPriority: 5,
      sellForProfitAggression: 5,
      valuePriority: 5,
      loyaltyBias: 5,
      rosterDepthPreference: 5,
      shortContractPreference: 5,
      eliteSmallRosterPreference: 5,
      ...overrides,
    },
    ...extra,
  } as TeamStrategyProfile;
}

describe("ai-transfer-doctrine-layer", () => {
  it("resolves merchant-heavy blend for cash/value traders like C-C", () => {
    const doctrine = resolveTransferDoctrineFromProfile(
      profile({ cashPriority: 10, valuePriority: 10, sellForProfitAggression: 10, shortContractPreference: 9 }),
    );
    expect(getPersonaBlendWeight(doctrine.personaBlend, "merchant")).toBeGreaterThan(0.15);
    expect(getPersonaBlendWeight(doctrine.personaBlend, "churner")).toBeGreaterThan(0.15);
    expect(doctrine.profitWindowScale).toBeGreaterThan(1);
  });

  it("blends developer, merchant and star_builder for teacher teams like T-T", () => {
    const teams = loadSourceTeams();
    const identities = loadSourceTeamIdentities();
    const profiles = buildTeamStrategyProfileMap(teams, identities);
    const identity = identities.find((entry) => entry.teamId === "T-T") ?? null;
    const doctrine = resolveTransferDoctrineFromProfile(profiles["T-T"] ?? null, identity);

    expect(getPersonaBlendWeight(doctrine.personaBlend, "developer")).toBeGreaterThan(0.15);
    expect(getPersonaBlendWeight(doctrine.personaBlend, "merchant")).toBeGreaterThanOrEqual(0.1);
    expect(getPersonaBlendWeight(doctrine.personaBlend, "star_builder")).toBeGreaterThanOrEqual(0.1);
    expect(doctrine.axes.talentFocus).toBeGreaterThan(0.6);
    expect(doctrine.personaHint).toContain("%");
    expect(formatPersonaBlend(doctrine.personaBlend)).toContain("developer");
  });

  it("uses reason codes instead of brittle string matching for doctrine sell tuning", () => {
    const merchant = resolveTransferDoctrineFromProfile(profile({ cashPriority: 10, valuePriority: 10, sellForProfitAggression: 10 }));
    const sellReason = ["realisierbarer Gewinn von 12.5"];
    const keepReason = ["Star-/Core-Spieler wird nur bei echtem Finanz- oder Boarddruck bewegt"];

    const tuned = adjustSellScoreForDoctrine({
      baseScore: 72,
      reasonToSell: sellReason,
      reasonToKeep: keepReason,
      doctrine: merchant,
    });
    expect(tuned).toBeGreaterThan(72);
  });

  it("softly scales sell scores without hard blocking star keep reasons", () => {
    const starBuilder = resolveTransferDoctrineFromProfile(profile({ starPriority: 8, loyaltyBias: 7 }));
    const churner = resolveTransferDoctrineFromProfile(profile({ sellForProfitAggression: 8, shortContractPreference: 7 }));

    const starKeepScore = adjustSellScoreForDoctrine({
      baseScore: 72,
      sellReasonCodes: ["profit_window"],
      keepReasonCodes: ["star_core_protection"],
      doctrine: starBuilder,
    });
    const churnSellScore = adjustSellScoreForDoctrine({
      baseScore: 72,
      sellReasonCodes: ["underperformance"],
      doctrine: churner,
    });

    expect(starKeepScore).toBeLessThan(72);
    expect(churnSellScore).toBeGreaterThan(72);
    expect(starKeepScore).toBeGreaterThan(0);
  });

  it("reduces hoarder buy intent while increasing pass intent", () => {
    const hoarder = resolveTransferDoctrineFromProfile(profile({ cashPriority: 9, sellForProfitAggression: 3, starPriority: 3 }));
    const adjusted = adjustBuyDecisionForDoctrine({
      buyIntentScore: 40,
      passIntentScore: 10,
      replacementFitScore: 0,
      doctrine: hoarder,
    });

    expect(getPersonaBlendWeight(hoarder.personaBlend, "hoarder")).toBeGreaterThan(0.15);
    expect(adjusted.buyIntent).toBeLessThan(40);
    expect(adjusted.passIntent).toBeGreaterThan(10);
    expect(adjusted.strategicBuyScore).toBeLessThan(30);
  });

  it("never assigns a single 100% persona blend", () => {
    const teams = loadSourceTeams();
    const identities = loadSourceTeamIdentities();
    const identityByTeamId = new Map(identities.map((identity) => [identity.teamId, identity] as const));
    const profiles = buildTeamStrategyProfileMap(teams, identities);
    const doctrines = teams.map((team) =>
      resolveTransferDoctrineFromProfile(profiles[team.teamId] ?? null, identityByTeamId.get(team.teamId) ?? null),
    );
    for (const doctrine of doctrines) {
      const maxWeight = Math.max(...Object.values(doctrine.personaBlend).map((weight) => weight ?? 0));
      expect(maxWeight).toBeLessThan(1);
    }
  });
});
