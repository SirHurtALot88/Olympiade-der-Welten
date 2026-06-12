// term: teamIdentityOverrides
// id: teamIdentityOverrides
// type: datasource
// subtype: JavascriptQuery
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
// Documentation:
//   Validation block for aiTeamNeedsQuery thinRoster logic.
//   Picks 3 representative teams by roster size (thin / mid / broad), runs aiTeamNeedsQuery for each,
//   and returns the Top-10 needs plus compact checks focused on thinRoster behavior.
//
// NOTE:
//   This validator is specifically about `aiTeamNeedsQuery` and is kept as-is.
//   It is meant for regression testing and comparison vs the authoritative Function.
// Returns:
//   {
//     pickedTeams: {
//       thin: { team: string, rosterCount: number, targetRosterSize: number },
//       mid: { team: string, rosterCount: number, targetRosterSize: number },
//       broad: { team: string, rosterCount: number, targetRosterSize: number }
//     },
//     cases: Array<{
//       case: 'thin'|'mid'|'broad',
//       team: string,
//       rosterCount: number,
//       targetRosterSize: number,
//       thinRoster: boolean,
//       top10: Array<{ need_rank:number, need_type:string, need_label:string, importance_score:number, reason:string, search_profile_pretty:string }>,
//       checks: {
//         axisUpgradeCountTop10: number,
//         disciplineHoleCountTop10: number,
//         colorEconomyRank: number | null,
//         axisUpgradeRanks: Record<string, number>,
//         axisUpgradeProfiles: Record<string, { desired_share:number|null, actual_share:number|null, coverage_gap:number|null }>,
//         missingAxisUpgrades: string[],
//         hasDesiredActualGapInProfiles: boolean
//       },
//       notes: string[]
//     }>,
//     observations: string[],
//     ok: boolean
//   }

const s = (v) => String(v ?? '').trim();
const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const safeJson = (txt) => {
  try {
    return JSON.parse(String(txt || '{}'));
  } catch (e) {
    return {};
  }
};

const getTargetRosterSize = (teamCode) => {
  const overrides = teamIdentityOverrides?.value || {};
  const t = overrides?.[teamCode] || overrides?.[s(teamCode)] || null;
  const rawTarget = n(t?.roster?.target);
  const target = rawTarget > 0 ? rawTarget : 10;
  return Math.max(7, Math.min(12, target));
};

// 0) Load all active players so we can pick representative teams by roster size.
let allRows = [];
try {
  const raw = await getAllActivePlayers.trigger();
  allRows = typeof formatDataAsArray === 'function' ? formatDataAsArray(raw) || [] : Array.isArray(raw) ? raw : [];
} catch (e) {
  allRows = typeof formatDataAsArray === 'function' ?
  formatDataAsArray(getAllActivePlayers.data) || [] :
  Array.isArray(getAllActivePlayers.data) ?
  getAllActivePlayers.data :
  [];
}

const countObj = {};
for (const r of allRows) {
  const team = s(r?.team);
  if (!team) continue;
  countObj[team] = (countObj[team] || 0) + 1;
}

const teams = Object.entries(countObj).
map(([team, count]) => ({ team, count: n(count) })).
filter((x) => x.count > 0).
sort((a, b) => a.count - b.count || a.team.localeCompare(b.team));

if (!teams.length) {
  const empty = {
    pickedTeams: { thin: null, mid: null, broad: null },
    cases: [],
    observations: ['No teams found in getAllActivePlayers; cannot run validation.'],
    ok: false };


  return JSON.parse(JSON.stringify(empty));
}

const pickByIndex = (idx) => teams[Math.max(0, Math.min(teams.length - 1, idx))];

const thinTeam = pickByIndex(0);
const midTeam = pickByIndex(Math.floor((teams.length - 1) / 2));
const broadTeam = pickByIndex(teams.length - 1);

const runCase = async (label, teamObj) => {
  const team = s(teamObj?.team);
  const rosterCount = n(teamObj?.count);
  const targetRosterSize = getTargetRosterSize(team);
  const thinRoster = rosterCount < Math.max(7, targetRosterSize - 2);

  // Switch team for the app context.
  selectedTeam.setValue(team);

  // Prefetch minimal inputs (non-fatal if fails)
  try {
    await Promise.all([
    getActivePlayersByTeam.trigger(),
    getTeamRatingsTransfermarkt.trigger()]);

  } catch (e) {}

  // Needs (Query under test)
  let needs = [];
  try {
    const out = await aiTeamNeedsQuery.trigger();
    needs = Array.isArray(out) ? out : [];
  } catch (e) {
    needs = [];
  }

  const top10Raw = (needs || []).slice(0, 10);
  const top10 = top10Raw.map((x) => ({
    need_rank: n(x?.need_rank),
    need_type: s(x?.need_type),
    need_label: s(x?.need_label),
    importance_score: n(x?.importance_score),
    reason: s(x?.reason),
    search_profile_pretty: s(x?.search_profile_pretty),
    _sp: s(x?.search_profile) }));


  const axisUpgrade = top10.filter((x) => x.need_type === 'axis_upgrade');
  const disciplineHole = top10.filter((x) => x.need_type === 'discipline_hole');
  const colorEconomyIdx = top10.findIndex((x) => x.need_type === 'color_economy');
  const colorEconomyRank = colorEconomyIdx >= 0 ? colorEconomyIdx + 1 : null;

  const expectedAxes = ['POW', 'SPE', 'MEN', 'SOC'];
  const axisUpgradeRanks = {};
  const axisUpgradeProfiles = {};

  for (const row of axisUpgrade) {
    const lab = row.need_label.toUpperCase();
    const axis = expectedAxes.find((ax) => lab.includes(`(${ax})`) || lab.includes(ax)) || null;
    if (!axis) continue;

    axisUpgradeRanks[axis] = n(row.need_rank);

    const prof = safeJson(row._sp);
    axisUpgradeProfiles[axis] = {
      desired_share: typeof prof?.desired_share === 'number' ? prof.desired_share : null,
      actual_share: typeof prof?.actual_share === 'number' ? prof.actual_share : null,
      coverage_gap: typeof prof?.coverage_gap === 'number' ? prof.coverage_gap : null };

  }

  const missingAxisUpgrades = expectedAxes.filter((ax) => axisUpgradeRanks[ax] == null);
  const hasDesiredActualGapInProfiles = Object.values(axisUpgradeProfiles).some(
  (p) => p && p.desired_share != null && p.actual_share != null && p.coverage_gap != null);


  const notes = [];

  if (thinRoster) {
    if (axisUpgrade.length >= 3 && axisUpgrade[0]?.need_rank === 1) notes.push('Axis upgrades clearly on top (good).');else
    notes.push('Axis upgrades not clearly on top (potential issue).');

    if (disciplineHole.length === 0 || n(disciplineHole[0]?.need_rank) >= 6) notes.push('discipline_hole gated / pushed down (good).');else
    notes.push('discipline_hole appears high despite thinRoster (suspicious).');

    if (colorEconomyRank != null && colorEconomyRank <= 4) notes.push(`color_economy very high (#${colorEconomyRank}) in thinRoster (might crowd axes).`);else
    if (colorEconomyRank != null) notes.push(`color_economy rank (#${colorEconomyRank}) seems not crowding (ok).`);

    if (hasDesiredActualGapInProfiles) notes.push('Axis profiles show desired/actual/gap (good).');else
    notes.push('Axis profiles missing desired/actual/gap (bad).');

    if (!missingAxisUpgrades.length) notes.push('All 4 axes represented in axis_upgrade needs (good).');else
    notes.push(`Missing axis upgrades in Top-10: ${missingAxisUpgrades.join(', ')}`);
  } else {
    if (label === 'mid') notes.push('Mid roster: expecting a mix of axis upgrades + occasional discipline holes.');
    if (label === 'broad') notes.push('Broad roster: discipline holes may rise again; check reasons plausibility.');
  }

  // Strip internal field before returning
  const top10Out = top10.map(({ _sp, ...rest }) => rest);

  return {
    case: label,
    team,
    rosterCount,
    targetRosterSize,
    thinRoster,
    top10: top10Out,
    checks: {
      axisUpgradeCountTop10: axisUpgrade.length,
      disciplineHoleCountTop10: disciplineHole.length,
      colorEconomyRank,
      axisUpgradeRanks,
      axisUpgradeProfiles,
      missingAxisUpgrades,
      hasDesiredActualGapInProfiles },

    notes };

};

// Run sequentially (selectedTeam is global state; avoid races)
const cases = [];
cases.push(await runCase('thin', thinTeam));
await sleep(25);
cases.push(await runCase('mid', midTeam));
await sleep(25);
cases.push(await runCase('broad', broadTeam));

const observations = [];

const thin = cases.find((c) => c.case === 'thin');
const mid = cases.find((c) => c.case === 'mid');
const broad = cases.find((c) => c.case === 'broad');

if (thin) {
  observations.push(
  thin.checks.axisUpgradeCountTop10 >= 3 ?
  'Thin roster: axis_upgrade dominates Top-10 (expected).' :
  'Thin roster: axis_upgrade does NOT dominate Top-10 enough (too weak).');


  observations.push(
  thin.checks.disciplineHoleCountTop10 === 0 ?
  'Thin roster: discipline_hole absent in Top-10 (strong gating).' :
  'Thin roster: discipline_hole appears in Top-10 (gating might be weak).');


  if (thin.checks.colorEconomyRank != null) {
    observations.push(
    thin.checks.colorEconomyRank <= 4 ?
    `Thin roster: color_economy very high (#${thin.checks.colorEconomyRank}) → may be too aggressive.` :
    `Thin roster: color_economy rank is #${thin.checks.colorEconomyRank} (not crowding).`);

  }

  observations.push(
  thin.checks.hasDesiredActualGapInProfiles ?
  'Thin roster: axis search_profile includes desired_share / actual_share / coverage_gap (good).' :
  'Thin roster: axis search_profile missing desired_share / actual_share / coverage_gap (bad).');

}

if (mid) {
  const types = (mid.top10 || []).map((x) => s(x.need_type)).filter(Boolean);
  const distinctCount = Array.from(new Set(types)).length;
  observations.push(
  distinctCount >= 3 ?
  'Mid roster: mixed need types in Top-10 (good sign: not purely rank-driven).' :
  'Mid roster: Top-10 is type-homogeneous (might still be too rank-driven).');

}

if (broad) {
  const firstHole = (broad.top10 || []).find((x) => x.need_type === 'discipline_hole');
  if (firstHole?.need_rank != null && n(firstHole.need_rank) <= 5) {
    observations.push('Broad roster: discipline_hole can rise into top needs again (expected).');
  }
}

const result = {
  pickedTeams: {
    thin: {
      team: thinTeam.team,
      rosterCount: thinTeam.count,
      targetRosterSize: getTargetRosterSize(thinTeam.team) },

    mid: {
      team: midTeam.team,
      rosterCount: midTeam.count,
      targetRosterSize: getTargetRosterSize(midTeam.team) },

    broad: {
      team: broadTeam.team,
      rosterCount: broadTeam.count,
      targetRosterSize: getTargetRosterSize(broadTeam.team) } },


  cases,
  observations: observations.slice(0, 5),
  ok: true };


// Extra safety: remove any non-serializable values.
return JSON.parse(JSON.stringify(result));
