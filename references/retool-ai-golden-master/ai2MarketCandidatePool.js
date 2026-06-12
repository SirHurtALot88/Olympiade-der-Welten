// term: disciplineRecipesGlobal
// id: ai2MarketCandidatePool
// type: script
// subtype: JavascriptQuery
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
const b = transfermarktSalaryBudgetLogic.value || {};
const tuning =
  typeof ai2NeedTuningCfg !== 'undefined' && ai2NeedTuningCfg?.value
    ? ai2NeedTuningCfg.value
    : {};

const interesting = (obj) =>
  Object.fromEntries(
    Object.entries(obj || {}).filter(([k]) => {
      const key = String(k).toLowerCase();
      return (
        key.includes('forecast') ||
        key.includes('factor') ||
        key.includes('salary') ||
        key.includes('sponsor') ||
        key.includes('income') ||
        key.includes('pool') ||
        key.includes('prize') ||
        key.includes('preisgeld')
      );
    })
  );

return {
  transfermarktSalaryBudgetLogicKeys: Object.keys(b).sort(),
  currentForecastFieldsInBudgetLogic: interesting(b),

  ai2NeedTuningKeys: Object.keys(tuning).sort(),
  currentForecastFieldsInTuning: interesting(tuning),

  plannerCurrentlySees: {
    salaryFactors5: AI2_04_Planner.data?.plan?.salaryPlanning?.salaryFactors5,
    leagueSalaryPools5: AI2_04_Planner.data?.plan?.salaryPlanning?.leagueSalaryPools5,
    explicitTeamIncomes5: AI2_04_Planner.data?.plan?.salaryPlanning?.explicitTeamIncomes5,
    forecastInputQuality: AI2_04_Planner.data?.plan?.salaryPlanning?.forecastInputQuality
  }
};
