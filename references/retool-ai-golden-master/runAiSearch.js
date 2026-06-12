// term: aiTeamNeeds
// id: runAiSearch
// type: script
// subtype: JavascriptQuery
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
// Documentation:
//   Computes AI team needs for the selected team.
//   Thin-roster patch (2026-04):
//     - Detects underfilled rosters (thinRoster) vs a target roster size.
//     - When thinRoster is true, axis_upgrade needs are prioritized by team identity (axis priorities)
//       AND current roster coverage (desiredShare vs actualShare -> coverageGap).
//     - discipline_hole needs are strongly downweighted while the roster is thin,
//       especially if the affected discipline has low priorityFit to the team's axis priorities.
//   Variance layer (2026-04):
//     - Reads sampled corridor values from aiVarianceConfig (cashUsageTarget, fitMinSoft, holeGate01).
//     - Outputs debug fields per need: need_center, need_min, need_max, need_sampled_value, team_variation_factor.
// Returns:
//   Array<{ need_rank, need_id, need_type, need_label, importance_score, reason, search_profile, search_profile_pretty, team_variation_factor, [need_corridors] }>

const teamCode = String(filterTeam.value || '').trim();
if (!teamCode) return [];

const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const s = (v) => String(v ?? '').trim();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const cash = n(getCashFromSaisonstand.value?.cash || 0);
const roster = (typeof formatDataAsArray === 'function' ?
formatDataAsArray(getActivePlayersByTeam.data) :
getActivePlayersByTeam.data) || [];

const rosterCount = Array.isArray(roster) ? roster.length : 0;

const trRows = (typeof formatDataAsArray === 'function' ?
formatDataAsArray(getTeamRatingsTransfermarkt.data) :
getTeamRatingsTransfermarkt.data) || [];
const tr = trRows?.[0] || {};

const harmony = clamp(n(tr.harmony) || 4, 1, 10);
const ambition = clamp(n(tr.ambition) || 5, 1, 10);
const finances = clamp(n(tr.finances) || 5, 1, 10);

// Strategic axis priorities (0..20)
const axisPriorityAbs = {
  pow: clamp(n(tr.power) || 0, 0, 20),
  spe: clamp(n(tr.speed) || 0, 0, 20),
  men: clamp(n(tr.mental) || 0, 0, 20),
  soc: clamp(n(tr.social) || 0, 0, 20) };


const axisPriority01 = (axis) => clamp(n(axisPriorityAbs?.[axis]) / 20, 0, 1);

// Team core averages
const avg = (key) => rosterCount ? roster.reduce((a, r) => a + n(r?.[key]), 0) / rosterCount : 0;
const teamCore = { pow: avg('pow'), spe: avg('spe'), men: avg('men'), soc: avg('soc') };

// -------------------------------------------------
// Variance layer: read sampled corridors from aiVarianceConfig
// -------------------------------------------------
const vc = aiVarianceConfig.value || {};
const team_variation_factor = Number(n(vc.team_variation_factor).toFixed(3));

const cashUsageTargetCorridor = vc.cashUsageTarget || { center: 0.45, min: 0.35, max: 0.92, sampled: 0.45 };
const fitMinSoftCorridor = vc.fitMinSoft || { center: 0, min: 0, max: 15, sampled: 0 };
const holeGate01Corridor = vc.holeGate01 || { center: 1, min: 0, max: 1, sampled: 1 };

// Use sampled values from variance config
const cashUsageTarget = n(cashUsageTargetCorridor.sampled);
const fitMinSoft = n(fitMinSoftCorridor.sampled);
const holeGate01 = n(holeGate01Corridor.sampled);

// -------------------------------------------------
// Thin roster detection
// -------------------------------------------------
const teamIdentity = (teamIdentityOverrides?.value || {})?.[teamCode] || (teamIdentityOverrides?.value || {})?.[String(teamCode || '').trim()] || null;

const targetRosterSize = clamp(n(teamIdentity?.roster?.target) || 10, 7, 12);
const rosterFill01 = targetRosterSize > 0 ? clamp(rosterCount / targetRosterSize, 0, 1) : 0;
const thinRoster = rosterCount < Math.max(7, targetRosterSize - 2);

// -------------------------------------------------
// Roster colors -> identity
// -------------------------------------------------
const classToColor = {
  Berserker: 'red', Warlord: 'red', Tank: 'red',
  Sprinter: 'green', Rogue: 'green', Charger: 'green',
  Mage: 'blue', Overseer: 'blue', Templar: 'blue',
  Bard: 'yellow', Hero: 'yellow', Badass: 'yellow', Tactician: 'yellow' };


const colorToAxis = { red: 'pow', green: 'spe', blue: 'men', yellow: 'soc' };

const rosterColorCounts = (roster || []).reduce((acc, r) => {
  const c = String(classToColor[String(r?.klasse || '')] || '').toLowerCase();
  if (!c) return acc;
  acc[c] = (acc[c] || 0) + 1;
  return acc;
}, { red: 0, green: 0, blue: 0, yellow: 0 });

const rosterSizeSafe = Math.max(1, rosterCount || 1);
const colorShare01 = (color) => clamp(n(rosterColorCounts[color] || 0) / rosterSizeSafe, 0, 1);

const primaryColors = Object.entries(rosterColorCounts).
sort((a, b) => n(b[1]) - n(a[1])).
slice(0, 2).
map(([c]) => c);

// -------------------------------------------------
// Strategy object (extended with variance debug)
// -------------------------------------------------
const salary_now = (roster || []).reduce((a, r) => a + n(r?.gehalt ?? r?.salary ?? r?.Gehalt ?? r?.gehalt_rechnung), 0);
const salary_runway = salary_now > 0 ? cash / salary_now : cash > 0 ? 99 : 0;

const budget_max = clamp(cash * cashUsageTarget, 0, cash);

const fitPolicy = {
  minFitSoft: Number(fitMinSoft.toFixed(1)),
  minFitHard: harmony >= 10 ? 12 : harmony >= 9 ? 10 : harmony >= 8 ? 8 : harmony >= 7 ? 6 : 0,
  fit25Bonus: harmony >= 10 ? 10 : harmony >= 9 ? 8 : harmony >= 8 ? 6 : harmony >= 7 ? 3 : 0 };


const strategy = {
  finance: {
    cash: Number(cash.toFixed(2)),
    salary_now: Number(salary_now.toFixed(2)),
    salary_runway: Number(salary_runway.toFixed(2)),
    cashUsageTarget: Number(cashUsageTarget.toFixed(3)),
    ambition,
    finances,
    harmony },

  fit_policy: {
    harmony,
    min_fit_soft: fitPolicy.minFitSoft,
    min_fit_hard: fitPolicy.minFitHard,
    fit25_bonus: fitPolicy.fit25Bonus },

  roster: {
    rosterCount,
    targetRosterSize,
    rosterFill01: Number(rosterFill01.toFixed(3)),
    thinRoster,
    holeGate01: Number(holeGate01.toFixed(3)) },

  roster_color: {
    primary_colors: primaryColors,
    shares: {
      red: colorShare01('red'),
      green: colorShare01('green'),
      blue: colorShare01('blue'),
      yellow: colorShare01('yellow') } },


  variance: {
    team_variation_factor,
    sampled_cashUsageTarget: Number(cashUsageTarget.toFixed(3)),
    sampled_fitMinSoft: Number(fitMinSoft.toFixed(1)),
    sampled_holeGate01: Number(holeGate01.toFixed(3)) } };



const fit_tendency = {
  harmony,
  mode: harmony <= 3 ? 'tolerant' : harmony <= 6 ? 'neutral' : 'prefers_high_fit',
  min_fit_soft: fitPolicy.minFitSoft,
  min_fit_hard: fitPolicy.minFitHard,
  fit25_bonus: fitPolicy.fit25Bonus };


// --------------------
// Needs
// --------------------
const needs = [];

// A) Axis upgrade needs
{
  const axisLabelLong = { pow: 'Power (POW)', spe: 'Speed (SPE)', men: 'Mental (MEN)', soc: 'Social (SOC)' };
  const axisLabelShort = { pow: 'POW', spe: 'SPE', men: 'MEN', soc: 'SOC' };

  const coreVals = Object.values(teamCore);
  const coreMax = coreVals.length ? Math.max(...coreVals) : 0;
  const coreMin = coreVals.length ? Math.min(...coreVals) : 0;
  const coreRange = coreMax - coreMin || 1;
  const weakness01 = (axis) => clamp((coreMax - n(teamCore[axis])) / coreRange, 0, 1);

  const totalPriorityAbs = ['pow', 'spe', 'men', 'soc'].reduce((acc, ax) => acc + n(axisPriorityAbs?.[ax] || 0), 0);
  const desiredShare = (axis) => {
    if (totalPriorityAbs <= 0) return 0;
    return clamp(n(axisPriorityAbs?.[axis] || 0) / totalPriorityAbs, 0, 1);
  };

  const axisMass = {
    pow: roster.reduce((acc, r) => acc + n(r?.pow), 0),
    spe: roster.reduce((acc, r) => acc + n(r?.spe), 0),
    men: roster.reduce((acc, r) => acc + n(r?.men), 0),
    soc: roster.reduce((acc, r) => acc + n(r?.soc), 0) };


  const totalMass = n(axisMass.pow) + n(axisMass.spe) + n(axisMass.men) + n(axisMass.soc);
  const actualShare = (axis) => {
    if (totalMass <= 0) return 0;
    return clamp(n(axisMass?.[axis] || 0) / totalMass, 0, 1);
  };

  const coverageGap = (axis) => clamp(Math.max(0, desiredShare(axis) - actualShare(axis)), 0, 1);

  const mode = thinRoster ? 'identity_build' : ambition >= 7 ? 'peak' : 'depth';

  const axes = ['soc', 'pow', 'spe', 'men'];
  const axisRows = axes.
  map((axis) => {
    const p01 = axisPriority01(axis);
    const w01 = weakness01(axis);
    const dSh = desiredShare(axis);
    const aSh = actualShare(axis);
    const gap = coverageGap(axis);

    const score = thinRoster ?
    clamp(0.55 * dSh + 0.30 * gap + 0.15 * w01, 0, 1) :
    clamp(0.80 * p01 + 0.20 * w01, 0, 1);

    return {
      axis,
      p01,
      w01,
      desiredShare: dSh,
      actualShare: aSh,
      coverageGap: gap,
      score };

  }).
  filter((x) => x.p01 > 0).
  sort((a, b) =>
  n(b.score) - n(a.score) ||
  n(b.coverageGap) - n(a.coverageGap) ||
  n(b.desiredShare) - n(a.desiredShare) ||
  n(b.w01) - n(a.w01));


  for (const ax of axisRows) {
    if (ax.score < 0.10) continue;

    const profileObj = {
      budget_max,
      axis_focus: ax.axis,
      axis_priority: axisPriorityAbs[ax.axis],
      upgrade_mode: mode,
      identity_bias: { ...teamCore },
      desired_share: Number(n(ax.desiredShare).toFixed(4)),
      actual_share: Number(n(ax.actualShare).toFixed(4)),
      coverage_gap: Number(n(ax.coverageGap).toFixed(4)),
      fit_tendency,
      strategy };


    const reason = thinRoster ?
    `Thin roster (${rosterCount}/${targetRosterSize}) → Identity build | desired ${(ax.desiredShare * 100).toFixed(0)}% | actual ${(ax.actualShare * 100).toFixed(0)}% | gap ${(ax.coverageGap * 100).toFixed(0)}% | weakness ${(ax.w01 * 100).toFixed(0)}% | Ø ${n(teamCore[ax.axis]).toFixed(1)}` :
    `Priorität ${axisPriorityAbs[ax.axis]}/20 | Schwäche-Index ${(ax.w01 * 100).toFixed(0)}% | Ø ${n(teamCore[ax.axis]).toFixed(1)}`;

    const imp = thinRoster ?
    clamp(58 + ax.score * 42, 0, 100) :
    clamp(35 + ax.score * 55, 0, 100);

    needs.push({
      need_type: 'axis_upgrade',
      need_label: `${axisLabelLong[ax.axis]} Upgrade`,
      importance_score: imp,
      reason,
      search_profile: JSON.stringify(profileObj),
      search_profile_pretty: `Budget ≤ ${budget_max.toFixed(1)} | Fokus ${axisLabelShort[ax.axis]} | Modus ${mode}`,
      team_variation_factor,
      need_corridors: {
        cashUsageTarget: cashUsageTargetCorridor } });


  }
}

// B) discipline_hole needs (thin-roster gated)
{
  const rankings = Array.isArray(teamDisciplineRankings.value) ? teamDisciplineRankings.value : [];
  const row = rankings.find((r) => s(r?.team) === teamCode) || null;
  const totalTeams = n(rankings.length) || 1;
  if (row && totalTeams > 1) {
    const DISCIPLINES = [
    { field: 'tdm', label: 'TDM', color: 'red' },
    { field: 'mini_dm', label: 'Mini DM', color: 'red' },
    { field: 'gewichtheben', label: 'Gewichtheben', color: 'red' },
    { field: 'hockey', label: 'Hockey', color: 'red' },
    { field: 'breaking', label: 'Breaking', color: 'red' },
    { field: 'staffel', label: 'Staffel', color: 'green' },
    { field: 'time_trial', label: 'Time Trial', color: 'green' },
    { field: 'spurt', label: 'Spurt', color: 'green' },
    { field: 'climbing', label: 'Climbing', color: 'green' },
    { field: 'fechten', label: 'Fechten', color: 'green' },
    { field: 'schach', label: 'Schach', color: 'blue' },
    { field: 'takeshi', label: 'Takeshi', color: 'blue' },
    { field: 'tennis', label: 'Tennis', color: 'blue' },
    { field: 'i_spy', label: 'I Spy', color: 'blue' },
    { field: 'wettessen', label: 'Wettessen', color: 'blue' },
    { field: 'basketball', label: 'Basketball', color: 'yellow' },
    { field: 'football', label: 'Football', color: 'yellow' },
    { field: 'battlefield', label: 'Battlefield', color: 'yellow' },
    { field: 'eiskunst', label: 'Eiskunst', color: 'yellow' },
    { field: 'showcase', label: 'Showcase', color: 'yellow' }];


    const recipes = disciplineRecipesGlobal.value || {};

    const ATTR_TO_AXIS = {
      power: 'pow', health: 'pow', stamina: 'pow', determination: 'pow',
      speed: 'spe', dexterity: 'spe',
      intelligence: 'men', awareness: 'men', will: 'men',
      charisma: 'soc', spirit: 'soc', torment: 'soc' };


    const priorityFitFromWeights01 = (weights, fallbackAxis) => {
      const entries = Object.entries(weights || {}).filter(([, w]) => n(w) > 0);
      if (!entries.length) return axisPriority01(fallbackAxis);

      let sumW = 0;
      let blended = 0;

      for (const [attr, wRaw] of entries) {
        const w = n(wRaw);
        const ax = ATTR_TO_AXIS[String(attr || '').toLowerCase()] || fallbackAxis;
        sumW += w;
        blended += axisPriority01(ax) * w;
      }

      if (sumW <= 0) return axisPriority01(fallbackAxis);
      return clamp(blended / sumW, 0, 1);
    };

    const compute = (d) => {
      const rank = n(row?.[`${d.field}_rank`]);
      const sum = n(row?.[`${d.field}_sum`]);
      if (!rank) return null;

      const holeSeverity = clamp((rank - 1) / Math.max(1, totalTeams - 1), 0, 1);

      const weights = recipes?.[d.field] || null;
      const fallbackAxis = colorToAxis[d.color] || 'pow';
      const priorityFit = priorityFitFromWeights01(weights, fallbackAxis);

      const share = colorShare01(d.color);
      const relevance = primaryColors.includes(d.color) ? 1 : share > 0 ? 0.65 : 0.35;

      let holeScore = holeSeverity * (0.35 + 0.65 * priorityFit) * relevance;

      const lowFitPenalty01 = priorityFit < 0.35 ? 0.55 : priorityFit < 0.50 ? 0.30 : 0;
      const gated = holeScore * (thinRoster ? 0.12 + 0.88 * holeGate01 : 1);
      holeScore = gated * (1 - lowFitPenalty01);

      return {
        ...d,
        rank,
        sum,
        discipline_weights: weights,
        holeSeverity: Number(holeSeverity.toFixed(3)),
        priorityFit: Number(priorityFit.toFixed(3)),
        relevance: Number(relevance.toFixed(3)),
        holeScore };

    };

    const scored = DISCIPLINES.map(compute).filter(Boolean).sort((a, b) => n(b.holeScore) - n(a.holeScore));

    const mode = thinRoster ? 'identity_build' : ambition >= 7 ? 'peak' : 'depth';

    scored.slice(0, 2).forEach((d) => {
      if (n(d.holeSeverity) < 0.30) return;

      const profileObj = {
        budget_max,
        need_family: 'discipline',
        discipline: d.label,
        discipline_field: d.field,
        discipline_rank: d.rank,
        discipline_sum: Number(n(d.sum).toFixed(1)),
        total_teams: totalTeams,
        upgrade_mode: mode,
        holeSeverity: d.holeSeverity,
        priorityFit: d.priorityFit,
        relevance: d.relevance,
        holeScore: Number(n(d.holeScore).toFixed(4)),
        discipline_weights: d.discipline_weights,
        fit_tendency,
        strategy };


      const baseImp = clamp(28 + n(d.holeScore) * 92 + (mode === 'peak' ? 3 : 0), 0, 96);
      const importance_score = thinRoster ? Math.min(44, baseImp) : baseImp;

      const reason = thinRoster ?
      `Thin roster (${rosterCount}/${targetRosterSize}) → Discipline holes gated | Diszi Rank ${d.rank}/${totalTeams} | holeSeverity ${(d.holeSeverity * 100).toFixed(0)}% × priorityFit ${(d.priorityFit * 100).toFixed(0)}% × relevance ${(d.relevance * 100).toFixed(0)}%` :
      `Diszi Rank ${d.rank}/${totalTeams} | holeSeverity ${(d.holeSeverity * 100).toFixed(0)}% × priorityFit ${(d.priorityFit * 100).toFixed(0)}% × relevance ${(d.relevance * 100).toFixed(0)}%`;

      needs.push({
        need_type: 'discipline_hole',
        need_label: `Loch stopfen: ${d.label}`,
        importance_score,
        reason,
        search_profile: JSON.stringify(profileObj),
        search_profile_pretty: `Budget ≤ ${budget_max.toFixed(1)} | Diszi ${d.label} | Score ${(n(d.holeScore) * 100).toFixed(0)} | Modus ${mode}`,
        team_variation_factor,
        need_corridors: {
          holeGate01: holeGate01Corridor } });


    });
  }
}

// C) Color economy
{
  const colors = ['red', 'green', 'blue', 'yellow'];
  const best = colors.
  map((c) => {
    const axis = colorToAxis[c];
    const pr = axisPriority01(axis);
    const sh = colorShare01(c);
    const scarcity = sh <= 0.15 ? (0.15 - sh) / 0.15 : 0;
    const stackPenalty = sh >= 0.60 ? (sh - 0.60) / 0.40 : 0;
    const v = 0.75 * pr + 0.20 * scarcity - 0.55 * stackPenalty;
    return { c, v, share: sh, axis };
  }).
  sort((a, b) => n(b.v) - n(a.v))[0];

  if (best && best.v > 0.10) {
    needs.push({
      need_type: 'color_economy',
      need_label: `Klassenfarbe: ${best.c} (${String(best.axis).toUpperCase()})`,
      importance_score: clamp(28 + best.v * 60, 0, 92),
      reason: `Share ${(best.share * 100).toFixed(0)}% | Achsen-Priorität ${axisPriorityAbs[best.axis]}/20 | 2 Formkarten`,
      search_profile: JSON.stringify({
        budget_max,
        desired_class_color: best.c,
        desired_axis: best.axis,
        color_share: best.share,
        axis_priority: axisPriorityAbs[best.axis],
        fit_tendency,
        strategy,
        upgrade_mode: thinRoster ? 'identity_build' : ambition >= 7 ? 'peak' : 'depth' }),

      search_profile_pretty: `Budget ≤ ${budget_max.toFixed(1)} | Farbe ${best.c} | Share ${(best.share * 100).toFixed(0)}%`,
      team_variation_factor });

  }
}

// D) Historical scouts
{
  const baseProf = (mode) => ({ budget_max, axis_priority: { ...axisPriorityAbs }, fit_tendency, strategy, upgrade_mode: mode });

  needs.push({
    need_type: 'historical_peak_opportunity',
    need_label: 'Scouting: Historical Peak',
    importance_score: clamp(18 + (ambition >= 7 ? 10 : 4), 0, 70),
    reason: 'Scout-Signal: Spezialisten-Peaks historisch.',
    search_profile: JSON.stringify({ ...baseProf('peak'), history_mode: 'peak' }),
    search_profile_pretty: `Budget ≤ ${budget_max.toFixed(1)} | History peak`,
    team_variation_factor });


  needs.push({
    need_type: 'historical_breadth_opportunity',
    need_label: 'Scouting: Historical Breadth',
    importance_score: clamp(18 + (ambition <= 6 ? 10 : 4), 0, 70),
    reason: 'Scout-Signal: Breite/Vielseitigkeit historisch.',
    search_profile: JSON.stringify({ ...baseProf('depth'), history_mode: 'breadth' }),
    search_profile_pretty: `Budget ≤ ${budget_max.toFixed(1)} | History breadth`,
    team_variation_factor });

}

// Final sort + top slice
needs.sort((a, b) => n(b.importance_score) - n(a.importance_score));

const out = needs.slice(0, 10).map((x, idx) => ({
  need_rank: idx + 1,
  need_id: `${teamCode}::${s(x.need_type)}::${s(x.need_label).slice(0, 32)}`,
  need_type: x.need_type,
  need_label: x.need_label,
  importance_score: Number(n(x.importance_score).toFixed(2)),
  reason: x.reason,
  search_profile: x.search_profile,
  search_profile_pretty: x.search_profile_pretty,
  team_variation_factor: x.team_variation_factor,
  need_corridors: x.need_corridors || {} }));


return out;
