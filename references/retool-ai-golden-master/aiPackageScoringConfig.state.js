// term: disciplineHoleWeight
// id: aiPackageScoringConfig
// type: state
// subtype: State
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: value
// dependencies: {
  needCoverage: {
    primaryHitBonus: 14,
    secondaryHitBonus: 7,
    uniqueNeedBonus: 4,
    uniqueNeedBonusCap: 3,
    disciplineHoleWeight: 0.60,
    overlapSameNeedPenalty: 5,
    overlapSameNeedPenaltyCap: 12,
    profileOverlapThreshold: 0.80,
    profileOverlapPenalty: 4,
    profileOverlapPenaltyCap: 10
  },
  similarity: {
    wAxis: 0.70,
    wNeed: 0.25,
    wColor: 0.05,
    threshold: 0.62,
    scale: 28,
    cap: 14
  },
  identityBalance: {
    pivot: 0.58,
    scale: 18,
    cap: 7
  },
  financePosture: {
    cashTargetBase: 0.48,
    cashTargetFinanceRange: 0.22,
    cashTargetAmbitionBoost: 0.18,
    cashTargetBoardBoost: 0.06,
    cashTargetMin: 0.36,
    cashTargetMax: 0.92,
    cashPenaltyScale: 55,
    cashPenaltyCap: 18,
    cashBonusScale: 20,
    cashBonusCap: 6,
    salaryCapBase: 30,
    salaryCapRange: 60,
    salaryLoadThreshold: 0.72,
    salaryPenaltyScale: 30,
    salaryPenaltyCap: 12,
    alignmentBonusCap: 5,
    pkgTypeBiasScale: 3
  }
}
// extractionStatus: complete_or_primary_match
{{ {
  needCoverage: {
    primaryHitBonus: 14,
    secondaryHitBonus: 7,
    uniqueNeedBonus: 4,
    uniqueNeedBonusCap: 3,
    disciplineHoleWeight: 0.60,
    overlapSameNeedPenalty: 5,
    overlapSameNeedPenaltyCap: 12,
    profileOverlapThreshold: 0.80,
    profileOverlapPenalty: 4,
    profileOverlapPenaltyCap: 10
  },
  similarity: {
    wAxis: 0.70,
    wNeed: 0.25,
    wColor: 0.05,
    threshold: 0.62,
    scale: 28,
    cap: 14
  },
  identityBalance: {
    pivot: 0.58,
    scale: 18,
    cap: 7
  },
  financePosture: {
    cashTargetBase: 0.48,
    cashTargetFinanceRange: 0.22,
    cashTargetAmbitionBoost: 0.18,
    cashTargetBoardBoost: 0.06,
    cashTargetMin: 0.36,
    cashTargetMax: 0.92,
    cashPenaltyScale: 55,
    cashPenaltyCap: 18,
    cashBonusScale: 20,
    cashBonusCap: 6,
    salaryCapBase: 30,
    salaryCapRange: 60,
    salaryLoadThreshold: 0.72,
    salaryPenaltyScale: 30,
    salaryPenaltyCap: 12,
    alignmentBonusCap: 5,
    pkgTypeBiasScale: 3
  }
} }}
