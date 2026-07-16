// term: AI2_06_SimulatePicks
// id: AI2_06_SimulatePicks
// type: script
// subtype: Function
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
// Documentation:
//   AI2 Stage 06 (SimulatePicks): runs Planner, then simulates sequential picks.
//
//   v15.5 changes:
//   - Respects planner spendArchitecture including fill_then_spike reverse buying.
//   - Tracks pickedAxes via candidate_axis / primary_axis first.
//   - After skips, later roles can be upgraded to spend saved budget better.
//   - Skip does not spend budget.
//   - Skip does not push player into simRoster.
//   - Skip does not update pickedAxes / pickedDisciplines.
//   - Skipped candidate names are avoided for the current run.
//   - Pushes full chosen player row into simRoster.
//
// Returns:
//   { ok, version, team, simSeed, plannedSteps, planned_picks, needs_timeline, debug }

const VERSION = 'ai2.simulatePicks.v15_7_3_1_fit_tiebreak_neartop_fix';

const team = String(filterTeam.value || '').trim();

if (!team) {
  return {
    ok: false,
    version: VERSION,
    team: '',
    simSeed: '',
    plannedSteps: 0,
    activeTarget: 0,
    activeBuys: 0,
    skippedRows: 0,
    planned_picks: [],
    needs_timeline: [],
    debug: { notes: ['missing team'] }
  };
}

const n = (v, fallback = 0) => {
  const x = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(x) ? x : Number(fallback);
};

const s = (v) => String(v ?? '').trim();
const lower = (v) => String(v ?? '').trim().toLowerCase();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const fmt = (v, d = 2) =>
  Number.isFinite(Number(v)) ? Number(Number(v).toFixed(d)).toString() : '0';

const hash32_06 = (input) => {
  const str = String(input ?? '');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

const seeded01_06 = (key) => {
  let seed = '';
  try { seed = String(simSeed || ''); } catch (e) { seed = ''; }
  return hash32_06(`${seed}|${key}`) / 4294967296;
};

const pickWeightedSeeded06 = (items, key, fallback = null) => {
  const list = (Array.isArray(items) ? items : [])
    .map((it) => ({ ...it, weight: Math.max(0, n(it.weight ?? it.w, 0)) }))
    .filter((it) => it.weight > 0);

  if (!list.length) return fallback;

  const total = list.reduce((sum, it) => sum + it.weight, 0);
  let roll = seeded01_06(key) * total;

  for (const it of list) {
    roll -= it.weight;
    if (roll <= 0) return it;
  }

  return list[list.length - 1];
};

const DISZI_AXIS = {
  tdm: 'pow',
  mini_dm: 'pow',
  gewichtheben: 'pow',
  hockey: 'pow',
  breaking: 'pow',
  staffel: 'spe',
  time_trial: 'spe',
  spurt: 'spe',
  climbing: 'spe',
  fechten: 'spe',
  schach: 'men',
  takeshi: 'men',
  tennis: 'men',
  i_spy: 'men',
  wettessen: 'men',
  basketball: 'soc',
  football: 'soc',
  battlefield: 'soc',
  eiskunst: 'soc',
  showcase: 'soc'
};

const AXES = ['pow', 'spe', 'men', 'soc'];

const AXIS_TO_COLOR = { pow: 'red', spe: 'green', men: 'blue', soc: 'yellow' };

const axisForDiszi = (dz) => DISZI_AXIS[lower(dz)] || '';

const desiredCardColorsForTeam06 = () => {
  // v15.6.1 fix:
  // Do NOT depend on identityProfile06 here. This 06 version gets identity from AI2_04_Planner.plan.teamMetrics.
  // The function is called after planRes exists, so this closure is safe.
  const tm = planRes?.plan?.teamMetrics || {};

  const raw = {
    pow: n(tm.powIdentity, NaN),
    spe: n(tm.speIdentity, NaN),
    men: n(tm.menIdentity, NaN),
    soc: n(tm.socIdentity, NaN)
  };

  const hasTeamMetrics = AXES.some((ax) => Number.isFinite(raw[ax]) && raw[ax] > 0);

  if (!hasTeamMetrics) {
    return ['red', 'green', 'blue', 'yellow'];
  }

  const sum = Math.max(1, AXES.reduce((acc, ax) => acc + Math.max(0, n(raw[ax], 0)), 0));

  const identityColors = AXES
    .map((ax) => ({
      ax,
      share: Math.max(0, n(raw[ax], 0)) / sum,
      value: Math.max(0, n(raw[ax], 0)),
      color: AXIS_TO_COLOR[ax] || ''
    }))
    .filter((x) => x.color && x.value > 0)
    .sort((a, b) => b.share - a.share || b.value - a.value)
    .filter((x, idx) => idx < 2 || x.share >= 0.24)
    .map((x) => x.color);

  const out = identityColors.slice(0, 2);

  if (!out.length) out.push('red', 'green', 'blue', 'yellow');

  return [...new Set(out)];
};

const ROLE_ORDER = ['reserve', 'backup', 'depth', 'core', 'elite', 'star', 'superstar'];

const normalizeRole = (role) => {
  const r = lower(role || '');
  if (r === 'elite') return 'star';
  return ROLE_ORDER.includes(r) ? r : 'depth';
};

const roleIndex = (role) => {
  const i = ROLE_ORDER.indexOf(String(role || ''));
  return i < 0 ? 2 : i;
};

const upgradeRole = (role, steps, maxRole = 'star') => {
  const current = roleIndex(role);
  const max = roleIndex(maxRole);
  const next = clamp(current + steps, current, max);
  return ROLE_ORDER[next] || role;
};

const strongestAxisFromStats = (row) => {
  const vals = {
    pow: n(row?.pow ?? row?.sim_added_pow, 0),
    spe: n(row?.spe ?? row?.sim_added_spe, 0),
    men: n(row?.men ?? row?.sim_added_men, 0),
    soc: n(row?.soc ?? row?.sim_added_soc, 0)
  };

  return Object.entries(vals).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
};

const candidateCoversAxis06 = (candidate, axis) => {
  const ax = lower(axis || '');
  if (!['pow', 'spe', 'men', 'soc'].includes(ax)) return false;

  const explicitAxes = [
    candidate?.primary_axis,
    candidate?.candidate_axis,
    candidate?.step_axis,
    candidate?.picked_axis_tracked,
    candidate?.secondary_axis
  ].map(lower);

  if (explicitAxes.includes(ax)) return true;

  const covered = Array.isArray(candidate?.covered_axes)
    ? candidate.covered_axes.map(lower)
    : [];

  if (covered.includes(ax)) return true;

  const vals = {
    pow: n(candidate?.pow ?? candidate?.sim_added_pow, 0),
    spe: n(candidate?.spe ?? candidate?.sim_added_spe, 0),
    men: n(candidate?.men ?? candidate?.sim_added_men, 0),
    soc: n(candidate?.soc ?? candidate?.sim_added_soc, 0)
  };

  const maxVal = Math.max(vals.pow, vals.spe, vals.men, vals.soc);
  if (maxVal <= 0) return false;

  // Tie-aware: if the focus axis is effectively the player's best axis, count it.
  // This prevents SOC-anchor picks with POW/SOC ties from being tracked as POW only.
  return vals[ax] >= maxVal - 1;
};


const candidateCoversAxisStrictForExtreme06 = (candidate, axis) => {
  const meta = getTeamIdentityMeta06();
  const ax = lower(axis || '');
  if (!['pow', 'spe', 'men', 'soc'].includes(ax)) return false;
  if (meta.topShare < 0.72 || ax !== meta.topAxis) return candidateCoversAxis06(candidate, ax);

  const vals = {
    pow: n(candidate?.pow ?? candidate?.sim_added_pow, 0),
    spe: n(candidate?.spe ?? candidate?.sim_added_spe, 0),
    men: n(candidate?.men ?? candidate?.sim_added_men, 0),
    soc: n(candidate?.soc ?? candidate?.sim_added_soc, 0)
  };
  const maxVal = Math.max(vals.pow, vals.spe, vals.men, vals.soc);
  if (!(maxVal > 0)) return false;

  // For extreme identity teams, explicit axis labels alone are not enough.
  // The main identity stat must be one of the player's real leading stats.
  return vals[ax] >= maxVal - 6 && vals[ax] >= maxVal * 0.82;
};

const resolveCandidateAxis = (chosen, preferredAxis = '') => {
  const pref = lower(preferredAxis || '');
  if (['pow', 'spe', 'men', 'soc'].includes(pref) && candidateCoversAxis06(chosen, pref)) {
    return pref;
  }

  const primary = lower(chosen?.primary_axis || '');
  if (['pow', 'spe', 'men', 'soc'].includes(primary)) return primary;

  const candidate = lower(chosen?.candidate_axis || '');
  if (['pow', 'spe', 'men', 'soc'].includes(candidate)) return candidate;

  const stepAxis = lower(chosen?.step_axis || '');
  if (['pow', 'spe', 'men', 'soc'].includes(stepAxis)) return stepAxis;

  const dz = lower(chosen?.step_diszi || chosen?.best_diszi_field || '');
  const dzAxis = axisForDiszi(dz);
  if (['pow', 'spe', 'men', 'soc'].includes(dzAxis)) return dzAxis;

  const statAxis = strongestAxisFromStats(chosen);
  if (['pow', 'spe', 'men', 'soc'].includes(statAxis)) return statAxis;

  return '';
};

const buildScoreBreakdown = (pick) => {
  const hasRaw =
    pick?.score_raw_uncapped !== undefined ||
    pick?.score_100_raw_uncapped !== undefined ||
    pick?.score_100_pre_softcap !== undefined;

  const score_100_final = n(pick?.score_100_final ?? pick?.score);
  const score_100_pre_jitter = n(pick?.score_100_pre_jitter ?? pick?.pre_jitter_score);
  const score_jitter = n(pick?.score_jitter);

  const score_raw_uncapped = hasRaw
    ? n(
        pick?.score_raw_uncapped ??
          pick?.score_100_raw_uncapped ??
          pick?.score_100_pre_softcap
      )
    : null;

  const score_100_pre_softcap =
    pick?.score_100_pre_softcap !== undefined
      ? n(pick?.score_100_pre_softcap)
      : hasRaw
      ? n(pick?.score_raw_uncapped ?? pick?.score_100_raw_uncapped)
      : null;

  const score_100_pre_gate =
    pick?.score_100_pre_gate !== undefined
      ? n(pick?.score_100_pre_gate)
      : score_100_pre_softcap !== null
      ? Math.min(100, score_100_pre_softcap)
      : null;

  const score_overflow_over_100 =
    pick?.score_overflow_over_100 !== undefined
      ? n(pick?.score_overflow_over_100)
      : score_raw_uncapped !== null
      ? Math.max(0, score_raw_uncapped - 100)
      : null;

  const need_abs = n(pick?.need_abs);
  const skill_abs = n(pick?.skill_abs);
  const value_abs = n(pick?.value_abs);
  const peak_abs = n(pick?.peak_impact_abs ?? pick?.peak_abs);
  const soft_abs = n(pick?.soft_abs);
  const team_identity = n(pick?.team_identity_score100);
  const direct_penalty = n(pick?.diversity_direct_penalty_abs);
  const class_penalty = n(pick?.batch_class_penalty_abs);
  const roster_axis_penalty = n(pick?.roster_axis_saturation_penalty_abs);
  const batch_bonus = n(pick?.batch_diversity_bonus_abs);
  const fit_bonus_abs =
    pick?.fit_bonus_abs !== undefined || pick?.fitBonus !== undefined
      ? n(pick?.fit_bonus_abs ?? pick?.fitBonus)
      : null;

  const parts = [
    'score100=' + fmt(score_100_final, 3),
    'raw=' + (score_raw_uncapped === null ? 'null' : fmt(score_raw_uncapped, 3)),
    'over100=' + (score_overflow_over_100 === null ? 'null' : fmt(score_overflow_over_100, 3)),
    'preSoft=' + (score_100_pre_softcap === null ? 'null' : fmt(score_100_pre_softcap, 3)),
    'preGate=' + (score_100_pre_gate === null ? 'null' : fmt(score_100_pre_gate, 3)),
    'pre=' + fmt(score_100_pre_jitter, 3),
    'jit=' + fmt(score_jitter, 3),
    'need=' + fmt(need_abs, 2),
    'skill=' + fmt(skill_abs, 2),
    'value=' + fmt(value_abs, 2),
    'peak=' + fmt(peak_abs, 2),
    'soft=' + fmt(soft_abs, 2),
    'fitBonus=' + (fit_bonus_abs === null ? 'null' : fmt(fit_bonus_abs, 2)),
    'identity=' + fmt(team_identity, 1),
    'directPen=' + fmt(direct_penalty, 2),
    'classPen=' + fmt(class_penalty, 2),
    'rosterAxisPen=' + fmt(roster_axis_penalty, 2),
    'batchBonus=' + fmt(batch_bonus, 2)
  ];

  return {
    score_breakdown_text: parts.join(' · '),
    score_100_final: Number(score_100_final.toFixed(3)),
    score_100_pre_jitter: Number(score_100_pre_jitter.toFixed(3)),
    score_jitter: Number(score_jitter.toFixed(3)),
    need_abs: Number(need_abs.toFixed(2)),
    skill_abs: Number(skill_abs.toFixed(2)),
    value_abs: Number(value_abs.toFixed(2)),
    peak_impact_abs: Number(peak_abs.toFixed(2)),
    soft_abs: Number(soft_abs.toFixed(2)),
    score: Number(score_100_final.toFixed(3)),
    pre_jitter_score: Number(score_100_pre_jitter.toFixed(3)),

    score_raw_uncapped:
      score_raw_uncapped === null ? null : Number(score_raw_uncapped.toFixed(3)),
    score_100_raw_uncapped:
      score_raw_uncapped === null ? null : Number(score_raw_uncapped.toFixed(3)),
    score_overflow_over_100:
      score_overflow_over_100 === null ? null : Number(score_overflow_over_100.toFixed(3)),
    score_100_pre_softcap:
      score_100_pre_softcap === null ? null : Number(score_100_pre_softcap.toFixed(3)),
    score_100_pre_gate:
      score_100_pre_gate === null ? null : Number(score_100_pre_gate.toFixed(3)),
    fit_bonus_abs: fit_bonus_abs === null ? null : Number(fit_bonus_abs.toFixed(2)),
    fitBonus: fit_bonus_abs === null ? null : Number(fit_bonus_abs.toFixed(2))
  };
};

const extractEngineFields = (chosen) => {
  if (!chosen) return {};

  return {
    class_color: s(chosen?.class_color || ''),
    color_need01: Number(n(chosen?.color_need01).toFixed(3)),
    color_bonus_abs: Number(n(chosen?.color_bonus_abs).toFixed(2)),
    color_bonus01: Number(n(chosen?.color_bonus01).toFixed(3)),
    color_penalty_abs: Number(n(chosen?.color_penalty_abs).toFixed(2)),
    is_axis_color_match: chosen?.is_axis_color_match === true,
    axis_color: s(chosen?.axis_color || ''),

    axis_top6_before: Number(n(chosen?.axis_top6_before).toFixed(2)),
    axis_top6_after: Number(n(chosen?.axis_top6_after).toFixed(2)),
    axis_top6_delta: Number(n(chosen?.axis_top6_delta).toFixed(2)),
    axis_enters_top6: chosen?.axis_enters_top6 === true,
    axis_rank_in_roster: chosen?.axis_rank_in_roster ?? null,

    diszi_top3_before: Number(n(chosen?.diszi_top3_before).toFixed(2)),
    diszi_top3_after: Number(n(chosen?.diszi_top3_after).toFixed(2)),
    diszi_top3_delta: Number(n(chosen?.diszi_top3_delta).toFixed(2)),
    diszi_enters_top3: chosen?.diszi_enters_top3 === true,
    diszi_rank_in_roster: chosen?.diszi_rank_in_roster ?? null,

    axis_top3_before: Number(n(chosen?.axis_top3_before).toFixed(2)),
    axis_top3_after: Number(n(chosen?.axis_top3_after).toFixed(2)),
    axis_top3_delta: Number(n(chosen?.axis_top3_delta).toFixed(2)),
    axis_enters_top3: chosen?.axis_enters_top3 === true,
    axis_rank_in_roster_top3: chosen?.axis_rank_in_roster_top3 ?? null,

    diszi_top6_before: Number(n(chosen?.diszi_top6_before).toFixed(2)),
    diszi_top6_after: Number(n(chosen?.diszi_top6_after).toFixed(2)),
    diszi_top6_delta: Number(n(chosen?.diszi_top6_delta).toFixed(2)),
    diszi_enters_top6: chosen?.diszi_enters_top6 === true,
    diszi_rank_in_roster_top6: chosen?.diszi_rank_in_roster_top6 ?? null,

    impact_efficiency01: Number(n(chosen?.impact_efficiency01).toFixed(3)),
    value_efficiency_bonus_abs: Number(n(chosen?.value_efficiency_bonus_abs).toFixed(2)),
    overpay_penalty_abs: Number(n(chosen?.overpay_penalty_abs).toFixed(2)),
    overpay01: Number(n(chosen?.overpay01).toFixed(3)),
    role_match_01: Number(n(chosen?.role_match_01).toFixed(3)),
    role_overpay_penalty01: Number(n(chosen?.role_overpay_penalty01).toFixed(3)),
    role_delta: chosen?.role_delta ?? null,

    quality_score_100: Number(n(chosen?.quality_score_100).toFixed(2)),
    quality_gate_ok: chosen?.quality_gate_ok !== false,
    skip_recommended: chosen?.skip_recommended === true,
    skip_reason: s(chosen?.skip_reason || ''),
    skip_min_score: chosen?.skip_min_score ?? null,

    batch_color_penalty_abs: Number(n(chosen?.batch_color_penalty_abs).toFixed(2)),
    batch_axis_penalty_abs: Number(n(chosen?.batch_axis_penalty_abs).toFixed(2)),
    batch_class_penalty_abs: Number(n(chosen?.batch_class_penalty_abs).toFixed(2)),
    roster_axis_saturation_penalty_abs: Number(n(chosen?.roster_axis_saturation_penalty_abs).toFixed(2)),
    diversity_direct_penalty_abs: Number(n(chosen?.diversity_direct_penalty_abs).toFixed(2)),
    batch_diversity_bonus_abs: Number(n(chosen?.batch_diversity_bonus_abs).toFixed(2)),
    batch_diversity_reason: s(chosen?.batch_diversity_reason || ''),

    team_identity_score100: Number(n(chosen?.team_identity_score100).toFixed(2)),
    team_strategy: s(chosen?.team_strategy || ''),
    candidate_axis: s(chosen?.candidate_axis || ''),
    primary_axis: s(chosen?.primary_axis || chosen?.candidate_axis || ''),
    secondary_axis: s(chosen?.secondary_axis || ''),
    covered_axes: Array.isArray(chosen?.covered_axes) ? chosen.covered_axes : [],
    desired_axes: Array.isArray(chosen?.desired_axes) ? chosen.desired_axes : [],
    primary_secondary_match01: Number(n(chosen?.primary_secondary_match01).toFixed(3)),

    value_after_role01: Number(n(chosen?.value_after_role01).toFixed(3)),
    value_deal01: Number(n(chosen?.value_deal01).toFixed(3)),
    value_base01: Number(n(chosen?.value_base01).toFixed(3)),
    value_affordability01: Number(n(chosen?.value_affordability01).toFixed(3)),

    best_diszi_field: s(chosen?.best_diszi_field || ''),
    best_diszi_score: Number(n(chosen?.best_diszi_score).toFixed(2)),

    score_raw_uncapped:
      chosen?.score_raw_uncapped !== undefined || chosen?.score_100_raw_uncapped !== undefined
        ? Number(n(chosen?.score_raw_uncapped ?? chosen?.score_100_raw_uncapped).toFixed(3))
        : null,
    score_100_raw_uncapped:
      chosen?.score_raw_uncapped !== undefined || chosen?.score_100_raw_uncapped !== undefined
        ? Number(n(chosen?.score_100_raw_uncapped ?? chosen?.score_raw_uncapped).toFixed(3))
        : null,
    score_overflow_over_100:
      chosen?.score_overflow_over_100 !== undefined
        ? Number(n(chosen?.score_overflow_over_100).toFixed(3))
        : null,
    score_100_pre_softcap:
      chosen?.score_100_pre_softcap !== undefined
        ? Number(n(chosen?.score_100_pre_softcap).toFixed(3))
        : null,
    score_100_pre_gate:
      chosen?.score_100_pre_gate !== undefined
        ? Number(n(chosen?.score_100_pre_gate).toFixed(3))
        : null,
    fit_bonus_abs:
      chosen?.fit_bonus_abs !== undefined || chosen?.fitBonus !== undefined
        ? Number(n(chosen?.fit_bonus_abs ?? chosen?.fitBonus).toFixed(2))
        : null,

    league_luxury_penalty_abs: Number(n(chosen?.league_luxury_penalty_abs).toFixed(2)),
    soft_budget_penalty_abs: Number(n(chosen?.soft_budget_penalty_abs).toFixed(2)),
    premium_price_penalty_abs: Number(n(chosen?.premium_price_penalty_abs).toFixed(2)),
    price_vs_superstar: Number(n(chosen?.price_vs_superstar).toFixed(3)),
    superstar_ref_price: Number(n(chosen?.superstar_ref_price).toFixed(2)),
    soft_budget_ref: Number(n(chosen?.soft_budget_ref).toFixed(2)),
    soft_budget_over_abs: Number(n(chosen?.soft_budget_over_abs).toFixed(2)),
    soft_budget_over_ratio: Number(n(chosen?.soft_budget_over_ratio).toFixed(3)),
    finance_risk01: Number(n(chosen?.finance_risk01).toFixed(3)),
    aggression_relief01: Number(n(chosen?.aggression_relief01).toFixed(3)),

    form_card_utility_bonus_abs: Number(n(chosen?.form_card_utility_bonus_abs).toFixed(2)),
    card_utility_mode: chosen?.card_utility_mode === true,
    card_utility_color_match: chosen?.card_utility_color_match === true,
    card_utility_class_color: s(chosen?.card_utility_class_color || ''),
    desired_card_colors: Array.isArray(chosen?.desired_card_colors) ? chosen.desired_card_colors : [],
    card_utility_low_price01: Number(n(chosen?.card_utility_low_price01).toFixed(3)),
    card_utility_low_salary01: Number(n(chosen?.card_utility_low_salary01).toFixed(3)),
    card_utility_usable_body01: Number(n(chosen?.card_utility_usable_body01).toFixed(3)),
    card_utility_reason: s(chosen?.card_utility_reason || '')
  };
};

const extractPlayerStatsForSimRoster = (chosen, pickedName, price) => ({
  ...chosen,
  name: pickedName,
  player_name: pickedName,
  klasse: chosen?.klasse,
  marktwert: price,
  mw: price,
  price,
  team_fit: chosen?.fit,
  fit: chosen?.fit,

  pow: Number(n(chosen?.pow, 0).toFixed(2)),
  spe: Number(n(chosen?.spe, 0).toFixed(2)),
  men: Number(n(chosen?.men, 0).toFixed(2)),
  soc: Number(n(chosen?.soc, 0).toFixed(2)),
  diszi_attr_scores: chosen?.diszi_attr_scores || {}
});


const roleBySlotBudget06 = (slotBudget) => {
  const b = n(slotBudget, 0);

  if (b >= 68) return 'superstar';
  if (b >= 45) return 'star';
  if (b >= 32) return 'core';
  if (b >= 22) return 'depth';
  if (b >= 14) return 'backup';

  return 'reserve';
};

const minRole06 = (a, b) => (roleIndex(a) <= roleIndex(b) ? normalizeRole(a) : normalizeRole(b));
const maxRole06 = (a, b) => (roleIndex(a) >= roleIndex(b) ? normalizeRole(a) : normalizeRole(b));

const clampRoleBetween06 = (role, minRole, maxRole) => {
  const lo = roleIndex(minRole);
  const hi = roleIndex(maxRole);
  const r = clamp(roleIndex(role), lo, hi);
  return ROLE_ORDER[r] || normalizeRole(role);
};

const inferSpendArchitecture06 = (strategy, activeTarget, attackPressure01, savingsBias01, budgetMax, budgetBase) => {
  if (strategy === 'cash_creators') return 'value_depth_fill';
  if (savingsBias01 >= 0.68) return 'conservative_fill';

  const avgBudget = activeTarget > 0 ? n(budgetMax, 0) / activeTarget : 0;
  const tightForManyBuys = activeTarget >= 6 && avgBudget < 32;
  const wantsImpact = strategy === 'ambition_push' || attackPressure01 >= 0.70;

  if (wantsImpact && tightForManyBuys) return 'fill_then_spike';
  if (wantsImpact) return 'spike_and_fill';
  if (activeTarget >= 7 && budgetMax >= budgetBase * 0.70) return 'balanced_wave';
  return 'balanced';
};

const plannedImpactSlots06 = (architecture, activeTarget, attackPressure01, budgetStartValue) => {
  if (architecture === 'fill_then_spike') {
    const base = activeTarget >= 6 ? 1 : 0;
    const extra = activeTarget >= 8 && attackPressure01 >= 0.74 && budgetStartValue >= 180 ? 1 : 0;
    return clamp(base + extra, 0, Math.min(2, activeTarget));
  }

  if (architecture === 'spike_and_fill') {
    const base = activeTarget >= 8 ? 2 : 1;
    const extra = attackPressure01 >= 0.70 && budgetStartValue >= 180 ? 1 : 0;
    return clamp(base + extra, 1, Math.min(3, activeTarget));
  }

  if (architecture === 'balanced_wave') return activeTarget >= 7 ? 1 : 0;
  if (architecture === 'value_depth_fill') return 0;
  if (architecture === 'conservative_fill') return 0;

  return attackPressure01 >= 0.80 ? 1 : 0;
};

const isImpactSlotForArchitecture06 = (architecture, stepIdx, activeTarget, impactSlotsUsed) => {
  const arch = s(architecture || '');

  if (arch === 'fill_then_spike') {
    // Reverse buying: slot 0 is intentionally cheap/fill, later slot(s) may spike.
    if (impactSlotsUsed <= 0) return false;
    if (stepIdx === 1) return true;
    if (impactSlotsUsed >= 2 && stepIdx === 3) return true;
    return false;
  }

  if (arch === 'spike_and_fill') {
    return stepIdx < impactSlotsUsed;
  }

  if (arch === 'balanced_wave') {
    return impactSlotsUsed > 0 && stepIdx === 0;
  }

  return stepIdx < impactSlotsUsed;
};

const marketRoleOfCandidate06 = (c) => normalizeRole(s(c?.market_role || c?.lane || c?.role || 'reserve'));

const laneOkForSlot06 = (candidate, maxLaneForSlot, overLaneAllowance = 0) => {
  const lane = marketRoleOfCandidate06(candidate);
  return roleIndex(lane) <= roleIndex(maxLaneForSlot) + n(overLaneAllowance, 0);
};

const nextLane06 = (role, steps = 1) => {
  const idx = clamp(roleIndex(role) + n(steps, 1), 0, ROLE_ORDER.length - 1);
  return ROLE_ORDER[idx] || normalizeRole(role);
};

const compressRoleForBudget06 = ({
  baseRole,
  upgradedRole,
  avgRemainingBudget,
  plannerSoftSlotBudget,
  plannerStrategy,
  architecture,
  isImpactSlot,
  mandatoryLeft,
  remainingSlotsInclCurrent,
  attackPressure01,
  savingsBias01
}) => {
  const rawRole = normalizeRole(upgradedRole || baseRole || 'depth');

  const hardBudgetRole = roleBySlotBudget06(avgRemainingBudget);
  const softBudgetRole = plannerSoftSlotBudget > 0
    ? roleBySlotBudget06(plannerSoftSlotBudget * (plannerStrategy === 'ambition_push' ? 1.55 : 1.18))
    : hardBudgetRole;

  const budgetCapRole = minRole06(hardBudgetRole, softBudgetRole);

  let plannedRole = rawRole;
  let maxLaneForSlot = rawRole;
  let compressionReason = '';

  if (plannerStrategy === 'ambition_push' && isImpactSlot) {
    plannedRole = roleIndex(rawRole) < roleIndex('star') && avgRemainingBudget >= 24 ? 'star' : rawRole;
    maxLaneForSlot = avgRemainingBudget >= 44 && attackPressure01 >= 0.78 ? 'superstar' : 'star';
    compressionReason = 'impact_slot';
  } else if (architecture === 'value_depth_fill') {
    plannedRole = clampRoleBetween06(rawRole, 'reserve', 'depth');
    maxLaneForSlot = avgRemainingBudget >= 30 ? 'core' : budgetCapRole;
    compressionReason = 'value_depth_fill';
  } else {
    plannedRole = minRole06(rawRole, budgetCapRole);
    maxLaneForSlot = budgetCapRole;
    compressionReason = 'budget_cap';
  }

  if (mandatoryLeft >= remainingSlotsInclCurrent) {
    const mandatoryCap = avgRemainingBudget < 14 ? 'reserve' : avgRemainingBudget < 22 ? 'backup' : budgetCapRole;
    plannedRole = minRole06(plannedRole, mandatoryCap);
    maxLaneForSlot = minRole06(maxLaneForSlot, mandatoryCap);
    compressionReason += '|mandatory_fill';
  }

  if (!isImpactSlot && savingsBias01 >= 0.55) {
    maxLaneForSlot = minRole06(maxLaneForSlot, avgRemainingBudget >= 22 ? 'depth' : avgRemainingBudget >= 14 ? 'backup' : 'reserve');
    plannedRole = minRole06(plannedRole, maxLaneForSlot);
    compressionReason += '|savings_bias';
  }

  if (!isImpactSlot && avgRemainingBudget < 14) {
    plannedRole = 'reserve';
    maxLaneForSlot = 'reserve';
    compressionReason += '|low_avg_budget';
  }

  if (!isImpactSlot && avgRemainingBudget < 22 && roleIndex(plannedRole) > roleIndex('backup')) {
    plannedRole = 'backup';
    maxLaneForSlot = minRole06(maxLaneForSlot, 'backup');
    compressionReason += '|backup_budget';
  }

  return {
    rawRole,
    plannedRole: normalizeRole(plannedRole),
    maxLaneForSlot: normalizeRole(maxLaneForSlot),
    budgetCapRole: normalizeRole(budgetCapRole),
    hardBudgetRole: normalizeRole(hardBudgetRole),
    softBudgetRole: normalizeRole(softBudgetRole),
    compressionReason: compressionReason || 'none',
    roleCompressed: normalizeRole(plannedRole) !== normalizeRole(rawRole)
  };
};

const getTeamIdentityMeta06 = () => {
  const tm = planRes?.plan?.teamMetrics || {};

  const raw = {
    pow: Math.max(0, n(tm.powIdentity, 0)),
    spe: Math.max(0, n(tm.speIdentity, 0)),
    men: Math.max(0, n(tm.menIdentity, 0)),
    soc: Math.max(0, n(tm.socIdentity, 0))
  };

  const sum = Math.max(1, AXES.reduce((acc, ax) => acc + raw[ax], 0));
  const share = Object.fromEntries(AXES.map((ax) => [ax, raw[ax] / sum]));
  const topAxis = AXES.slice().sort((a, b) => share[b] - share[a] || raw[b] - raw[a])[0] || 'pow';
  const topShare = share[topAxis] || 0;

  return { raw, share, topAxis, topShare };
};

const identityAnchorDecision06 = (identityAxisNeeds, context = {}) => {
  const meta = getTeamIdentityMeta06();
  const pickedAxesNow = Array.isArray(context.pickedAxes) ? context.pickedAxes.map(lower) : [];
  const pickedTopCount = pickedAxesNow.filter((ax) => ax === meta.topAxis).length;
  const stepIdxNow = n(context.stepIdx, 0);
  const activeTargetNow = Math.max(1, n(context.activeTarget, 0));
  const remainingSlotsInclCurrentNow = Math.max(1, activeTargetNow - stepIdxNow);
  const strategy = s(context.plannerStrategy || plannerStrategy || '');
  const architecture = s(context.architecture || plannerSpendArchitecture || '');

  // A dominant identity axis should not be fully overwritten by discipline micro-needs.
  // This is intentionally small and quota-like: it only anchors 1-3 picks, then lets needs roam again.
  let targetTopAxisPicks = 0;

  if (meta.topShare >= 0.75) targetTopAxisPicks = Math.min(activeTargetNow, Math.max(2, Math.ceil(activeTargetNow * 0.85)));
  else if (meta.topShare >= 0.5) targetTopAxisPicks = Math.min(3, Math.max(2, Math.round(activeTargetNow * 0.28)));
  else if (meta.topShare >= 0.35) targetTopAxisPicks = 2;
  else if (meta.topShare >= 0.27) targetTopAxisPicks = 1;

  if (architecture === 'value_depth_fill' && meta.topShare >= 0.35) {
    targetTopAxisPicks = Math.max(targetTopAxisPicks, 2);
  }

  if (strategy === 'cash_creators' && meta.topShare >= 0.35) {
    targetTopAxisPicks = Math.max(targetTopAxisPicks, 2);
  }

  const tooLateToForce = meta.topShare >= 0.75 ? false : (remainingSlotsInclCurrentNow <= 2 && pickedTopCount > 0);
  const alreadyAnchored = pickedTopCount >= targetTopAxisPicks;
  const canForce = targetTopAxisPicks > 0 && !alreadyAnchored && !tooLateToForce;

  if (!canForce) {
    return {
      force: false,
      topAxis: meta.topAxis,
      topShare: meta.topShare,
      pickedTopCount,
      targetTopAxisPicks,
      reason: alreadyAnchored ? 'identity_anchor_satisfied' : tooLateToForce ? 'identity_anchor_too_late' : 'identity_anchor_inactive'
    };
  }

  const topAxisNeed = (Array.isArray(identityAxisNeeds) ? identityAxisNeeds : []).find((x) => x.axis === meta.topAxis) || null;

  return {
    force: true,
    focusType: 'identity_weighted',
    focusKey: meta.topAxis,
    needId: topAxisNeed?.id || '',
    topAxis: meta.topAxis,
    topShare: meta.topShare,
    pickedTopCount,
    targetTopAxisPicks,
    reason: `identity_anchor_${meta.topAxis}_${pickedTopCount}of${targetTopAxisPicks}`
  };
};

const pickDynamicFocusFromNeeds = (needsRows, plannedFallback, context = {}) => {
  const needs = Array.isArray(needsRows) ? needsRows : [];

  const identityAxisNeeds = needs
    .filter((x) => s(x?.category) === 'identity' && s(x?.meta?.kind) === 'axis')
    .map((x) => ({
      axis: lower(x?.meta?.axis || ''),
      weight: n(x?.weight, 0),
      id: s(x?.id || '')
    }))
    .filter((x) => ['pow', 'spe', 'men', 'soc'].includes(x.axis))
    .sort((a, b) => b.weight - a.weight);

  const disziMap = new Map();

  for (const nd of needs) {
    if (s(nd?.category) !== 'discipline') continue;

    const diszi = lower(nd?.meta?.diszi || nd?.meta?.discipline_field || nd?.meta?.field || '');
    if (!diszi) continue;

    const w = n(nd?.weight, 0);
    const ex = disziMap.get(diszi);

    if (!ex || w > ex.weight) {
      disziMap.set(diszi, {
        diszi,
        axis: lower(nd?.meta?.axis || axisForDiszi(diszi)),
        subKind: s(nd?.meta?.subKind || ''),
        weight: w,
        id: s(nd?.id || '')
      });
    }
  }

  const disciplineNeeds = [...disziMap.values()].sort((a, b) => b.weight - a.weight);

  const topIdentity = identityAxisNeeds[0] || null;
  const topDiszi = disciplineNeeds[0] || null;

  const identityAnchor = identityAnchorDecision06(identityAxisNeeds, context);

  if (identityAnchor.force) {
    return {
      focusType: identityAnchor.focusType,
      focusKey: identityAnchor.focusKey,
      source: identityAnchor.reason,
      needId: identityAnchor.needId,
      identity_anchor: identityAnchor,
      seeded_need_choice: false
    };
  }

  if (!topIdentity && !topDiszi) {
    return {
      focusType: s(plannedFallback?.focusType || 'roster_fill'),
      focusKey: s(plannedFallback?.focusKey || 'fill'),
      source: 'planned.fallback',
      needId: '',
      seeded_need_choice: false
    };
  }

  const stepIdxNow = n(context.stepIdx, 0);
  const activeTargetNow = Math.max(1, n(context.activeTarget, 0));
  const pickedAxesNow = Array.isArray(context.pickedAxes) ? context.pickedAxes.map(lower) : [];
  const pickedDiszisNow = Array.isArray(context.pickedDisciplines) ? context.pickedDisciplines.map(lower) : [];
  const plannerVariant = s(planRes?.plan?.strategyVariant || '');
  const focusVariant = s(planRes?.plan?.focusVariantMode || '');
  const strategy = s(context.plannerStrategy || plannerStrategy || '');
  const architecture = s(context.architecture || plannerSpendArchitecture || '');
  const identityMeta = getTeamIdentityMeta06();

  let identityMult = 1.00;
  let disciplineMult = 1.00;
  let plannedMult = 0.22;

  if (plannerVariant.includes('identity') || focusVariant === 'identity_first') identityMult += 0.22;
  if (focusVariant === 'discipline_probe') disciplineMult += 0.24;
  if (focusVariant === 'value_opportunist' || plannerVariant === 'best_value_mix') plannedMult += 0.16;
  if (architecture === 'value_depth_fill' && identityMeta.topShare >= 0.35) identityMult += 0.08;
  if (identityMeta.topShare >= 0.75) {
    identityMult += 0.55;
    disciplineMult *= 0.62;
    plannedMult *= 0.72;
  }
  if (strategy === 'cash_creators') plannedMult += 0.05;

  const maxNeedWeight = Math.max(
    ...identityAxisNeeds.map((x) => n(x.weight, 0)),
    ...disciplineNeeds.map((x) => n(x.weight, 0)),
    0.01
  );

  const axisRepeatFactor = (axis) => {
    const ax = lower(axis);
    const count = pickedAxesNow.filter((x) => x === ax).length;
    const isTop = ax && ax === identityMeta.topAxis;
    const protectedTopCount = isTop && identityMeta.topShare >= 0.35 ? 2 : 1;
    if (count <= 0) return 1.08;
    if (isTop && count < protectedTopCount) return 1.0;
    return Math.max(0.35, 1 - count * 0.20);
  };

  const disziRepeatFactor = (diszi) => {
    const dz = lower(diszi);
    const count = pickedDiszisNow.filter((x) => x === dz).length;
    return Math.max(0.30, 1 - count * 0.35);
  };

  const options = [];

  identityAxisNeeds.slice(0, 4).forEach((nd, idx) => {
    const axis = lower(nd.axis);
    const rankDecay = Math.max(0.62, 1 - idx * 0.13);
    const topIdentityBoost = axis === identityMeta.topAxis && identityMeta.topShare >= 0.34 ? 1.12 : 1.0;
    options.push({
      focusType: 'identity_weighted',
      focusKey: axis,
      source: 'seeded_needs.identity',
      needId: nd.id,
      weight: Math.max(0, nd.weight) * identityMult * rankDecay * topIdentityBoost * axisRepeatFactor(axis),
      debugKind: 'identity',
      rawWeight: nd.weight
    });
  });

  disciplineNeeds.slice(0, 6).forEach((nd, idx) => {
    const rankDecay = Math.max(0.55, 1 - idx * 0.10);
    const axis = lower(nd.axis || axisForDiszi(nd.diszi));
    options.push({
      focusType: 'discipline',
      focusKey: nd.diszi,
      source: 'seeded_needs.discipline',
      needId: nd.id,
      weight: Math.max(0, nd.weight) * disciplineMult * rankDecay * axisRepeatFactor(axis) * disziRepeatFactor(nd.diszi),
      debugKind: 'discipline',
      rawWeight: nd.weight
    });
  });

  const plannedType = s(plannedFallback?.focusType || '');
  const plannedKey = s(plannedFallback?.focusKey || '');
  if (plannedType && plannedKey) {
    const plannedAxis = plannedType === 'discipline' ? axisForDiszi(plannedKey) : plannedKey;
    options.push({
      focusType: plannedType,
      focusKey: plannedKey,
      source: 'seeded_needs.planned_fallback',
      needId: '',
      weight: maxNeedWeight * plannedMult * axisRepeatFactor(plannedAxis),
      debugKind: 'planned',
      rawWeight: maxNeedWeight * plannedMult
    });
  }

  const scored = options
    .map((o) => ({ ...o, weight: Math.max(0, n(o.weight, 0)) }))
    .filter((o) => o.focusType && o.focusKey && o.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  if (!scored.length) {
    return {
      focusType: topIdentity ? 'identity_weighted' : 'discipline',
      focusKey: topIdentity ? topIdentity.axis : topDiszi.diszi,
      source: topIdentity ? 'needs.identity_only' : 'needs.discipline_only',
      needId: topIdentity ? topIdentity.id : topDiszi.id,
      seeded_need_choice: false
    };
  }

  const best = scored[0];
  const second = scored[1] || null;

  // If one need is wildly ahead, keep mostly deterministic behaviour, but still allow a small controlled upset.
  const dominance = second ? best.weight / Math.max(0.001, second.weight) : 999;
  const minBand = dominance >= 1.85 ? 0.64 : dominance >= 1.45 ? 0.52 : 0.40;
  const pool = scored.filter((o) => o.weight >= best.weight * minBand).slice(0, 6);

  const selected = pickWeightedSeeded06(
    pool,
    `needsChoice|${team}|${stepIdxNow}|${activeTargetNow}|${plannerVariant}|${focusVariant}|${pickedAxesNow.join('-')}|${pickedDiszisNow.join('-')}|${plannedType}:${plannedKey}`,
    best
  ) || best;

  return {
    focusType: selected.focusType,
    focusKey: selected.focusKey,
    source: selected.source + `:${selected.debugKind}:pool${pool.length}`,
    needId: selected.needId || '',
    seeded_need_choice: true,
    seeded_need_pool_size: pool.length,
    seeded_need_best: `${best.focusType}:${best.focusKey}:${Number(best.weight.toFixed(3))}`,
    seeded_need_selected_weight: Number(n(selected.weight, 0).toFixed(3))
  };
};

const buildNeedsQaMeta = (needsRows, needsRes, simRoster, pickedAxes, pickedDisciplines) => {
  const needs = Array.isArray(needsRows) ? needsRows : [];

  const topIdentity2 = needs
    .filter((x) => s(x?.category) === 'identity' && s(x?.meta?.kind) === 'axis')
    .slice(0, 2)
    .map((x) => ({
      axis: lower(x?.meta?.axis || ''),
      weight: Number(n(x?.weight, 0).toFixed(3)),
      score: n(x?.meta?.score?.importance100, 0),
      rosterSat01: Number(n(x?.meta?.debug?.organicSaturation?.rosterSat01, 0).toFixed(3)),
      biasEffective01: Number(n(x?.meta?.debug?.organicSaturation?.biasEffective01, 0).toFixed(3)),
      qHi: Number(n(x?.meta?.debug?.organicSaturation?.qHi, 0).toFixed(2))
    }));

  const disziSeen = new Set();
  const topDiszi2 = [];

  for (const x of needs) {
    if (s(x?.category) !== 'discipline') continue;

    const dz = lower(x?.meta?.diszi || '');
    if (!dz || disziSeen.has(dz)) continue;

    disziSeen.add(dz);

    topDiszi2.push({
      diszi: dz,
      subKind: s(x?.meta?.subKind || ''),
      axis: lower(x?.meta?.axis || axisForDiszi(dz)),
      weight: Number(n(x?.weight, 0).toFixed(3)),
      score: n(x?.meta?.score?.importance100, 0)
    });

    if (topDiszi2.length >= 2) break;
  }

  const topIdentity = topIdentity2[0] || null;
  const topDiszi = topDiszi2[0] || null;

  return {
    computedOn: s(needsRes?.debug?.notes?.find?.((x) => String(x || '').includes('computedOn=')) || ''),
    rosterSize: simRoster.length,
    totalNeeds: n(needsRes?.needs?.length, 0),
    topIdentity2,
    topDiszi2,
    topCompare: {
      identityAxis: topIdentity?.axis || '',
      identityWeight: topIdentity?.weight ?? 0,
      diszi: topDiszi?.diszi || '',
      disziWeight: topDiszi?.weight ?? 0,
      deltaIdentityMinusDiszi: Number(
        n((topIdentity?.weight ?? 0) - (topDiszi?.weight ?? 0), 0).toFixed(3)
      )
    },
    pickedAxes: [...pickedAxes],
    pickedDisciplines: [...pickedDisciplines],
    pickedAxisCounts: pickedAxes.reduce((acc, ax) => {
      const k = lower(ax);
      if (k) acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {}),
    pickedDisziCounts: pickedDisciplines.reduce((acc, dz) => {
      const k = lower(dz);
      if (k) acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {})
  };
};

let aiRunVal = 0;

try {
  aiRunVal = aiSearchRunId?.value;
} catch (e) {
  aiRunVal = 0;
}

const simSeed = Date.now() + '|team=' + team + '|run=' + n(aiRunVal);

let ctx = null;

try {
  ctx = await AI2_02_Context.trigger({ additionalScope: { simSeedInput: simSeed } });
} catch (e) {
  ctx = null;
}

if (!ctx?.ok) {
  return {
    ok: false,
    version: VERSION,
    team,
    simSeed,
    plannedSteps: 0,
    activeTarget: 0,
    activeBuys: 0,
    skippedRows: 0,
    planned_picks: [],
    needs_timeline: [],
    debug: { notes: ['AI2_02_Context not ok'] }
  };
}

const rosterNow = n(ctx?.roster?.countNow);
const minPlayers = n(ctx?.roster?.minPlayers);
const targetPlayers = n(ctx?.roster?.targetPlayers);
const plannedStepsFallback = clamp(Math.round(targetPlayers - rosterNow), 0, 30);

let budgetStart = n(getCashFromSaisonstand.value?.cash);
let budgetStartSource = 'cash';

try {
  const b = transfermarktSalaryBudgetLogic.value;

  if (b && typeof b === 'object') {
    const allowed = n(b.allowed_budget_for_search);

    if (allowed > 0) {
      budgetStart = allowed;
      budgetStartSource = 'transfermarktSalaryBudgetLogic';
    }
  }
} catch (e) {}

budgetStart = Math.max(0, budgetStart);

let planRes = null;

try {
  planRes = await AI2_04_Planner.trigger({ additionalScope: { simSeedInput: simSeed } });
} catch (e) {
  planRes = null;
}

let plannedSteps = plannedStepsFallback;
let stepPlan = [];
const plannerStrategy = s(planRes?.plan?.teamStrategy || planRes?.plan?.effectiveManagerStyle || '');
const plannerBudgetMax = n(planRes?.plan?.budgetMax, 0);
const plannerBudgetBase = n(planRes?.plan?.budgetBase, budgetStart);
const plannerMinCashBuffer = n(planRes?.plan?.minCashBuffer, 0);
const plannerSavingsBias01 = n(planRes?.plan?.savingsBias01, 0);
const plannerContractLockRisk01 = n(planRes?.plan?.contractLockRisk01, 0);
const plannerAttackPressure01 = n(planRes?.plan?.attackPressure01, 0);
const plannerThroughPowerBias01 = n(planRes?.plan?.throughPowerBias01, 0);
const plannerMultiYearSalaryRisk01 = n(planRes?.plan?.multiYearSalaryRisk01, 0);
const plannerFinancePressure01 = n(planRes?.plan?.financePressure01, 0);
const plannerSalaryCoverageRatio = n(planRes?.plan?.salaryPlanning?.salaryCoverageRatio, 1);
const plannerProjectedSalaryBase = n(planRes?.plan?.salaryPlanning?.projectedSalaryBase, 0);
const plannerSpendArchitecture = s(planRes?.plan?.spendArchitecture || planRes?.plan?.spend_architecture || '');
const plannerPremiumSlots = n(planRes?.plan?.premiumSlots ?? planRes?.plan?.premium_slots, 0);
const plannerCoreSlots = n(planRes?.plan?.coreSlots ?? planRes?.plan?.core_slots, 0);
const plannerFillSlots = n(planRes?.plan?.fillSlots ?? planRes?.plan?.fill_slots, 0);

if (planRes?.ok) {
  const plannedFromPlan = n(planRes?.plan?.targetBuyCount);

  if (plannedFromPlan > 0) plannedSteps = plannedFromPlan;

  if (!(plannedSteps > 0) && Array.isArray(planRes?.steps) && planRes.steps.length) {
    plannedSteps = planRes.steps.length;
  }

  if (Array.isArray(planRes?.steps) && planRes.steps.length) {
    stepPlan = planRes.steps.slice(0, plannedSteps).map((st) => ({
      importance: s(st?.importance || 'depth'),
      reason: s(st?.reason || ''),
      focusType: s(st?.focusType || ''),
      focusKey: s(st?.focusKey || '')
    }));
  }
}

plannedSteps = clamp(Math.round(plannedSteps), 0, 30);
const activeTarget = plannedSteps;

if (!(plannedSteps > 0)) {
  return {
    ok: true,
    version: VERSION,
    team,
    simSeed,
    plannedSteps: 0,
    activeTarget: 0,
    activeBuys: 0,
    skippedRows: 0,
    planned_picks: [],
    needs_timeline: [],
    debug: {
      notes: [
        'plannedSteps resolved to 0',
        'fallback=' + plannedStepsFallback,
        'rosterNow=' + rosterNow,
        'targetPlayers=' + targetPlayers
      ]
    }
  };
}

if (!stepPlan.length) {
  const fallbackRoles = [
    'core',
    'depth',
    'depth',
    'reserve',
    'reserve',
    'reserve',
    'reserve',
    'reserve',
    'reserve',
    'reserve',
    'reserve',
    'reserve'
  ];

  stepPlan = [];

  for (let fi = 0; fi < plannedSteps; fi++) {
    stepPlan.push({
      importance: fallbackRoles[fi] || 'reserve',
      reason: 'fallback',
      focusType: 'roster_fill',
      focusKey: 'fill'
    });
  }
}

const simRoster = Array.isArray(getActivePlayersByTeam.data)
  ? [...getActivePlayersByTeam.data]
  : typeof formatDataAsArray === 'function'
  ? formatDataAsArray(getActivePlayersByTeam.data) || []
  : [];

const pickedNames = [];
const pickedSet = new Set();
const skippedCandidateNames = new Set();

let remainingBudget = Number(budgetStart.toFixed(2));

const planned_picks = [];
const needs_timeline = [];
const notes = [];

const pickedDisciplines = [];
const pickedAxes = [];

let skipCredit = 0;

const activePickCount06 = (rows) =>
  (Array.isArray(rows) ? rows : []).filter((x) => x?.player_name && x?.skip !== true).length;

const skipPickCount06 = (rows) =>
  (Array.isArray(rows) ? rows : []).filter((x) => x?.skip === true).length;

const coerceRows06 = (data) => {
  try {
    if (Array.isArray(data)) return data;
    if (typeof formatDataAsArray === 'function') {
      const rows = formatDataAsArray(data || []);
      if (Array.isArray(rows)) return rows;
    }
  } catch (e) {}

  return [];
};

const candidatePool06 = () => {
  try {
    if (typeof aiTransferCandidatePool !== 'undefined') {
      return coerceRows06(aiTransferCandidatePool.value);
    }
  } catch (e) {}

  return [];
};

const candidateNameKey06 = (row) =>
  lower(s(row?.player_name || row?.name || row?.Name || ''));

const candidatePrice06 = (row) =>
  n(row?.price ?? row?.marktwert ?? row?.mw ?? row?.MW, 0);

const affordableCandidateSummary06 = (budget) => {
  const b = n(budget, 0);

  const candidates = candidatePool06()
    .map((row) => ({
      row,
      nameKey: candidateNameKey06(row),
      name: s(row?.player_name || row?.name || row?.Name || ''),
      price: candidatePrice06(row)
    }))
    .filter((x) =>
      x.nameKey &&
      x.price > 0 &&
      !pickedSet.has(x.nameKey) &&
      !skippedCandidateNames.has(x.nameKey)
    )
    .sort((a, b) => a.price - b.price);

  const affordable = candidates.filter((x) => x.price <= b);

  return {
    totalRemaining: candidates.length,
    affordableCount: affordable.length,
    minRemainingPrice: candidates[0]?.price ?? null,
    cheapestRemaining: candidates.slice(0, 5).map((x) => ({
      name: x.name,
      price: Number(x.price.toFixed(2))
    })),
    cheapestAffordable: affordable.slice(0, 5).map((x) => ({
      name: x.name,
      price: Number(x.price.toFixed(2))
    }))
  };
};

if (!AI2_07_PickScoreEngine || typeof AI2_07_PickScoreEngine.trigger !== 'function') {
  return {
    ok: false,
    version: VERSION,
    team,
    simSeed,
    plannedSteps,
    planned_picks: [],
    needs_timeline,
    debug: { notes: ['AI2_07_PickScoreEngine not available'] }
  };
}

let attempts = 0;
const maxAttempts = Math.max(activeTarget * 5, plannedSteps + 8);
const skipStreakByActiveStep = {};
const MAX_SKIPS_PER_ACTIVE_SLOT = 8;

while (activePickCount06(planned_picks) < activeTarget && attempts < maxAttempts) {
  attempts += 1;

  const stepIdx = activePickCount06(planned_picks);
  const baseRole = normalizeRole(s(stepPlan[stepIdx]?.importance || 'depth'));
  const plannedFocusType = s(stepPlan[stepIdx]?.focusType || '');
  const plannedFocusKey = s(stepPlan[stepIdx]?.focusKey || '');

  const remainingSlotsInclCurrent = Math.max(1, activeTarget - activePickCount06(planned_picks));
  const avgRemainingBudget = remainingBudget / remainingSlotsInclCurrent;

  const spentSoFar = Math.max(0, budgetStart - remainingBudget);
  const plannerRemainingSoftBudget =
    plannerBudgetMax > 0 ? Math.max(0, plannerBudgetMax - spentSoFar) : remainingBudget;
  const plannerSoftSlotBudget = plannerRemainingSoftBudget / remainingSlotsInclCurrent;

  const spendArchitectureUsed =
    plannerSpendArchitecture ||
    inferSpendArchitecture06(
      plannerStrategy,
      activeTarget,
      plannerAttackPressure01,
      plannerSavingsBias01,
      plannerBudgetMax || budgetStart,
      budgetStart
    );

  const impactSlotsUsed = plannerPremiumSlots > 0
    ? plannerPremiumSlots
    : plannedImpactSlots06(spendArchitectureUsed, activeTarget, plannerAttackPressure01, budgetStart);

  const isImpactSlot = isImpactSlotForArchitecture06(spendArchitectureUsed, stepIdx, activeTarget, impactSlotsUsed);
  const mandatoryLeft = Math.max(0, minPlayers - simRoster.length);

  let upgradeSteps = 0;

  if (skipCredit > 0 && avgRemainingBudget >= 24 && isImpactSlot) {
    upgradeSteps = 1;
  }

  if (skipCredit >= 2 && avgRemainingBudget >= 34 && plannerStrategy !== 'cash_creators' && isImpactSlot) {
    upgradeSteps = 2;
  }

  if (plannerStrategy === 'cash_creators') {
    upgradeSteps = Math.min(upgradeSteps, 0);
  }

  const rawPlannedRole = upgradeRole(
    baseRole,
    upgradeSteps,
    plannerStrategy === 'cash_creators' ? 'core' : 'star'
  );

  const identityMetaForRole06 = getTeamIdentityMeta06();
  const extremeIdentityRoleGuard06 = identityMetaForRole06.topShare >= 0.75 && stepIdx === 0;

  const roleBudgetPlan06 = compressRoleForBudget06({
    baseRole,
    upgradedRole: rawPlannedRole,
    avgRemainingBudget,
    plannerSoftSlotBudget,
    plannerStrategy,
    architecture: spendArchitectureUsed,
    isImpactSlot,
    mandatoryLeft,
    remainingSlotsInclCurrent,
    attackPressure01: plannerAttackPressure01,
    savingsBias01: plannerSavingsBias01
  });

  let plannedRole = roleBudgetPlan06.plannedRole;
  let maxLaneForSlot = roleBudgetPlan06.maxLaneForSlot;

  if (extremeIdentityRoleGuard06 && roleIndex(plannedRole) < roleIndex('depth')) {
    plannedRole = 'depth';
    maxLaneForSlot = maxRole06(maxLaneForSlot, 'depth');
    roleBudgetPlan06.plannedRole = plannedRole;
    roleBudgetPlan06.maxLaneForSlot = maxLaneForSlot;
    roleBudgetPlan06.roleCompressed = normalizeRole(plannedRole) !== normalizeRole(rawPlannedRole);
    roleBudgetPlan06.compressionReason = String(roleBudgetPlan06.compressionReason || '') + '|extreme_identity_depth_guard';
  }

  const desiredCardColors = desiredCardColorsForTeam06();

  // v15.6.3: Card utility is a rare fallback mode, not a normal filler strategy.
  // It should only help true reserve/late-backup players when the remaining budget is too tight
  // for real impact picks, and only if the player is genuinely cheap in fee AND salary.
  const lateFillSlot = !isImpactSlot && activePickCount06(planned_picks) >= impactSlotsUsed;
  const currentRosterAfterBought = rosterNow + activePickCount06(planned_picks);
  const minPlayersTarget06 = n(ctx?.roster?.minPlayers, 0);
  const minRosterAlreadySafe06 = minPlayersTarget06 > 0 && currentRosterAfterBought >= minPlayersTarget06;
  const plannerBufferPressure06 = plannerMinCashBuffer > 0 && remainingBudget <= plannerMinCashBuffer + 22;
  const trulyTightSlotBudget06 = avgRemainingBudget <= 16.8 || plannerSoftSlotBudget <= 16.8;
  const noRealImpactBudget06 = trulyTightSlotBudget06 || (minRosterAlreadySafe06 && plannerBufferPressure06);
  const roleIsUtilityEligible =
    plannedRole === 'reserve' ||
    (plannedRole === 'backup' && remainingSlotsInclCurrent <= 2 && avgRemainingBudget <= 18.5);

  const cardUtilityMode =
    lateFillSlot &&
    roleIsUtilityEligible &&
    noRealImpactBudget06;

  // Hard/strict by design: 20m players with 5-6m salary are NOT utility filler.
  const cardUtilityStrict = cardUtilityMode;
  const cardUtilityCheapMaxPrice = cardUtilityMode ? 15.8 : 0;
  const cardUtilityCheapMaxSalary = cardUtilityMode ? 3.8 : 0;

  if (n(skipStreakByActiveStep[stepIdx], 0) >= MAX_SKIPS_PER_ACTIVE_SLOT) {
    const stopReason = 'quality_budget_exhausted';

    notes.push(
      'stop: ' +
        stopReason +
        ' at active step ' +
        (stepIdx + 1) +
        ' after ' +
        n(skipStreakByActiveStep[stepIdx], 0) +
        ' skipped candidates remainingBudget=' +
        remainingBudget.toFixed(2)
    );

    planned_picks.push({
      stepIndex: stepIdx,
      pick_nr: planned_picks.length + 1,
      importance: plannedRole,
      base_importance: baseRole,
      role_upgrade_steps: upgradeSteps,
      focusType: plannedFocusType,
      focusKey: plannedFocusKey,
      planned_focusType: plannedFocusType,
      planned_focusKey: plannedFocusKey,
      dynamic_focus_source: 'stop.skip_spam_guard',
      dynamic_focus_needId: '',
      slot_role_used: plannedRole,
      slot_role_fallback_used: upgradeSteps > 0,
      raw_planned_role: rawPlannedRole,
      max_lane_for_slot: maxLaneForSlot,
      effective_max_lane_for_pick: typeof effectiveMaxLaneForPick !== 'undefined' ? effectiveMaxLaneForPick : maxLaneForSlot,
      lane_relaxed: typeof laneRelaxed !== 'undefined' ? laneRelaxed === true : false,
      lane_relax_reason: typeof laneRelaxReason !== 'undefined' ? laneRelaxReason : '',
      spend_architecture_used: spendArchitectureUsed,
      impact_slots_used: impactSlotsUsed,
      is_impact_slot: isImpactSlot,
      role_budget_cap: roleBudgetPlan06?.budgetCapRole || '',
      role_compression_reason: roleBudgetPlan06?.compressionReason || '',
      role_compressed: roleBudgetPlan06?.roleCompressed === true,
      card_utility_mode: cardUtilityMode,
      desired_card_colors: desiredCardColors,
      card_utility_strict: cardUtilityStrict,
      market_role: '',
      player_name: '',
      klasse: '',
      class_color: '',
      price: 0,
      budget_after: Number(remainingBudget.toFixed(2)),
      roster_size_after: simRoster.length,
      fit: 0,
      score: 0,
      skip: true,
      skipped: true,
      skip_recommended: true,
      quality_gate_ok: false,
      skip_reason: stopReason,
      rationale:
        stopReason +
        ' · too many skipped candidates for same active slot · remainingBudget=' +
        remainingBudget.toFixed(2) +
        ' · skipStreak=' +
        n(skipStreakByActiveStep[stepIdx], 0),
      error_reason: stopReason,
      error_message: '',
      score_breakdown_text: 'STOP'
    });

    break;
  }

  try {
    globalThis.pickedDisciplinesInput = [...pickedDisciplines];
  } catch (e) {}

  try {
    globalThis.pickedAxesInput = [...pickedAxes];
  } catch (e) {}

  try {
    globalThis.simRosterForNeedsInput = [...simRoster];
  } catch (e) {}

  let needsRes = null;
  let needsSnapshot = null;

  try {
    needsRes = await AI2_03_Needs.trigger();

    if (needsRes?.ok && Array.isArray(needsRes?.needs)) {
      const topNeeds = needsRes.needs.slice(0, 10).map((nd) => ({
        id: s(nd?.id || ''),
        category: s(nd?.category || ''),
        weight: Number(n(nd?.weight, 0).toFixed(3)),
        meta: nd?.meta || {}
      }));

      needsSnapshot = {
        stepIndex: stepIdx,
        topNeeds,
        meta: buildNeedsQaMeta(needsRes.needs, needsRes, simRoster, pickedAxes, pickedDisciplines)
      };
    }
  } catch (e) {
    needsSnapshot = {
      stepIndex: stepIdx,
      topNeeds: [],
      meta: {
        computedOn: 'error',
        error: String(e?.message || e),
        rosterSize: simRoster.length,
        pickedAxes: [...pickedAxes],
        pickedDisciplines: [...pickedDisciplines]
      }
    };
  }

  if (needsSnapshot) needs_timeline.push(needsSnapshot);

  const dyn = pickDynamicFocusFromNeeds(
    needsRes?.needs,
    {
      focusType: plannedFocusType,
      focusKey: plannedFocusKey
    },
    {
      pickedAxes,
      pickedDisciplines,
      stepIdx,
      activeTarget,
      plannedRole,
      baseRole,
      architecture: spendArchitectureUsed,
      plannerStrategy
    }
  );

  const focusType = s(dyn?.focusType || plannedFocusType || 'identity_weighted');
  const focusKey = s(dyn?.focusKey || plannedFocusKey || 'pow');

  const affordable06 = affordableCandidateSummary06(remainingBudget);

  if (!(remainingBudget > 0.01) || affordable06.affordableCount <= 0) {
    const stopReason =
      !(remainingBudget > 0.01)
        ? 'budget_exhausted'
        : 'no_affordable_candidate';

    notes.push(
      'stop: ' +
        stopReason +
        ' at active step ' +
        (stepIdx + 1) +
        ' remainingBudget=' +
        remainingBudget.toFixed(2) +
        ' minRemainingPrice=' +
        (affordable06.minRemainingPrice == null
          ? 'none'
          : Number(affordable06.minRemainingPrice).toFixed(2))
    );

    planned_picks.push({
      stepIndex: stepIdx,
      pick_nr: planned_picks.length + 1,
      importance: plannedRole,
      base_importance: baseRole,
      role_upgrade_steps: upgradeSteps,
      focusType,
      focusKey,
      planned_focusType: plannedFocusType,
      planned_focusKey: plannedFocusKey,
      dynamic_focus_source: s(dyn?.source || ''),
      dynamic_focus_needId: s(dyn?.needId || ''),
      slot_role_used: plannedRole,
      slot_role_fallback_used: upgradeSteps > 0,
      raw_planned_role: rawPlannedRole,
      max_lane_for_slot: maxLaneForSlot,
      effective_max_lane_for_pick: typeof effectiveMaxLaneForPick !== 'undefined' ? effectiveMaxLaneForPick : maxLaneForSlot,
      lane_relaxed: typeof laneRelaxed !== 'undefined' ? laneRelaxed === true : false,
      lane_relax_reason: typeof laneRelaxReason !== 'undefined' ? laneRelaxReason : '',
      spend_architecture_used: spendArchitectureUsed,
      impact_slots_used: impactSlotsUsed,
      is_impact_slot: isImpactSlot,
      role_budget_cap: roleBudgetPlan06?.budgetCapRole || '',
      role_compression_reason: roleBudgetPlan06?.compressionReason || '',
      role_compressed: roleBudgetPlan06?.roleCompressed === true,
      card_utility_mode: cardUtilityMode,
      desired_card_colors: desiredCardColors,
      card_utility_strict: cardUtilityStrict,
      market_role: '',
      player_name: '',
      klasse: '',
      class_color: '',
      price: 0,
      budget_after: Number(remainingBudget.toFixed(2)),
      roster_size_after: simRoster.length,
      fit: 0,
      score: 0,
      skip: true,
      skipped: true,
      skip_recommended: true,
      quality_gate_ok: false,
      skip_reason: stopReason,
      rationale:
        stopReason +
        ' · remainingBudget=' +
        remainingBudget.toFixed(2) +
        ' · minRemainingPrice=' +
        (affordable06.minRemainingPrice == null
          ? 'none'
          : Number(affordable06.minRemainingPrice).toFixed(2)),
      error_reason: stopReason,
      error_message: '',
      score_breakdown_text: 'STOP',
      affordable_candidate_count: affordable06.affordableCount,
      remaining_candidate_count: affordable06.totalRemaining,
      min_remaining_candidate_price: affordable06.minRemainingPrice,
      cheapest_remaining_candidates: affordable06.cheapestRemaining,
      cheapest_affordable_candidates: affordable06.cheapestAffordable
    });

    break;
  }

  let scoreRes = null;

  try {
    scoreRes = await AI2_07_PickScoreEngine.trigger({
      additionalScope: {
        simRosterInput: simRoster,
        pickedNamesInput: pickedNames,
        remainingBudgetInput: remainingBudget,
        stepIdxInput: stepIdx,
        plannedRoleInput: plannedRole,
        focusTypeInput: focusType,
        focusKeyInput: focusKey,
        pickedCountInput: pickedNames.length,
        simSeedInput: simSeed,
        pickedDisciplinesInput: pickedDisciplines,
        pickedAxesInput: pickedAxes,
        plannerStrategyInput: plannerStrategy,
        activeTargetInput: activeTarget,
        activeBuysSoFarInput: activePickCount06(planned_picks),
        plannerBudgetMaxInput: plannerBudgetMax,
        plannerRemainingSoftBudgetInput: plannerRemainingSoftBudget,
        plannerSoftSlotBudgetInput: plannerSoftSlotBudget,
        plannerBudgetBaseInput: plannerBudgetBase,
        plannerSavingsBiasInput: plannerSavingsBias01,
        plannerContractLockRiskInput: plannerContractLockRisk01,
        plannerAttackPressureInput: plannerAttackPressure01,
        plannerThroughPowerBiasInput: plannerThroughPowerBias01,
        plannerMultiYearSalaryRiskInput: plannerMultiYearSalaryRisk01,
        plannerFinancePressureInput: plannerFinancePressure01,
        plannerSalaryCoverageRatioInput: plannerSalaryCoverageRatio,
        plannerProjectedSalaryBaseInput: plannerProjectedSalaryBase,
        plannerSpendArchitectureInput: spendArchitectureUsed,
        impactSlotsUsedInput: impactSlotsUsed,
        maxLaneForSlotInput: maxLaneForSlot,
        roleBudgetCapInput: roleBudgetPlan06.budgetCapRole,
        roleCompressionReasonInput: roleBudgetPlan06.compressionReason,
        cardUtilityModeInput: cardUtilityMode,
        desiredCardColorsInput: desiredCardColors,
        cardUtilityCheapMaxPriceInput: cardUtilityCheapMaxPrice,
        cardUtilityCheapMaxSalaryInput: cardUtilityCheapMaxSalary,
        cardUtilityStrictInput: cardUtilityStrict
      }
    });
  } catch (e) {
    planned_picks.push({
      stepIndex: stepIdx,
      pick_nr: planned_picks.length + 1,
      importance: plannedRole,
      base_importance: baseRole,
      role_upgrade_steps: upgradeSteps,
      focusType,
      focusKey,
      planned_focusType: plannedFocusType,
      planned_focusKey: plannedFocusKey,
      dynamic_focus_source: s(dyn?.source || ''),
      dynamic_focus_needId: s(dyn?.needId || ''),
      slot_role_used: plannedRole,
      slot_role_fallback_used: upgradeSteps > 0,
      raw_planned_role: rawPlannedRole,
      max_lane_for_slot: maxLaneForSlot,
      effective_max_lane_for_pick: typeof effectiveMaxLaneForPick !== 'undefined' ? effectiveMaxLaneForPick : maxLaneForSlot,
      lane_relaxed: typeof laneRelaxed !== 'undefined' ? laneRelaxed === true : false,
      lane_relax_reason: typeof laneRelaxReason !== 'undefined' ? laneRelaxReason : '',
      spend_architecture_used: spendArchitectureUsed,
      impact_slots_used: impactSlotsUsed,
      is_impact_slot: isImpactSlot,
      role_budget_cap: roleBudgetPlan06?.budgetCapRole || '',
      role_compression_reason: roleBudgetPlan06?.compressionReason || '',
      role_compressed: roleBudgetPlan06?.roleCompressed === true,
      card_utility_mode: cardUtilityMode,
      desired_card_colors: desiredCardColors,
      card_utility_strict: cardUtilityStrict,
      market_role: '',
      player_name: '',
      klasse: '',
      class_color: '',
      price: 0,
      budget_after: Number(remainingBudget.toFixed(2)),
      roster_size_after: simRoster.length,
      fit: 0,
      score: 0,
      skip: true,
      skipped: true,
      skip_recommended: true,
      skip_reason: 'pick_engine_threw',
      rationale: 'PickScoreEngine threw: ' + String(e?.message || e),
      error_reason: 'pick_engine_threw',
      error_message: String(e?.message || e),
      score_breakdown_text: 'FAILED'
    });

    break;
  }

  if (!scoreRes?.ok) {
    planned_picks.push({
      stepIndex: stepIdx,
      pick_nr: planned_picks.length + 1,
      importance: plannedRole,
      base_importance: baseRole,
      role_upgrade_steps: upgradeSteps,
      focusType,
      focusKey,
      planned_focusType: plannedFocusType,
      planned_focusKey: plannedFocusKey,
      dynamic_focus_source: s(dyn?.source || ''),
      dynamic_focus_needId: s(dyn?.needId || ''),
      slot_role_used: plannedRole,
      slot_role_fallback_used: upgradeSteps > 0,
      raw_planned_role: rawPlannedRole,
      max_lane_for_slot: maxLaneForSlot,
      effective_max_lane_for_pick: typeof effectiveMaxLaneForPick !== 'undefined' ? effectiveMaxLaneForPick : maxLaneForSlot,
      lane_relaxed: typeof laneRelaxed !== 'undefined' ? laneRelaxed === true : false,
      lane_relax_reason: typeof laneRelaxReason !== 'undefined' ? laneRelaxReason : '',
      spend_architecture_used: spendArchitectureUsed,
      impact_slots_used: impactSlotsUsed,
      is_impact_slot: isImpactSlot,
      role_budget_cap: roleBudgetPlan06?.budgetCapRole || '',
      role_compression_reason: roleBudgetPlan06?.compressionReason || '',
      role_compressed: roleBudgetPlan06?.roleCompressed === true,
      card_utility_mode: cardUtilityMode,
      desired_card_colors: desiredCardColors,
      card_utility_strict: cardUtilityStrict,
      market_role: '',
      player_name: '',
      klasse: '',
      class_color: '',
      price: 0,
      budget_after: Number(remainingBudget.toFixed(2)),
      roster_size_after: simRoster.length,
      fit: 0,
      score: 0,
      skip: true,
      skipped: true,
      skip_recommended: true,
      skip_reason: s(scoreRes?.reason || 'pick_engine_failed'),
      rationale: 'PickScoreEngine failed',
      error_reason: s(scoreRes?.reason || 'pick_engine_failed'),
      error_message: '',
      score_breakdown_text: 'FAILED'
    });

    break;
  }

  const ranked = Array.isArray(scoreRes?.ranked_top_50) ? scoreRes.ranked_top_50 : [];

  if (!ranked.length) {
    planned_picks.push({
      stepIndex: stepIdx,
      pick_nr: planned_picks.length + 1,
      importance: plannedRole,
      base_importance: baseRole,
      role_upgrade_steps: upgradeSteps,
      focusType,
      focusKey,
      planned_focusType: plannedFocusType,
      planned_focusKey: plannedFocusKey,
      dynamic_focus_source: s(dyn?.source || ''),
      dynamic_focus_needId: s(dyn?.needId || ''),
      slot_role_used: plannedRole,
      slot_role_fallback_used: upgradeSteps > 0,
      raw_planned_role: rawPlannedRole,
      max_lane_for_slot: maxLaneForSlot,
      effective_max_lane_for_pick: typeof effectiveMaxLaneForPick !== 'undefined' ? effectiveMaxLaneForPick : maxLaneForSlot,
      lane_relaxed: typeof laneRelaxed !== 'undefined' ? laneRelaxed === true : false,
      lane_relax_reason: typeof laneRelaxReason !== 'undefined' ? laneRelaxReason : '',
      spend_architecture_used: spendArchitectureUsed,
      impact_slots_used: impactSlotsUsed,
      is_impact_slot: isImpactSlot,
      role_budget_cap: roleBudgetPlan06?.budgetCapRole || '',
      role_compression_reason: roleBudgetPlan06?.compressionReason || '',
      role_compressed: roleBudgetPlan06?.roleCompressed === true,
      card_utility_mode: cardUtilityMode,
      desired_card_colors: desiredCardColors,
      card_utility_strict: cardUtilityStrict,
      market_role: '',
      player_name: '',
      klasse: '',
      class_color: '',
      price: 0,
      budget_after: Number(remainingBudget.toFixed(2)),
      roster_size_after: simRoster.length,
      fit: 0,
      score: 0,
      skip: true,
      skipped: true,
      skip_recommended: true,
      skip_reason: 'empty_ranked_candidates',
      rationale: 'ranked_top_50 is empty',
      error_reason: 'empty_ranked_candidates',
      error_message: '',
      score_breakdown_text: 'FAILED'
    });

    break;
  }

  const pickedNow = new Set(
    pickedNames.map((x) => String(x || '').toLowerCase().trim()).filter(Boolean)
  );

  const isUsableCandidate06 = (c) => {
    const nm = String(c?.player_name || c?.name || '').toLowerCase().trim();
    const price = n(c?.price);

    return (
      nm &&
      !pickedNow.has(nm) &&
      !skippedCandidateNames.has(nm) &&
      price > 0 &&
      price <= remainingBudget
    );
  };

  const isLaneUsableCandidate06 = (c, laneCap = maxLaneForSlot) =>
    isUsableCandidate06(c) && laneOkForSlot06(c, laneCap, 0);

  let chosen =
    isLaneUsableCandidate06(scoreRes?.chosen_pick, maxLaneForSlot)
      ? scoreRes.chosen_pick
      : ranked.find((c) => isLaneUsableCandidate06(c, maxLaneForSlot)) || null;

  let laneRelaxed = false;
  let laneRelaxReason = '';
  let effectiveMaxLaneForPick = maxLaneForSlot;

  // v15.6.2 safety: a lane cap must guide ranking, not kill the whole batch.
  // If the ranked list contains no usable player inside the planned lane, relax carefully.
  // Impact slots may relax up to superstar; filler slots relax by one tier only when needed.
  if (!chosen) {
    const relaxedLane = isImpactSlot
      ? 'superstar'
      : cardUtilityMode
      ? maxLaneForSlot
      : nextLane06(maxLaneForSlot, 1);

    if (relaxedLane !== maxLaneForSlot) {
      chosen =
        isLaneUsableCandidate06(scoreRes?.chosen_pick, relaxedLane)
          ? scoreRes.chosen_pick
          : ranked.find((c) => isLaneUsableCandidate06(c, relaxedLane)) || null;

      if (chosen) {
        laneRelaxed = true;
        laneRelaxReason = isImpactSlot ? 'impact_lane_relaxed_to_superstar' : 'lane_relaxed_one_tier';
        effectiveMaxLaneForPick = relaxedLane;
      }
    }
  }

  if (!chosen && isImpactSlot) {
    chosen = isUsableCandidate06(scoreRes?.chosen_pick)
      ? scoreRes.chosen_pick
      : ranked.find(isUsableCandidate06) || null;

    if (chosen) {
      laneRelaxed = true;
      laneRelaxReason = 'impact_fallback_any_lane';
      effectiveMaxLaneForPick = 'any';
    }
  }

  if (!chosen) {
    planned_picks.push({
      stepIndex: stepIdx,
      pick_nr: planned_picks.length + 1,
      importance: plannedRole,
      base_importance: baseRole,
      role_upgrade_steps: upgradeSteps,
      focusType,
      focusKey,
      planned_focusType: plannedFocusType,
      planned_focusKey: plannedFocusKey,
      dynamic_focus_source: s(dyn?.source || ''),
      dynamic_focus_needId: s(dyn?.needId || ''),
      slot_role_used: plannedRole,
      slot_role_fallback_used: upgradeSteps > 0,
      raw_planned_role: rawPlannedRole,
      max_lane_for_slot: maxLaneForSlot,
      effective_max_lane_for_pick: typeof effectiveMaxLaneForPick !== 'undefined' ? effectiveMaxLaneForPick : maxLaneForSlot,
      lane_relaxed: typeof laneRelaxed !== 'undefined' ? laneRelaxed === true : false,
      lane_relax_reason: typeof laneRelaxReason !== 'undefined' ? laneRelaxReason : '',
      spend_architecture_used: spendArchitectureUsed,
      impact_slots_used: impactSlotsUsed,
      is_impact_slot: isImpactSlot,
      role_budget_cap: roleBudgetPlan06?.budgetCapRole || '',
      role_compression_reason: roleBudgetPlan06?.compressionReason || '',
      role_compressed: roleBudgetPlan06?.roleCompressed === true,
      card_utility_mode: cardUtilityMode,
      desired_card_colors: desiredCardColors,
      card_utility_strict: cardUtilityStrict,
      market_role: '',
      player_name: '',
      klasse: '',
      class_color: '',
      price: 0,
      budget_after: Number(remainingBudget.toFixed(2)),
      roster_size_after: simRoster.length,
      fit: 0,
      score: 0,
      skip: true,
      skipped: true,
      skip_recommended: true,
      skip_reason: 'no_candidate_in_planned_lane',
      rationale: 'no candidate within planned lane cap: maxLane=' + maxLaneForSlot + ' remainingBudget=' + remainingBudget.toFixed(2),
      error_reason: 'no_candidate_in_planned_lane',
      error_message: '',
      score_breakdown_text:
        'FAILED ranked=' +
        ranked.length +
        ' picked=' +
        pickedNow.size +
        ' skipped=' +
        skippedCandidateNames.size
    });

    break;
  }

  const getActiveIdentityAnchorAxis06 = () => {
    const source = s(dyn?.source || '');
    const axFromMeta = lower(dyn?.identity_anchor?.topAxis || '');
    const axFromFocus = lower(focusKey || '');

    if (source.startsWith('identity_anchor_') && ['pow', 'spe', 'men', 'soc'].includes(axFromMeta)) return axFromMeta;
    if (source.startsWith('identity_anchor_') && focusType === 'identity_weighted' && ['pow', 'spe', 'men', 'soc'].includes(axFromFocus)) return axFromFocus;

    return '';
  };

  let identityAnchorReleasedForPick06 = false;
  let identityAnchorChoiceReason06 = '';

  const selectIdentityAnchorCandidate06 = (rankedRows, currentChosen, laneCap) => {
    const anchorAxis = getActiveIdentityAnchorAxis06();
    if (!anchorAxis) return { chosen: currentChosen, reason: 'no_identity_anchor_axis', released: false };

    const usable = (Array.isArray(rankedRows) ? rankedRows : [])
      .filter((c) => laneOkForSlot06(c, laneCap, 0) && isUsableCandidate06(c))
      .sort((a, b) => n(b?.score, 0) - n(a?.score, 0));

    const topOverall = usable[0] || currentChosen || null;
    const topOverallScore = n(topOverall?.score, 0);

    const axisRows = usable
      .filter((c) => candidateCoversAxisStrictForExtreme06(c, anchorAxis))
      .sort((a, b) => n(b?.score, 0) - n(a?.score, 0));

    const bestAxis = axisRows[0] || null;

    if (!bestAxis) {
      return {
        chosen: topOverall || currentChosen,
        reason: 'identity_anchor_released_no_axis_candidate',
        released: true
      };
    }

    const bestAxisScore = n(bestAxis?.score, 0);

    // Fix 3 without an absolute quality floor:
    // Keep the anchor only if the best axis candidate is close enough to the best overall candidate.
    // If the anchor would force a clearly worse pick, release the anchor and use value/need instead.
    const role = normalizeRole(plannedRole || baseRole || 'depth');
    const relativeBand = (() => {
      if (isImpactSlot) return 6.0;
      if (role === 'core' || role === 'depth') return 8.0;
      if (role === 'backup') return 9.5;
      return 12.0;
    })();

    const relativeRatio = (() => {
      if (isImpactSlot) return 0.94;
      if (role === 'core' || role === 'depth') return 0.90;
      if (role === 'backup') return 0.87;
      return 0.82;
    })();

    const anchorTooWeakRelativeToBest =
      topOverall &&
      topOverallScore > 0 &&
      bestAxisScore < topOverallScore - relativeBand &&
      bestAxisScore < topOverallScore * relativeRatio;

    if (anchorTooWeakRelativeToBest) {
      return {
        chosen: topOverall || currentChosen,
        reason:
          'identity_anchor_released_low_relative_' +
          anchorAxis +
          '_axis=' +
          bestAxisScore.toFixed(1) +
          '_top=' +
          topOverallScore.toFixed(1),
        released: true
      };
    }

    const currentScore = n(currentChosen?.score, 0);
    const currentCoversAnchor = candidateCoversAxisStrictForExtreme06(currentChosen, anchorAxis);

    // If the current chosen anchor candidate is meaningfully worse than the best anchor candidate,
    // replace it. This prevents seeded variation from sacrificing the anchor quality.
    if (
      !currentCoversAnchor ||
      (bestAxisScore > 0 && currentScore < bestAxisScore - 1.75 && currentScore < bestAxisScore * 0.985)
    ) {
      return {
        chosen: bestAxis,
        reason:
          'identity_anchor_best_axis_' +
          anchorAxis +
          '_score=' +
          bestAxisScore.toFixed(1),
        released: false
      };
    }

    return {
      chosen: currentChosen,
      reason: 'identity_anchor_current_ok_' + anchorAxis,
      released: false
    };
  };

  const identityAnchorVariant06 = selectIdentityAnchorCandidate06(ranked, chosen, effectiveMaxLaneForPick || maxLaneForSlot);
  if (identityAnchorVariant06?.chosen) chosen = identityAnchorVariant06.chosen;
  identityAnchorReleasedForPick06 = identityAnchorVariant06?.released === true;
  identityAnchorChoiceReason06 = identityAnchorVariant06?.reason || '';

  const selectSeededCandidateVariant06 = (rankedRows, currentChosen, laneCap) => {
    const base = currentChosen || null;
    if (!base) return { chosen: currentChosen, poolSize: 0, reason: 'no_base_candidate' };

    const baseScore = n(base?.score, 0);
    const baseRole = normalizeRole(base?.market_role || base?.importance || plannedRole);
    const role = normalizeRole(plannedRole || baseRole);

    const band = (() => {
      if (isImpactSlot) return 4.25;
      if (role === 'core' || role === 'star' || role === 'superstar') return 5.25;
      if (role === 'depth') return 7.0;
      if (role === 'backup') return 8.5;
      return 10.0;
    })();

    const minScore = (() => {
      // Fix 2: seeded candidate variation must stay near the best candidate.
      // No absolute role quality floor here: this is only relative to the current top pick.
      const minRatio = (() => {
        if (isImpactSlot) return 0.94;
        if (role === 'core' || role === 'star' || role === 'superstar') return 0.92;
        if (role === 'depth') return 0.90;
        if (role === 'backup') return 0.88;
        return 0.84;
      })();

      const bandCap = (() => {
        if (baseScore >= 94) return Math.min(band, 5.5);
        if (baseScore >= 82) return band;
        return Math.min(10, band + 1.5);
      })();

      return Math.max(0, Math.max(baseScore - bandCap, baseScore * minRatio));
    })();

    const activeAnchorAxis = !identityAnchorReleasedForPick06 ? getActiveIdentityAnchorAxis06() : '';

    const usableRows = (Array.isArray(rankedRows) ? rankedRows : [])
      .filter((c) => laneOkForSlot06(c, laneCap, 0) && isUsableCandidate06(c))
      .filter((c) => n(c?.score, 0) >= minScore)
      .filter((c) => !activeAnchorAxis || candidateCoversAxisStrictForExtreme06(c, activeAnchorAxis))
      .slice(0, isImpactSlot ? 6 : 10);

    const withBase = usableRows.some((c) => lower(c?.player_name || c?.name) === lower(base?.player_name || base?.name))
      ? usableRows
      : [base, ...usableRows].filter((c) => c && isUsableCandidate06(c));

    const pool = withBase
      .map((c) => {
        const score = n(c?.score, 0);
        const scoreGap = Math.max(0, baseScore - score);
        const price = n(c?.price, 0);
        const salary = n(c?.salary ?? c?.gehalt ?? 0, 0);
        const axis = lower(c?.candidate_axis || c?.primary_axis || c?.step_axis || '');
        const dz = lower(c?.step_diszi || c?.best_diszi_field || '');
        const klasse = lower(c?.klasse || '');
        const axisCount = pickedAxes.filter((x) => lower(x) === axis).length;
        const dzCount = pickedDisciplines.filter((x) => lower(x) === dz).length;
        const classCount = planned_picks.filter((p) => lower(p?.klasse) === klasse && !p?.skip && !p?.skipped).length;
        const scoreWeight = Math.pow(Math.max(0.08, 1 - scoreGap / Math.max(1, band + 2)), 2.2);
        const priceWeight = plannerStrategy === 'cash_creators' ? clamp(1.18 - price / Math.max(1, remainingBudget + 20), 0.55, 1.15) : 1;
        const salaryWeight = plannerStrategy === 'cash_creators' ? clamp(1.12 - salary / 28, 0.65, 1.12) : 1;
        const varietyWeight = clamp(1.12 - axisCount * 0.10 - dzCount * 0.18 - classCount * 0.10, 0.58, 1.14);
        const topBias = lower(c?.player_name || c?.name) === lower(base?.player_name || base?.name) ? 1.10 : 1.0;

        // v15.7.3: fit tie-break inside the already near-top pool.
        // This is not a hard low-fit penalty. It only matters when several candidates
        // are already close enough by score. Then better team fit should win more often.
        const fit = n(c?.fit ?? c?.team_fit ?? c?.fit_score, 0);
        const baseFit = n(base?.fit ?? base?.team_fit ?? base?.fit_score, 0);
        const fitWeight = (() => {
          if (fit >= 24) return 1.42;
          if (fit >= 18) return 1.30;
          if (fit >= 12) return 1.18;
          if (fit >= 7) return 1.08;
          if (fit >= 3) return 1.00;
          if (fit >= 0) return 0.86;
          return 0.74;
        })();
        const fitRescueWeight = (() => {
          const candidateClearlyBetterFit = fit >= Math.max(10, baseFit + 8);
          const scoreStillSimilar = score >= baseScore - Math.max(4.5, band * 0.55);
          const baseClearlyLowFit = baseFit < 5;
          if (baseClearlyLowFit && candidateClearlyBetterFit && scoreStillSimilar) return 1.35;
          if (candidateClearlyBetterFit && scoreStillSimilar) return 1.16;
          return 1.0;
        })();

        return {
          candidate: c,
          score,
          fit,
          weight: Math.max(0.001, scoreWeight * priceWeight * salaryWeight * varietyWeight * fitWeight * fitRescueWeight * topBias)
        };
      })
      .filter((x) => x.weight > 0)
      .sort((a, b) => b.score - a.score);

    if (pool.length <= 1) return { chosen: base, poolSize: pool.length, reason: 'single_candidate' };

    const selected = pickWeightedSeeded06(
      pool.map((x) => ({ value: x.candidate, weight: x.weight })),
      `candidateChoice|${team}|${stepIdx}|${plannedRole}|${focusType}:${focusKey}|${pickedAxes.join('-')}|${pickedDisciplines.join('-')}|${baseScore.toFixed(2)}`,
      { value: base }
    );

    const selectedCandidate = selected?.value || base;
    const selectedFit = n(selectedCandidate?.fit ?? selectedCandidate?.team_fit ?? selectedCandidate?.fit_score, 0);
    const baseFit = n(base?.fit ?? base?.team_fit ?? base?.fit_score, 0);

    return {
      chosen: selectedCandidate,
      poolSize: pool.length,
      reason: `seeded_candidate_pool_${pool.length}_relative_band_${band.toFixed(1)}_min_${minScore.toFixed(1)}_fitTie_base_${baseFit.toFixed(1)}_selected_${selectedFit.toFixed(1)}`
    };
  };

  const candidateVariant06 = selectSeededCandidateVariant06(ranked, chosen, effectiveMaxLaneForPick || maxLaneForSlot);
  if (candidateVariant06?.chosen) chosen = candidateVariant06.chosen;

  if (identityAnchorChoiceReason06) {
    try {
      chosen.__identity_anchor_choice_reason = identityAnchorChoiceReason06;
      chosen.__identity_anchor_released = identityAnchorReleasedForPick06 === true;
    } catch (e) {}
  }

  const pickedName = s(chosen?.player_name || chosen?.name);
  const price = n(chosen?.price);
  const pickedKey = pickedName.toLowerCase().trim();

  // v15.6.4: Optional picks may not burn the protected cash buffer.
  // Once minimum roster is already reached, a non-impact filler must either
  // keep the buffer intact or be genuinely cheap enough to justify as filler.
  const chosenSalaryForBuffer = n(chosen?.salary ?? chosen?.gehalt ?? 0);
  const budgetAfterCandidate = Number(Math.max(0, remainingBudget - price).toFixed(2));
  const rosterAlreadyAtMinBeforePick = minPlayers > 0 && simRoster.length >= minPlayers;
  const wouldBreakProtectedBuffer =
    plannerMinCashBuffer > 0 &&
    budgetAfterCandidate < Math.max(0, plannerMinCashBuffer - 2.5);
  const genuinelyCheapOptionalPick = price <= 14.75 && chosenSalaryForBuffer <= 3.75;

  if (
    rosterAlreadyAtMinBeforePick &&
    !isImpactSlot &&
    wouldBreakProtectedBuffer &&
    !genuinelyCheapOptionalPick
  ) {
    notes.push(
      'stop: optional_cash_buffer_guard before pick ' +
        (stepIdx + 1) +
        ' candidate=' +
        pickedName +
        ' price=' +
        price.toFixed(2) +
        ' salary=' +
        chosenSalaryForBuffer.toFixed(2) +
        ' budgetAfterCandidate=' +
        budgetAfterCandidate.toFixed(2) +
        ' minCashBuffer=' +
        plannerMinCashBuffer.toFixed(2)
    );

    break;
  }

  if (candidateVariant06?.reason && candidateVariant06.poolSize > 1) {
    try { chosen.__seeded_candidate_choice_reason = candidateVariant06.reason; chosen.__seeded_candidate_pool_size = candidateVariant06.poolSize; } catch (e) {}
  }

  const chosenSkipRecommended =
    chosen?.skip_recommended === true ||
    chosen?.quality_gate_ok === false;

  if (chosenSkipRecommended) {
    skippedCandidateNames.add(pickedKey);
    skipCredit += 1;
    skipStreakByActiveStep[stepIdx] = n(skipStreakByActiveStep[stepIdx], 0) + 1;

    planned_picks.push({
      stepIndex: stepIdx,
      pick_nr: planned_picks.length + 1,
      importance: plannedRole,
      base_importance: baseRole,
      role_upgrade_steps: upgradeSteps,
      focusType,
      focusKey,
      planned_focusType: plannedFocusType,
      planned_focusKey: plannedFocusKey,
      dynamic_focus_source: s(dyn?.source || ''),
      dynamic_focus_needId: s(dyn?.needId || ''),
      slot_role_used: plannedRole,
      slot_role_fallback_used: upgradeSteps > 0,
      raw_planned_role: rawPlannedRole,
      max_lane_for_slot: maxLaneForSlot,
      effective_max_lane_for_pick: typeof effectiveMaxLaneForPick !== 'undefined' ? effectiveMaxLaneForPick : maxLaneForSlot,
      lane_relaxed: typeof laneRelaxed !== 'undefined' ? laneRelaxed === true : false,
      lane_relax_reason: typeof laneRelaxReason !== 'undefined' ? laneRelaxReason : '',
      spend_architecture_used: spendArchitectureUsed,
      impact_slots_used: impactSlotsUsed,
      is_impact_slot: isImpactSlot,
      role_budget_cap: roleBudgetPlan06?.budgetCapRole || '',
      role_compression_reason: roleBudgetPlan06?.compressionReason || '',
      role_compressed: roleBudgetPlan06?.roleCompressed === true,
      card_utility_mode: cardUtilityMode,
      desired_card_colors: desiredCardColors,
      card_utility_strict: cardUtilityStrict,

      market_role: s(chosen?.market_role || ''),
      player_name: pickedName,
      rejected_player_name: pickedName,
      klasse: s(chosen?.klasse || ''),
      class_color: s(chosen?.class_color || ''),
      price: Number(price.toFixed(2)),
      salary: Number(n(chosen?.salary ?? chosen?.gehalt ?? 0).toFixed(2)),
      budget_after: Number(remainingBudget.toFixed(2)),
      roster_size_after: simRoster.length,
      fit: Number(n(chosen?.fit).toFixed(2)),
      score: Number(n(chosen?.score).toFixed(3)),
      skip: true,
      skipped: true,
      skip_recommended: true,
      quality_gate_ok: false,
      skip_reason: s(chosen?.skip_reason || 'skip_recommended'),
      skip_min_score: chosen?.skip_min_score ?? null,
      rationale:
        'SKIP empfohlen: ' +
        s(chosen?.skip_reason || 'quality gate failed') +
        ' · Kandidat=' +
        pickedName +
        ' · ' +
        s(chosen?.rationale || ''),
      error_reason: 'skip_recommended',
      error_message: '',
      step_axis: s(chosen?.step_axis || ''),
      step_diszi: s(chosen?.step_diszi || ''),
      candidate_axis: s(chosen?.candidate_axis || chosen?.primary_axis || ''),
      primary_axis: s(chosen?.primary_axis || chosen?.candidate_axis || ''),
      secondary_axis: s(chosen?.secondary_axis || ''),
      covered_axes: Array.isArray(chosen?.covered_axes) ? chosen.covered_axes : [],
      picked_axis_tracked: '',

      sim_added_pow: Number(n(chosen?.pow, 0).toFixed(2)),
      sim_added_spe: Number(n(chosen?.spe, 0).toFixed(2)),
      sim_added_men: Number(n(chosen?.men, 0).toFixed(2)),
      sim_added_soc: Number(n(chosen?.soc, 0).toFixed(2)),
      sim_added_has_diszi_scores:
        !!chosen?.diszi_attr_scores &&
        Object.keys(chosen.diszi_attr_scores || {}).length > 0,

      ...buildScoreBreakdown(chosen),
      ...extractEngineFields(chosen)
    });

    notes.push(
      'skip step=' +
        (stepIdx + 1) +
        ' candidate=' +
        pickedName +
        ' reason=' +
        s(chosen?.skip_reason || 'skip_recommended') +
        ' skipCredit=' +
        skipCredit
    );

    continue;
  }

  if (pickedSet.has(pickedKey)) {
    planned_picks.push({
      stepIndex: stepIdx,
      pick_nr: planned_picks.length + 1,
      importance: plannedRole,
      base_importance: baseRole,
      role_upgrade_steps: upgradeSteps,
      focusType,
      focusKey,
      planned_focusType: plannedFocusType,
      planned_focusKey: plannedFocusKey,
      dynamic_focus_source: s(dyn?.source || ''),
      dynamic_focus_needId: s(dyn?.needId || ''),
      slot_role_used: plannedRole,
      slot_role_fallback_used: upgradeSteps > 0,
      raw_planned_role: rawPlannedRole,
      max_lane_for_slot: maxLaneForSlot,
      effective_max_lane_for_pick: typeof effectiveMaxLaneForPick !== 'undefined' ? effectiveMaxLaneForPick : maxLaneForSlot,
      lane_relaxed: typeof laneRelaxed !== 'undefined' ? laneRelaxed === true : false,
      lane_relax_reason: typeof laneRelaxReason !== 'undefined' ? laneRelaxReason : '',
      spend_architecture_used: spendArchitectureUsed,
      impact_slots_used: impactSlotsUsed,
      is_impact_slot: isImpactSlot,
      role_budget_cap: roleBudgetPlan06?.budgetCapRole || '',
      role_compression_reason: roleBudgetPlan06?.compressionReason || '',
      role_compressed: roleBudgetPlan06?.roleCompressed === true,
      card_utility_mode: cardUtilityMode,
      desired_card_colors: desiredCardColors,
      card_utility_strict: cardUtilityStrict,
      market_role: s(chosen?.market_role || ''),
      player_name: pickedName,
      klasse: s(chosen?.klasse || ''),
      class_color: s(chosen?.class_color || ''),
      price: Number(price.toFixed(2)),
      budget_after: Number(remainingBudget.toFixed(2)),
      roster_size_after: simRoster.length,
      fit: Number(n(chosen?.fit).toFixed(2)),
      score: Number(n(chosen?.score).toFixed(3)),
      skip: true,
      skipped: true,
      skip_recommended: true,
      skip_reason: 'duplicate_pick',
      rationale: 'duplicate detected, stopping',
      error_reason: 'duplicate_pick',
      error_message: '',
      ...buildScoreBreakdown(chosen),
      ...extractEngineFields(chosen)
    });

    break;
  }

  pickedNames.push(pickedName);
  pickedSet.add(pickedKey);
  skipStreakByActiveStep[stepIdx] = 0;

  try {
    const dz = lower(chosen?.step_diszi || chosen?.best_diszi_field || '');
    if (dz) pickedDisciplines.push(dz);
  } catch (e) {}

  let trackedAxis = '';

  try {
    const forcedTrackedAxis = !identityAnchorReleasedForPick06 ? getActiveIdentityAnchorAxis06() : '';
    trackedAxis = resolveCandidateAxis(chosen, forcedTrackedAxis);

    if (['pow', 'spe', 'men', 'soc'].includes(trackedAxis)) {
      pickedAxes.push(trackedAxis);
    }
  } catch (e) {}

  const simRosterRow = extractPlayerStatsForSimRoster(chosen, pickedName, price);
  simRoster.push(simRosterRow);

  remainingBudget = Number(Math.max(0, remainingBudget - price).toFixed(2));

  if (upgradeSteps > 0) {
    skipCredit = Math.max(0, skipCredit - upgradeSteps);
  }

  planned_picks.push({
    stepIndex: stepIdx,
    pick_nr: planned_picks.length + 1,
    importance: plannedRole,
    base_importance: baseRole,
    role_upgrade_steps: upgradeSteps,
    focusType,
    focusKey,
    planned_focusType: plannedFocusType,
    planned_focusKey: plannedFocusKey,
    dynamic_focus_source: s(dyn?.source || ''),
    dynamic_focus_needId: s(dyn?.needId || ''),
    identity_anchor_choice_reason: identityAnchorChoiceReason06,
    identity_anchor_released: identityAnchorReleasedForPick06 === true,
    seeded_candidate_choice_reason: s(chosen?.__seeded_candidate_choice_reason || ''),
    seeded_candidate_pool_size: chosen?.__seeded_candidate_pool_size ?? null,
    slot_role_used: plannedRole,
    slot_role_fallback_used: upgradeSteps > 0,
      raw_planned_role: rawPlannedRole,
      max_lane_for_slot: maxLaneForSlot,
      effective_max_lane_for_pick: typeof effectiveMaxLaneForPick !== 'undefined' ? effectiveMaxLaneForPick : maxLaneForSlot,
      lane_relaxed: typeof laneRelaxed !== 'undefined' ? laneRelaxed === true : false,
      lane_relax_reason: typeof laneRelaxReason !== 'undefined' ? laneRelaxReason : '',
      spend_architecture_used: spendArchitectureUsed,
      impact_slots_used: impactSlotsUsed,
      is_impact_slot: isImpactSlot,
      role_budget_cap: roleBudgetPlan06?.budgetCapRole || '',
      role_compression_reason: roleBudgetPlan06?.compressionReason || '',
      role_compressed: roleBudgetPlan06?.roleCompressed === true,
      card_utility_mode: cardUtilityMode,
      desired_card_colors: desiredCardColors,
      card_utility_strict: cardUtilityStrict,
    market_role: s(chosen?.market_role || ''),
    player_name: pickedName,
    klasse: s(chosen?.klasse || ''),
    class_color: s(chosen?.class_color || ''),
    price: Number(price.toFixed(2)),
    salary: Number(n(chosen?.salary ?? chosen?.gehalt ?? 0).toFixed(2)),
    budget_after: Number(remainingBudget.toFixed(2)),
    roster_size_after: simRoster.length,
    fit: Number(n(chosen?.fit).toFixed(2)),
    score: Number(n(chosen?.score).toFixed(3)),
    skip: false,
    skipped: false,
    skip_recommended: false,
    quality_gate_ok: true,
    skip_reason: '',
    rationale: s(chosen?.rationale || ''),
    error_reason: '',
    error_message: '',
    step_axis: s(chosen?.step_axis || ''),
    step_diszi: s(chosen?.step_diszi || ''),
    candidate_axis: s(chosen?.candidate_axis || chosen?.primary_axis || ''),
    primary_axis: s(chosen?.primary_axis || chosen?.candidate_axis || ''),
    secondary_axis: s(chosen?.secondary_axis || ''),
    covered_axes: Array.isArray(chosen?.covered_axes) ? chosen.covered_axes : [],
    picked_axis_tracked: trackedAxis,

    sim_added_pow: Number(n(simRosterRow?.pow, 0).toFixed(2)),
    sim_added_spe: Number(n(simRosterRow?.spe, 0).toFixed(2)),
    sim_added_men: Number(n(simRosterRow?.men, 0).toFixed(2)),
    sim_added_soc: Number(n(simRosterRow?.soc, 0).toFixed(2)),
    sim_added_has_diszi_scores:
      !!simRosterRow?.diszi_attr_scores &&
      Object.keys(simRosterRow.diszi_attr_scores || {}).length > 0,

    ...buildScoreBreakdown(chosen),
    ...extractEngineFields(chosen)
  });
}

notes.push('budgetStart=' + budgetStart.toFixed(2) + ' (' + budgetStartSource + ')');
notes.push('budgetEnd=' + remainingBudget.toFixed(2));
notes.push('plannerBudgetMax=' + plannerBudgetMax.toFixed(2) + ' plannerBudgetBase=' + plannerBudgetBase.toFixed(2) + ' minCashBuffer=' + plannerMinCashBuffer.toFixed(2));
notes.push('plannerRisk savings=' + plannerSavingsBias01.toFixed(3) + ' lock=' + plannerContractLockRisk01.toFixed(3) + ' multi=' + plannerMultiYearSalaryRisk01.toFixed(3) + ' attack=' + plannerAttackPressure01.toFixed(3) + ' through=' + plannerThroughPowerBias01.toFixed(3));
notes.push('rosterNow=' + rosterNow + ' targetPlayers=' + targetPlayers);
notes.push(
  'plannedSteps=' +
    plannedSteps +
    ' activeTarget=' +
    activeTarget +
    ' (planner=' +
    (planRes?.ok ? 'ok' : 'no') +
    ', fallback=' +
    plannedStepsFallback +
    ')'
);
notes.push('plannerStrategy=' + plannerStrategy);
notes.push('picked=' + activePickCount06(planned_picks));
notes.push('skipped=' + skipPickCount06(planned_picks));
notes.push('skippedCandidateNames=' + [...skippedCandidateNames].join(','));
notes.push('pickedDisciplines=' + pickedDisciplines.join(','));
notes.push('pickedAxes=' + pickedAxes.join(','));
notes.push('remainingSkipCredit=' + skipCredit);
notes.push('needs_timeline_entries=' + needs_timeline.length);
notes.push('v15.4: spend architecture + dynamic role compression keeps planner influence after expensive early picks');
notes.push('spendArchitectureUsed=' + (plannerSpendArchitecture || 'inferred') + ' impactSlots=' + plannedImpactSlots06(plannerSpendArchitecture || inferSpendArchitecture06(plannerStrategy, activeTarget, plannerAttackPressure01, plannerSavingsBias01, plannerBudgetMax || budgetStart, budgetStart), activeTarget, plannerAttackPressure01, budgetStart));
notes.push('v15.6.4: optional non-impact picks stop before breaking minCashBuffer unless genuinely cheap');
notes.push('v15.6.3: card utility is rare fallback only for genuinely cheap reserve/late-backup fillers');
notes.push('v15.6.2: lane cap relaxes instead of stopping the batch when impact slot has no capped candidate');
const identityMetaFinal06 = getTeamIdentityMeta06();
notes.push('desiredCardColors=' + desiredCardColorsForTeam06().join(','));
notes.push(
  'identityAnchor topAxis=' +
    identityMetaFinal06.topAxis +
    ' share=' +
    identityMetaFinal06.topShare.toFixed(3) +
    ' picked=' +
    pickedAxes.filter((ax) => lower(ax) === identityMetaFinal06.topAxis).length
);
notes.push('v15.7.3: near-top candidate pools use fit as a tie-break, so low-fit picks lose to similar-score better-fit alternatives');
notes.push('v15.7.2: extreme identity teams keep stronger top-axis anchor and strict top-axis candidate quality');
notes.push('v15.7.1: seeded candidate pools stay near-top, identity anchors may release if relatively weak, and anchor axis tracking is fixed');
notes.push('v15.6.5: dominant identity axis gets a small pick-floor before discipline micro-needs take over');
notes.push('v15.5: supports fill_then_spike reverse buying from planner');
notes.push('v15.5: impact slots are architecture-aware, not always first slots');
notes.push('v15.3: planner budget/risk context is passed to AI2_07 for luxury penalties');
notes.push('v15.3: skip-spam guard stops after too many rejected candidates for same slot');
notes.push('v15.2: skip recommendations stay skipped and do not consume active buy slots');
notes.push('v15.2: no affordable candidate stops cleanly before PickScoreEngine');
notes.push('v15.2: AI2_07 chosen_pick is respected before ranked_top_50 fallback');
notes.push('v15.2: raw score fields are passed through from AI2_07');
notes.push('attempts=' + attempts + ' maxAttempts=' + maxAttempts);

try {
  globalThis.simRosterForNeedsInput = null;
} catch (e) {}

try {
  globalThis.pickedDisciplinesInput = null;
} catch (e) {}

try {
  globalThis.pickedAxesInput = null;
} catch (e) {}

return {
  ok: true,
  version: VERSION,
  team,
  simSeed,
  plannedSteps,
  activeTarget,
  activeBuys: activePickCount06(planned_picks),
  skippedRows: skipPickCount06(planned_picks),
  planned_picks,
  needs_timeline,
  debug: { notes }
};
