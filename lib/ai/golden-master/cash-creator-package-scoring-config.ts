export const RETOOL_CASH_CREATOR_PACKAGE_SCORING_CONFIG = {
  version: "ccPkgPref.v1",
  depth: {
    preferSize2Bonus: 6,
    preferSize3Bonus: 8,
    size4Penalty: 4,
    size5Penalty: 8,
    targetAxis: { pow: 0.05, spe: 0.05, men: 0.45, soc: 0.45 },
    axisAlignScale: 14,
    axisAlignPivot: 0.62,
    axisAlignCap: 10,
  },
  resale: {
    avgValueW: 0.12,
    avgRatioW: 0.08,
    usageTarget: 0.62,
    usagePenaltyScale: 18,
    usagePenaltyCap: 10,
  },
  flip: {
    fit25BonusEach: 2.5,
    fit25BonusCap: 7,
    salaryToFeePenaltyScale: 9,
    salaryToFeePivot: 0.22,
    salaryToFeePenaltyCap: 7,
  },
  holes: {
    coveredFieldBonusEach: 1.5,
    coveredFieldBonusCap: 4,
  },
  totalCap: 18,
} as const;

// Open question:
// The Retool extractor can still attach a wrong codeField/body header for this source in some runs.
// The numeric values above were copied from the confirmed JSON extract, unchanged.
