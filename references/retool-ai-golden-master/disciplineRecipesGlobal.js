// term: disciplineRecipesGlobal
// id: unknown
// type: unknown
// subtype: unknown
// page: unknown
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
return (async () => {
  try {
    const VERSION = 'aiSNP_needsCore.v22_0_direct_clean_axis_fix';

    const ai = window.aiSNP || (window.aiSNP = {});
    if (!ai?.utils || !ai?.context) {
      return {
        ok: false,
        version: VERSION,
        reason: 'missing_preload_aiSNP'
      };
    }

    const { utils, context } = ai;

    const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
    const s = (v) => String(v ?? '').trim();
    const lower = (v) => String(v ?? '').trim().toLowerCase();
    const arr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};

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

    const AXIS_COLOR = {
      pow: 'red',
      spe: 'green',
      men: 'blue',
      soc: 'yellow'
    };

    const DISZI_FIELDS = Object.keys(DISZI_AXIS);

    const buildBaseCtx = () => context.buildPreviewContext({
      filterTeamValue: filterTeam?.value,
      selectedTeamCode: localStorage?.values?.selectedTeamCode,
      activePlayersRaw: getActivePlayersByTeam?.data,
      teamRatingsRaw: getTeamRatingsTransfermarkt?.data,
      candidatePoolRaw: aiTransferCandidatePool?.value,
      plan: aiTeamPlan?.value,
      slotPlanObj: aiTeamSlotPlan?.value,
      budgetLogic: transfermarktSalaryBudgetLogic?.value,
      rankingsRaw: teamDisciplineRankings?.value,
      recipes: disciplineRecipesGlobal?.value,
      overrides: teamIdentityOverrides?.value,
      varianceCfg: aiVarianceConfig?.value,
      bracketCfg: bracketConfig?.value,
      snapshotNeedsRaw: aiTeamNeedsSnapshot?.value,
      queryNeedsRaw: aiTeamNeedsQuery?.data,
      cashRow: getCashFromSaisonstand?.value,
      formatDataAsArrayFn: typeof formatDataAsArray === 'function' ? formatDataAsArray : undefined
    });

    const safeRoster =
      (typeof simRosterInput !== 'undefined' && Array.isArray(simRosterInput))
        ? simRosterInput.filter(Boolean)
        : [];

    const baseCtx = buildBaseCtx();
    if (!baseCtx?.ok) return baseCtx;

    const ctx = context.enrichContext(baseCtx);

    const roster = safeRoster.length ? safeRoster : arr(ctx?.roster);

    const team =
      s(ctx?.team) ||
      s(filterTeam?.value) ||
      s(localStorage?.values?.selectedTeamCode);

    const teamRatingsRaw = {
      pow: n(ctx?.axisPriorityAbs?.pow || ctx?.teamRatings?.pow || ctx?.teamRatingsRow?.pow || 0),
      spe: n(ctx?.axisPriorityAbs?.spe || ctx?.teamRatings?.spe || ctx?.teamRatingsRow?.spe || 0),
      men: n(ctx?.axisPriorityAbs?.men || ctx?.teamRatings?.men || ctx?.teamRatingsRow?.men || 0),
      soc: n(ctx?.axisPriorityAbs?.soc || ctx?.teamRatings?.soc || ctx?.teamRatingsRow?.soc || 0)
    };

    const normalizeSharesSoft = (raw) => {
      const base = {
        pow: Math.max(0, n(raw?.pow)),
        spe: Math.max(0, n(raw?.spe)),
        men: Math.max(0, n(raw?.men)),
        soc: Math.max(0, n(raw?.soc))
      };

      const maxRaw = Math.max(base.pow, base.spe, base.men, base.soc, 1);
      const floor = maxRaw * 0.10;

      const softened = {
        pow: Math.max(base.pow, floor),
        spe: Math.max(base.spe, floor),
        men: Math.max(base.men, floor),
        soc: Math.max(base.soc, floor)
      };

      const sum = softened.pow + softened.spe + softened.men + softened.soc;

      return {
        pow: softened.pow / sum,
        spe: softened.spe / sum,
        men: softened.men / sum,
        soc: softened.soc / sum
      };
    };

    const axisShares = normalizeSharesSoft(teamRatingsRaw);
    const axisOrder = Object.entries(axisShares)
      .sort((a, b) => b[1] - a[1])
      .map(([axis]) => axis);

    const topAxis = axisOrder[0] || '';
    const secondAxis = axisOrder[1] || '';
    const thirdAxis = axisOrder[2] || '';

    const topColor = AXIS_COLOR[topAxis] || '';
    const secondColor = AXIS_COLOR[secondAxis] || '';
    const thirdColor = AXIS_COLOR[thirdAxis] || '';

    const topPriorityLead01 = Number(
      Math.max(0, n(axisShares[topAxis]) - n(axisShares[secondAxis])).toFixed(6)
    );

    const focusRigidity01 = Number(
      clamp(0.55 * n(axisShares[topAxis]) + 0.45 * topPriorityLead01, 0, 1).toFixed(6)
    );

    const extremeFocus01 = Number(
      clamp((n(axisShares[topAxis]) - 0.36) / 0.28, 0, 1).toFixed(6)
    );

    const getArea = (row, axis) => {
      if (axis === 'pow') return n(row?.pow || row?.power || 0);
      if (axis === 'spe') return n(row?.spe || row?.speed || 0);
      if (axis === 'men') return n(row?.men || row?.mental || 0);
      if (axis === 'soc') return n(row?.soc || row?.social || 0);
      return 0;
    };

    const getDiszi = (row, diszi) => n(row?.[diszi]);

    const getTopNAvg = (rows, field, take = 3) => {
      const vals = arr(rows)
        .map((r) => n(r?.[field]))
        .filter((x) => Number.isFinite(x))
        .sort((a, b) => b - a)
        .slice(0, take);

      if (!vals.length) return 0;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };

    const getCoverageCount = (rows, field, threshold) =>
      arr(rows).filter((r) => n(r?.[field]) >= threshold).length;

    const getRosterAreaAvg = (rows, axis) => {
      const vals = arr(rows).map((r) => getArea(r, axis)).filter((x) => Number.isFinite(x));
      if (!vals.length) return 0;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };

    const rosterAreaAvg = {
      pow: Number(getRosterAreaAvg(roster, 'pow').toFixed(2)),
      spe: Number(getRosterAreaAvg(roster, 'spe').toFixed(2)),
      men: Number(getRosterAreaAvg(roster, 'men').toFixed(2)),
      soc: Number(getRosterAreaAvg(roster, 'soc').toFixed(2))
    };

    const makeDisziNeed = (diszi) => {
      const axis = DISZI_AXIS[diszi];
      const color = AXIS_COLOR[axis];
      const axisShare = n(axisShares[axis]);

      const top3avg = getTopNAvg(roster, diszi, 3);
      const coverageCount60 = getCoverageCount(roster, diszi, 60);
      const coverageCount70 = getCoverageCount(roster, diszi, 70);
      const coverageCount90 = getCoverageCount(roster, diszi, 90);

      const lowTop3_01 = clamp((72 - top3avg) / 42, 0, 1);
      const lowCoverage60_01 = clamp((2 - coverageCount60) / 2, 0, 1);
      const lowCoverage70_01 = clamp((1 - coverageCount70) / 1, 0, 1);

      const holeSeverity = clamp(
        0.50 * lowTop3_01 +
        0.30 * lowCoverage60_01 +
        0.20 * lowCoverage70_01,
        0,
        1
      );

      const attackability01 = clamp(
        0.60 * lowTop3_01 +
        0.40 * (1 - clamp(top3avg / 100, 0, 1)),
        0,
        1
      );

      const identityCompletionBonus01 = Number(axisShare.toFixed(6));

      const need01 = clamp(
        0.52 * holeSeverity +
        0.26 * identityCompletionBonus01 +
        0.22 * attackability01,
        0,
        1
      );

      const importance = Number((
        18 +
        58 * need01 +
        18 * identityCompletionBonus01
      ).toFixed(3));

      return {
        family: 'diszi',
        type: 'discipline_hole',
        axis,
        diszi,
        color,
        label: `Loch stopfen: ${diszi}`,
        importance,
        need01: Number(need01.toFixed(6)),
        recipeBlend01: Number(identityCompletionBonus01.toFixed(6)),
        holeSeverity: Number(holeSeverity.toFixed(6)),
        attackability01: Number(attackability01.toFixed(6)),
        identityCompletionBonus01: Number(identityCompletionBonus01.toFixed(6)),
        coverageCount60,
        coverageCount70,
        coverageCount90,
        top3avg: Number(top3avg.toFixed(2))
      };
    };

    const makeAxisNeed = (axis) => {
      const axisShare = n(axisShares[axis]);
      const avg = n(rosterAreaAvg[axis]);
      const deficit01 = clamp((58 - avg) / 38, 0, 1);
      const need01 = clamp(
        0.65 * deficit01 + 0.35 * axisShare,
        0,
        1
      );

      const importance = Number((
        14 +
        42 * need01 +
        16 * axisShare
      ).toFixed(3));

      return {
        family: 'axis',
        type: 'axis_upgrade',
        axis,
        diszi: '',
        color: AXIS_COLOR[axis],
        label:
          axis === 'pow' ? 'Power (POW) Upgrade' :
          axis === 'spe' ? 'Speed (SPE) Upgrade' :
          axis === 'men' ? 'Mental (MEN) Upgrade' :
          'Social (SOC) Upgrade',
        importance,
        need01: Number(need01.toFixed(6)),
        recipeBlend01: 0,
        holeSeverity: Number(deficit01.toFixed(6)),
        attackability01: 0,
        identityCompletionBonus01: Number(axisShare.toFixed(6)),
        coverageCount60: 0,
        coverageCount70: 0,
        coverageCount90: 0,
        top3avg: 0
      };
    };

    const disziNeeds = DISZI_FIELDS.map(makeDisziNeed);
    const axisNeeds = ['pow', 'spe', 'men', 'soc'].map(makeAxisNeed);

    const allNeeds = [...disziNeeds, ...axisNeeds]
      .sort((a, b) => b.importance - a.importance);

    const primaryNeeds = allNeeds.filter((x) => x.axis === topAxis && x.need01 >= 0.35);
    const secondaryNeeds = allNeeds.filter((x) => x.axis !== topAxis && x.need01 >= 0.24);
    const sideNeeds = allNeeds.filter((x) => x.need01 >= 0.10 && !primaryNeeds.includes(x) && !secondaryNeeds.includes(x));

    const weightedNeedPrimary = Number(
      primaryNeeds.reduce((acc, row) => acc + n(row.importance) * n(row.need01), 0).toFixed(3)
    );
    const weightedNeedSecondary = Number(
      secondaryNeeds.reduce((acc, row) => acc + n(row.importance) * n(row.need01), 0).toFixed(3)
    );
    const weightedNeedSide = Number(
      sideNeeds.reduce((acc, row) => acc + n(row.importance) * n(row.need01), 0).toFixed(3)
    );
    const weightedNeedTotal = Number(
      (weightedNeedPrimary + weightedNeedSecondary + weightedNeedSide).toFixed(3)
    );

    const topAxisOpenHoles = disziNeeds.filter((x) => x.axis === topAxis && x.need01 >= 0.35);
    const topAxisOpenHoleCount = topAxisOpenHoles.length;
    const topAxisOpenHolePressure01 = Number(
      clamp(topAxisOpenHoles.reduce((acc, x) => acc + n(x.need01), 0) / 2.4, 0, 1).toFixed(6)
    );

    const weightedNeedBreakdownTop6 = allNeeds.slice(0, 6).map((row, idx) => ({
      rank: idx + 1,
      label: row.label,
      family: row.family,
      axis: row.axis,
      diszi: row.diszi,
      color: row.color,
      importance: row.importance,
      need01: row.need01,
      weighted_score: Number((n(row.importance) * n(row.need01)).toFixed(3))
    }));

    return {
      ok: true,
      version: VERSION,
      reason: 'direct_clean_needs_core',
      team,

      needs_source_used: 'aiSNP_needsCore',

      top_axis: topAxis,
      second_axis: secondAxis,
      third_axis: thirdAxis,
      top_color: topColor,
      second_color: secondColor,
      third_color: thirdColor,

      topAxis,
      secondAxis,
      thirdAxis,
      topColor,
      secondColor,
      thirdColor,

      top_priority_lead_01: topPriorityLead01,
      focus_rigidity_01: focusRigidity01,
      extreme_focus_01: extremeFocus01,
      identity_profile:
        topPriorityLead01 >= 0.18 ? 'spiked' :
        topPriorityLead01 >= 0.08 ? 'leaning' :
        'balanced',

      active_need_count: allNeeds.length,
      primary_need_count: primaryNeeds.length,
      secondary_need_count: secondaryNeeds.length,
      side_need_count: sideNeeds.length,

      active_needs: allNeeds,
      primary_needs: primaryNeeds,
      secondary_needs: secondaryNeeds,
      side_needs: sideNeeds,

      weighted_need_primary: weightedNeedPrimary,
      weighted_need_secondary: weightedNeedSecondary,
      weighted_need_side: weightedNeedSide,
      weighted_need_total: weightedNeedTotal,
      weighted_need_breakdown_top6: weightedNeedBreakdownTop6,

      axis_shares_01: {
        pow: Number(n(axisShares.pow).toFixed(6)),
        spe: Number(n(axisShares.spe).toFixed(6)),
        men: Number(n(axisShares.men).toFixed(6)),
        soc: Number(n(axisShares.soc).toFixed(6))
      },

      identity_shares_01: {
        pow: Number(n(axisShares.pow).toFixed(6)),
        spe: Number(n(axisShares.spe).toFixed(6)),
        men: Number(n(axisShares.men).toFixed(6)),
        soc: Number(n(axisShares.soc).toFixed(6))
      },

      identity_shares_raw_01: {
        pow: Number(n(axisShares.pow).toFixed(6)),
        spe: Number(n(axisShares.spe).toFixed(6)),
        men: Number(n(axisShares.men).toFixed(6)),
        soc: Number(n(axisShares.soc).toFixed(6))
      },

      roster_gap_shares_01: {
        pow: Number(clamp((58 - rosterAreaAvg.pow) / 58, 0, 1).toFixed(6)),
        spe: Number(clamp((58 - rosterAreaAvg.spe) / 58, 0, 1).toFixed(6)),
        men: Number(clamp((58 - rosterAreaAvg.men) / 58, 0, 1).toFixed(6)),
        soc: Number(clamp((58 - rosterAreaAvg.soc) / 58, 0, 1).toFixed(6))
      },

      saturation_penalty_01: {
        pow: Number(clamp((rosterAreaAvg.pow - 62) / 22, 0, 1).toFixed(6)),
        spe: Number(clamp((rosterAreaAvg.spe - 62) / 22, 0, 1).toFixed(6)),
        men: Number(clamp((rosterAreaAvg.men - 62) / 22, 0, 1).toFixed(6)),
        soc: Number(clamp((rosterAreaAvg.soc - 62) / 22, 0, 1).toFixed(6))
      },

      team_ratings_raw: {
        pow: Number(teamRatingsRaw.pow.toFixed(2)),
        spe: Number(teamRatingsRaw.spe.toFixed(2)),
        men: Number(teamRatingsRaw.men.toFixed(2)),
        soc: Number(teamRatingsRaw.soc.toFixed(2))
      },

      roster_area_avg: rosterAreaAvg,

      top_axis_open_hole_count: topAxisOpenHoleCount,
      top_axis_open_hole_pressure_01: topAxisOpenHolePressure01,
      identity_locked_hole_pressure_01: topAxisOpenHolePressure01,
      blue_hole_pressure_01: Number(
        clamp(
          disziNeeds
            .filter((x) => x.axis === 'men' && x.need01 >= 0.35)
            .reduce((acc, x) => acc + n(x.need01), 0) / 2.4,
          0,
          1
        ).toFixed(6)
      ),

      debug: {
        source_query: 'aiSNP_needsCore',
        forwarded_scope: {
          stepIdxInput: typeof stepIdxInput !== 'undefined' ? n(stepIdxInput) : 0,
          plannedRoleInput: typeof plannedRoleInput !== 'undefined' ? s(plannedRoleInput) : '',
          pickedCountInput: typeof pickedCountInput !== 'undefined' ? n(pickedCountInput) : 0,
          remainingBudgetInput: typeof remainingBudgetInput !== 'undefined' ? Number(n(remainingBudgetInput).toFixed(2)) : Number(n(ctx?.initial_budget).toFixed(2)),
          simRosterCount: roster.length,
          pickedNamesCount: typeof pickedNamesInput !== 'undefined' && Array.isArray(pickedNamesInput) ? pickedNamesInput.length : 0
        },
        corrected_axis_mapping: DISZI_AXIS,
        axis_order: axisOrder
      }
    };
  } catch (err) {
    return {
      ok: false,
      version: 'aiSNP_needsCore.v22_0_direct_clean_axis_fix',
      reason: 'runtime_error',
      error: String(err?.message || err),
      stack: String(err?.stack || '')
    };
  }
})();
