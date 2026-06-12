// term: cashCreatorPackageScoringConfig
// id: cashCreatorPackageScoringConfig
// type: state
// subtype: State
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: value
// dependencies: ({
  version: 'ccPkgPref.v1',
  depth: {
    preferSize2Bonus: 6,
    preferSize3Bonus: 8,
    size4Penalty: 4,
    size5Penalty: 8,
    targetAxis: { pow: 0.05, spe: 0.05, men: 0.45, soc: 0.45 },
    axisAlignScale: 14,
    axisAlignPivot: 0.62,
    axisAlignCap: 10
  },
  resale: {
    avgValueW: 0.12,
    avgRatioW: 0.08,
    usageTarget: 0.62,
    usagePenaltyScale: 18,
    usagePenaltyCap: 10
  },
  flip: {
    fit25BonusEach: 2.5,
    fit25BonusCap: 7,
    salaryToFeePenaltyScale: 9,
    salaryToFeePivot: 0.22,
    salaryToFeePenaltyCap: 7
  },
  holes: {
    coveredFieldBonusEach: 1.5,
    coveredFieldBonusCap: 4
  },
  totalCap: 18
})
// extractionStatus: complete_or_primary_match
{{ ({
  version: 'ccPkgPref.v1',
  depth: {
    preferSize2Bonus: 6,
    preferSize3Bonus: 8,
    size4Penalty: 4,
    size5Penalty: 8,
    targetAxis: { pow: 0.05, spe: 0.05, men: 0.45, soc: 0.45 },
    axisAlignScale: 14,
    axisAlignPivot: 0.62,
    axisAlignCap: 10
  },
  resale: {
    avgValueW: 0.12,
    avgRatioW: 0.08,
    usageTarget: 0.62,
    usagePenaltyScale: 18,
    usagePenaltyCap: 10
  },
  flip: {
    fit25BonusEach: 2.5,
    fit25BonusCap: 7,
    salaryToFeePenaltyScale: 9,
    salaryToFeePivot: 0.22,
    salaryToFeePenaltyCap: 7
  },
  holes: {
    coveredFieldBonusEach: 1.5,
    coveredFieldBonusCap: 4
  },
  totalCap: 18
}) }}
