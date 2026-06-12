// term: aiTeamNeeds
// id: refreshAiNeedsOnly
// type: datasource
// subtype: JavascriptQuery
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
// Documentation:
//   Smoke test to debug why aiTeamNeeds has no output.
//   Reads key inputs (team, cash, roster, ratings, discipline rankings) and runs aiTeamNeedsQuery.
// Returns:
//   {
//     team: string,
//     cash: number,
//     rosterCount: number,
//     teamRatingsRows: number,
//     disciplineRankingsRows: number,
//     budgetLogic: {
//       allowed_budget_for_search: number,
//       reserve_target: number,
//       reserve_policy: string
//     },
//     needsQueryCount: number,
//     needsQueryTypes: string[],
//     needsFunctionCount: number,
//     notes: string[]
//   }

const s = (v) => String(v ?? '').trim();
const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;

const notes = [];

const team = s(filterTeam.value);
if (!team) {
  notes.push('filterTeam.value is empty');
}

// Ensure base context is loaded (best-effort)
try {
  await refreshTeamContextBase.trigger();
} catch (e) {
  notes.push('refreshTeamContextBase.trigger failed: ' + String(e?.message || e));
}

const cash = n(getCashFromSaisonstand.value?.cash);
if (!(cash > 0)) notes.push('cash is 0 (getCashFromSaisonstand.value.cash)');

const roster = typeof formatDataAsArray === 'function' ?
formatDataAsArray(getActivePlayersByTeam.data) || [] :
getActivePlayersByTeam.data || [];

const rosterCount = Array.isArray(roster) ? roster.length : 0;
if (!rosterCount) notes.push('rosterCount is 0 (getActivePlayersByTeam)');

const ratingsRows = typeof formatDataAsArray === 'function' ?
formatDataAsArray(getTeamRatingsTransfermarkt.data) || [] :
getTeamRatingsTransfermarkt.data || [];

if (!ratingsRows.length) notes.push('team ratings query returned 0 rows');

const disciplineRankingsRows = Array.isArray(teamDisciplineRankings.value) ?
teamDisciplineRankings.value :
[];
if (!disciplineRankingsRows.length) notes.push('teamDisciplineRankings.value empty (global function output)');

const budgetLogic = transfermarktSalaryBudgetLogic.value || {};
if (!(n(budgetLogic.allowed_budget_for_search) > 0)) notes.push('transfermarktSalaryBudgetLogic.allowed_budget_for_search is 0');

// Run needs query (canonical)
let needsQuery = [];
try {
  const r = await aiTeamNeedsQuery.trigger();
  needsQuery = Array.isArray(r) ? r : Array.isArray(aiTeamNeedsQuery.data) ? aiTeamNeedsQuery.data : [];
} catch (e) {
  notes.push('aiTeamNeedsQuery.trigger failed: ' + String(e?.message || e));
}

const needsQueryTypes = Array.isArray(needsQuery) ?
Array.from(new Set(needsQuery.map((x) => s(x?.need_type)).filter(Boolean))) :
[];

// Evaluate function output (aiTeamNeeds is a Function)
let needsFunction = [];
try {
  const v = aiTeamNeeds.value ?? aiTeamNeeds;
  needsFunction = Array.isArray(v) ? v : [];
} catch (e) {
  notes.push('reading aiTeamNeeds.value failed: ' + String(e?.message || e));
}

return {
  team,
  cash,
  rosterCount,
  teamRatingsRows: ratingsRows.length,
  disciplineRankingsRows: disciplineRankingsRows.length,
  budgetLogic: {
    allowed_budget_for_search: n(budgetLogic.allowed_budget_for_search),
    reserve_target: n(budgetLogic.reserve_target),
    reserve_policy: s(budgetLogic.reserve_policy) },

  needsQueryCount: Array.isArray(needsQuery) ? needsQuery.length : 0,
  needsQueryTypes,
  needsFunctionCount: Array.isArray(needsFunction) ? needsFunction.length : 0,
  notes };
