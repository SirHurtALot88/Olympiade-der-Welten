import { describe, expect, it } from "vitest";

import type { AiNeedsPicksOpenNeed } from "@/lib/ai/ai-needs-picks-compare-service";
import {
  buildNeedsFingerprintActivePool,
  buildTeamNeedsFingerprint,
  fingerprintIsStale,
} from "@/lib/ai/ai-needs-picks-compare-service";
import type { AiTransferPreviewRecommendation } from "@/lib/ai/ai-transfermarkt-preview-service";
import type { CandidateStaticScore } from "@/lib/ai/ai-needs-picks-compare-service";

// ---------------------------------------------------------------------------
// Minimal fixture helpers
// ---------------------------------------------------------------------------

function openNeed(
  axis: AiNeedsPicksOpenNeed["axis"],
  importance = 0.5,
): AiNeedsPicksOpenNeed {
  return { axis, importance, label: axis, reason: "test", sourceStatus: "local_inferred" };
}

function rec(
  partial: Partial<AiTransferPreviewRecommendation> & Pick<AiTransferPreviewRecommendation, "playerId">,
): AiTransferPreviewRecommendation {
  return {
    playerId: partial.playerId,
    playerName: partial.playerName ?? partial.playerId,
    name: partial.playerName ?? partial.playerId,
    className: partial.className ?? "warrior",
    race: partial.race ?? "human",
    ovr: partial.ovr ?? null,
    mvs: partial.mvs ?? null,
    price: partial.price ?? null,
    marketValue: partial.marketValue ?? partial.price ?? null,
    salary: partial.salary ?? null,
    contractLength: partial.contractLength ?? null,
    cashAfter: null,
    rosterAfter: null,
    salaryAfter: null,
    teamFit: null,
    fitSummary: "",
    sportsSummary: "",
    budgetReason: [],
    warnings: [],
    overallRecommendationScore: 0,
    score: 0,
    reason: "",
    fitNotes: [],
    riskNotes: [],
    strategyNotes: [],
  };
}

/** Minimal game state — only the players array is used by buildNeedsFingerprintActivePool */
function miniGameState(players: { id: string; coreStats: Record<string, number>; disciplineRatings: Record<string, number> }[] = []) {
  return { players } as unknown as Parameters<typeof buildNeedsFingerprintActivePool>[0]["gameState"];
}

function staticEntry(
  partial: Partial<CandidateStaticScore> = {},
): CandidateStaticScore {
  return {
    strategyFit: { score: 0, reasons: [] },
    teamThemeFitScore: 0,
    classFitScore: 0,
    raceOrArchetypeFitScore: 0,
    harmonyPenalty: 0,
    teamAxisFitScoreBase: 0,
    ambitionFactor: 0.5,
    financesFactor: 0.5,
    identityBaseReasons: [],
    v4HardRuleFailure: null,
    v4MajorHits: 0,
    v4MinorHits: 0,
    v4AvoidHits: 0,
    v4AxisHit: 0,
    candidateAxis: partial.candidateAxis ?? null,
    playerRole: partial.playerRole ?? "depth",
    normalizedClass: partial.normalizedClass ?? "warrior",
    playerQualityScore: partial.playerQualityScore ?? 10,
    bestDisciplineEntry: null,
    sportsQuality: null,
    cheapFillEligible: partial.cheapFillEligible ?? false,
    rawTier: partial.rawTier ?? { isStar: false, isSuperstar: false, isCheapFill: true },
    playerFormColor: null,
    ...partial,
  };
}

// ---------------------------------------------------------------------------
// buildTeamNeedsFingerprint
// ---------------------------------------------------------------------------

describe("buildTeamNeedsFingerprint", () => {
  it("extracts needed axes from evaluateAiNeeds uncoveredNeedAxes", () => {
    const fingerprint = buildTeamNeedsFingerprint({
      needs: {
        uncoveredNeedAxes: ["pow", "men"],
        topNeedDisciplineIds: ["sword", "archery"],
      } as unknown as Parameters<typeof buildTeamNeedsFingerprint>[0]["needs"],
      openNeeds: [],
    });

    expect(fingerprint.needAxes.has("pow")).toBe(true);
    expect(fingerprint.needAxes.has("men")).toBe(true);
    expect(fingerprint.needAxes.has("spe")).toBe(false);
    expect(fingerprint.needAxes.has("soc")).toBe(false);
  });

  it("adds axes from openNeeds with importance >= 0.2", () => {
    const fingerprint = buildTeamNeedsFingerprint({
      needs: {
        uncoveredNeedAxes: [],
        topNeedDisciplineIds: [],
      } as unknown as Parameters<typeof buildTeamNeedsFingerprint>[0]["needs"],
      openNeeds: [openNeed("spe", 0.3), openNeed("soc", 0.1)],
    });

    expect(fingerprint.needAxes.has("spe")).toBe(true);
    expect(fingerprint.needAxes.has("soc")).toBe(false); // 0.1 < 0.2 threshold
  });

  it("includes top discipline IDs", () => {
    const fingerprint = buildTeamNeedsFingerprint({
      needs: {
        uncoveredNeedAxes: [],
        topNeedDisciplineIds: ["dueling", "archery", "strength"],
      } as unknown as Parameters<typeof buildTeamNeedsFingerprint>[0]["needs"],
      openNeeds: [],
    });

    expect(fingerprint.needDisciplineIds.has("dueling")).toBe(true);
    expect(fingerprint.needDisciplineIds.has("archery")).toBe(true);
    expect(fingerprint.needDisciplineIds.has("strength")).toBe(true);
  });

  it("extracts role needs from openNeeds", () => {
    const fingerprint = buildTeamNeedsFingerprint({
      needs: {
        uncoveredNeedAxes: [],
        topNeedDisciplineIds: [],
      } as unknown as Parameters<typeof buildTeamNeedsFingerprint>[0]["needs"],
      openNeeds: [openNeed("core"), openNeed("star"), openNeed("roster")],
    });

    expect(fingerprint.needRoles.has("core")).toBe(true);
    expect(fingerprint.needRoles.has("star")).toBe(true);
    expect(fingerprint.needRoles.has("roster")).toBe(false); // not a role
  });
});

// ---------------------------------------------------------------------------
// buildNeedsFingerprintActivePool
// ---------------------------------------------------------------------------

describe("buildNeedsFingerprintActivePool", () => {
  const baseFingerprint = buildTeamNeedsFingerprint({
    needs: {
      uncoveredNeedAxes: ["pow"],
      topNeedDisciplineIds: ["sword"],
    } as unknown as Parameters<typeof buildTeamNeedsFingerprint>[0]["needs"],
    openNeeds: [openNeed("pow")],
  });

  it("always includes cheap fills (price < 15)", () => {
    const candidates = [
      rec({ playerId: "cheap", price: 8, ovr: 45 }),
      rec({ playerId: "expensive-no-axis", price: 55, ovr: 55 }),
    ];
    const result = buildNeedsFingerprintActivePool({
      compareCandidates: candidates,
      gameState: miniGameState(),
      fingerprint: baseFingerprint,
      staticScoreCache: new Map(),
    });

    expect(result.some((r) => r.playerId === "cheap")).toBe(true);
  });

  it("always includes high-OVR stars (ovr >= 72)", () => {
    const candidates = [
      rec({ playerId: "star", price: 80, ovr: 75 }),
      rec({ playerId: "mid", price: 40, ovr: 60 }),
    ];
    const result = buildNeedsFingerprintActivePool({
      compareCandidates: candidates,
      gameState: miniGameState(),
      fingerprint: baseFingerprint,
      staticScoreCache: new Map(),
    });

    expect(result.some((r) => r.playerId === "star")).toBe(true);
  });

  it("includes players matching needed axis via cached candidateAxis", () => {
    const cache = new Map([
      ["pow-player", staticEntry({ candidateAxis: "pow" })],
      ["soc-player", staticEntry({ candidateAxis: "soc" })],
    ]);
    const candidates = [
      rec({ playerId: "pow-player", price: 30, ovr: 60 }),
      rec({ playerId: "soc-player", price: 30, ovr: 60 }),
    ];
    const result = buildNeedsFingerprintActivePool({
      compareCandidates: candidates,
      gameState: miniGameState(),
      fingerprint: baseFingerprint,  // needs pow
      staticScoreCache: cache,
    });

    expect(result.some((r) => r.playerId === "pow-player")).toBe(true);
    // soc player is not needed by fingerprint and not cheap/star — might still be in
    // identity-top if identity score is high enough, but with score=0 it won't be top-60
  });

  it("includes players whose discipline rating matches a needed discipline via game state", () => {
    const players = [
      {
        id: "sword-specialist",
        coreStats: { pow: 30, spe: 30, men: 30, soc: 30 },
        disciplineRatings: { sword: 65 },
      },
    ];
    const candidates = [rec({ playerId: "sword-specialist", price: 35, ovr: 58 })];
    const result = buildNeedsFingerprintActivePool({
      compareCandidates: candidates,
      gameState: miniGameState(players),
      fingerprint: baseFingerprint,  // needs "sword" discipline
      staticScoreCache: new Map(),
    });

    expect(result.some((r) => r.playerId === "sword-specialist")).toBe(true);
  });

  it("always includes top-N identity players via safety net", () => {
    const manyPlayers = Array.from({ length: 80 }, (_, i) => {
      const id = `player-${i}`;
      return rec({ playerId: id, price: 30, ovr: 60 });
    });
    // Give the first 65 players a high identity score via cache
    const cache = new Map(
      Array.from({ length: 65 }, (_, i) => [
        `player-${i}`,
        staticEntry({
          candidateAxis: "soc",  // not needed (fingerprint needs pow)
          strategyFit: { score: 5, reasons: ["theme match"] },
          teamThemeFitScore: 4,
          classFitScore: 3,
          raceOrArchetypeFitScore: 2,
        }),
      ]),
    );

    const result = buildNeedsFingerprintActivePool({
      compareCandidates: manyPlayers,
      gameState: miniGameState(),
      fingerprint: baseFingerprint,  // only needs pow — soc players aren't relevant by axis
      staticScoreCache: cache,
    });

    // Identity-top safety net ensures top-60 identity players are always included
    const identityTopIds = new Set(Array.from({ length: 60 }, (_, i) => `player-${i}`));
    const resultIds = new Set(result.map((r) => r.playerId));
    let identityTopCount = 0;
    for (const id of identityTopIds) {
      if (resultIds.has(id)) identityTopCount++;
    }
    expect(identityTopCount).toBe(60);
  });

  it("returns only the full pool when all candidates are already included", () => {
    const small = [
      rec({ playerId: "a", price: 8 }),
      rec({ playerId: "b", price: 10 }),
    ];
    const result = buildNeedsFingerprintActivePool({
      compareCandidates: small,
      gameState: miniGameState(),
      fingerprint: baseFingerprint,
      staticScoreCache: new Map(),
    });
    expect(result.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// fingerprintIsStale
// ---------------------------------------------------------------------------

describe("fingerprintIsStale", () => {
  const fingerprint = buildTeamNeedsFingerprint({
    needs: {
      uncoveredNeedAxes: ["pow", "spe"],
      topNeedDisciplineIds: ["sword", "archery"],
    } as unknown as Parameters<typeof buildTeamNeedsFingerprint>[0]["needs"],
    openNeeds: [],
  });

  it("returns true when picked axis is needed and now sufficiently covered", () => {
    const stale = fingerprintIsStale({
      fingerprint,
      pickedAxis: "pow",
      pickedDisciplineIds: [],
      coveredAxisHits: { pow: 2, spe: 0, men: 0, soc: 0 },
    });
    expect(stale).toBe(true);
  });

  it("returns false when picked axis is needed but not yet covered (< 2 hits)", () => {
    const stale = fingerprintIsStale({
      fingerprint,
      pickedAxis: "pow",
      pickedDisciplineIds: [],
      coveredAxisHits: { pow: 1, spe: 0, men: 0, soc: 0 },
    });
    expect(stale).toBe(false);
  });

  it("returns true when a needed discipline was covered by the pick", () => {
    const stale = fingerprintIsStale({
      fingerprint,
      pickedAxis: null,
      pickedDisciplineIds: ["sword"],
      coveredAxisHits: { pow: 0, spe: 0, men: 0, soc: 0 },
    });
    expect(stale).toBe(true);
  });

  it("returns false when neither axis nor discipline matches the fingerprint", () => {
    const stale = fingerprintIsStale({
      fingerprint,
      pickedAxis: "soc",  // not in fingerprint
      pickedDisciplineIds: ["strength"],  // not in fingerprint
      coveredAxisHits: { pow: 0, spe: 0, men: 0, soc: 2 },
    });
    expect(stale).toBe(false);
  });
});
