import { describe, expect, it } from "vitest";

import {
  RETOOL_CASH_CREATOR_PACKAGE_SCORING_CONFIG,
} from "@/lib/ai/golden-master/cash-creator-package-scoring-config";
import {
  RETOOL_AXIS_COLOR,
  RETOOL_DISCIPLINE_AXIS,
  RETOOL_DISCIPLINE_RECIPES_VERSION,
} from "@/lib/ai/golden-master/discipline-recipes";
import { RETOOL_AI_PACKAGE_SCORING_CONFIG } from "@/lib/ai/golden-master/package-scoring-config";
import { RETOOL_TEAM_IDENTITY_OVERRIDES } from "@/lib/ai/golden-master/team-identity-overrides";

describe("golden master discipline recipes config", () => {
  it("loads the exact extracted version and mappings", () => {
    expect(RETOOL_DISCIPLINE_RECIPES_VERSION).toBe("aiSNP_needsCore.v22_0_direct_clean_axis_fix");
    expect(RETOOL_DISCIPLINE_AXIS.tdm).toBe("pow");
    expect(RETOOL_DISCIPLINE_AXIS.fechten).toBe("spe");
    expect(RETOOL_DISCIPLINE_AXIS.schach).toBe("men");
    expect(RETOOL_DISCIPLINE_AXIS.showcase).toBe("soc");
    expect(Object.keys(RETOOL_DISCIPLINE_AXIS)).toHaveLength(20);
    expect(RETOOL_AXIS_COLOR).toEqual({
      pow: "red",
      spe: "green",
      men: "blue",
      soc: "yellow",
    });
  });
});

describe("golden master team identity overrides config", () => {
  it("preserves the extracted teams and values", () => {
    expect(Object.keys(RETOOL_TEAM_IDENTITY_OVERRIDES)).toEqual(["Cash Creators", "C-C", "W-L", "T-T"]);
    expect(RETOOL_TEAM_IDENTITY_OVERRIDES["Cash Creators"].roster.target).toBe(12);
    expect(RETOOL_TEAM_IDENTITY_OVERRIDES["C-C"].contracts.preferredLengthYears).toBe(1);
    expect(RETOOL_TEAM_IDENTITY_OVERRIDES["W-L"].traitPreferences.requiredShareTarget).toBe(0.8);
    expect(RETOOL_TEAM_IDENTITY_OVERRIDES["T-T"].traitPreferences.preferred[0]).toBe("diligent");
  });
});

describe("golden master ai package scoring config", () => {
  it("preserves all key weights exactly", () => {
    expect(RETOOL_AI_PACKAGE_SCORING_CONFIG.needCoverage.primaryHitBonus).toBe(14);
    expect(RETOOL_AI_PACKAGE_SCORING_CONFIG.needCoverage.disciplineHoleWeight).toBe(0.6);
    expect(RETOOL_AI_PACKAGE_SCORING_CONFIG.similarity.wAxis).toBe(0.7);
    expect(RETOOL_AI_PACKAGE_SCORING_CONFIG.similarity.wNeed).toBe(0.25);
    expect(RETOOL_AI_PACKAGE_SCORING_CONFIG.identityBalance.pivot).toBe(0.58);
    expect(RETOOL_AI_PACKAGE_SCORING_CONFIG.financePosture.cashTargetMax).toBe(0.92);
    expect(RETOOL_AI_PACKAGE_SCORING_CONFIG.financePosture.salaryPenaltyCap).toBe(12);
  });
});

describe("golden master cash creator package scoring config", () => {
  it("preserves the cash creator configuration exactly", () => {
    expect(RETOOL_CASH_CREATOR_PACKAGE_SCORING_CONFIG.version).toBe("ccPkgPref.v1");
    expect(RETOOL_CASH_CREATOR_PACKAGE_SCORING_CONFIG.depth.preferSize2Bonus).toBe(6);
    expect(RETOOL_CASH_CREATOR_PACKAGE_SCORING_CONFIG.depth.targetAxis.men).toBe(0.45);
    expect(RETOOL_CASH_CREATOR_PACKAGE_SCORING_CONFIG.resale.avgValueW).toBe(0.12);
    expect(RETOOL_CASH_CREATOR_PACKAGE_SCORING_CONFIG.flip.fit25BonusEach).toBe(2.5);
    expect(RETOOL_CASH_CREATOR_PACKAGE_SCORING_CONFIG.holes.coveredFieldBonusCap).toBe(4);
    expect(RETOOL_CASH_CREATOR_PACKAGE_SCORING_CONFIG.totalCap).toBe(18);
  });
});
