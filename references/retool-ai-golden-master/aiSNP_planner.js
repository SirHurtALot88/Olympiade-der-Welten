// term: aiTeamNeeds
// id: aiSNP_planner
// type: script
// subtype: JavascriptQuery
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
return (() => {
  try {
    const ai = window.aiSNP;
    if (!ai?.utils || !ai?.domain || !ai?.context || !ai?.metrics) {
      return {
        ok: false,
        reason: 'missing_preload_aiSNP'
      };
    }

    const { utils, domain, context, metrics } = ai;

    const plannerRes =
      typeof aiSNP_planner !== 'undefined' && aiSNP_planner?.data
        ? aiSNP_planner.data
        : null;

    if (!plannerRes?.ok) {
      return {
        ok: false,
        reason: 'planner_not_ready',
        planner_ok: !!plannerRes?.ok
      };
    }

    const baseCtx = context.buildPreviewContext({
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

    if (!baseCtx?.ok) return baseCtx;

    let ctx = context.enrichContext(baseCtx);

    ctx = {
      ...ctx,
      roleWindows: plannerRes.role_windows || {},
      slotPlanRaw: plannerRes.slot_plan_raw || [],
      slotPlan: plannerRes.slot_plan_used || [],
      slot_plan_source: plannerRes.slot_plan_source || '',
      auto_step_planner_active: !!plannerRes.auto_step_planner_active,
      upstreamSlotPlanTooShort: !!plannerRes.upstream_slot_plan_too_short,
      budget_tracks_source: plannerRes.budget_tracks_source || '',
      budgetTracks: plannerRes.budget_tracks || {}
    };

    ctx = {
      ...ctx,
      baseProxyTop6ByField: Object.fromEntries(
        domain.DISCIPLINES.map((d) => [
          d.field,
          metrics.getTopNProxyDisziSum(ctx, ctx.roster, d.field, ctx.recipes?.[d.field] || {}, 6)
        ])
      )
    };

    const getFoundationTargets = (ctxArg) => {
      if (ctxArg.topPriorityLead01 >= 0.80) return { primaryCount: 5, strongCount: 4, strongAxisFloor: 60 };
      if (ctxArg.topPriorityLead01 >= 0.35) return { primaryCount: 4, strongCount: 3, strongAxisFloor: 56 };
      return { primaryCount: 4, strongCount: 3, strongAxisFloor: 54 };
    };

    const getFoundationState = (ctxArg, players) => {
      const cfg = getFoundationTargets(ctxArg);
      const arr = Array.isArray(players) ? players : [];

      const primaryTarget = cfg.primaryCount;
      const strongTarget = cfg.strongCount;
      const strongAxisFloor = cfg.strongAxisFloor;

      const primaryCount = arr.filter((p) => domain.getColor(p) === ctxArg.topPriorityColor).length;
      const strongCount = arr.filter(
        (p) => domain.getColor(p) === ctxArg.topPriorityColor && domain.axisValue(p, ctxArg.topPriorityAxis) >= strongAxisFloor
      ).length;

      const ready = primaryCount >= primaryTarget && strongCount >= strongTarget;

      const pivotExtraPrimary =
        ctxArg.topPriorityLead01 >= 0.75 ? 1 :
        ctxArg.topPriorityLead01 >= 0.35 ? 3 : 2;

      const pivotExtraStrong =
        ctxArg.topPriorityLead01 >= 0.75 ? 1 :
        ctxArg.topPriorityLead01 >= 0.35 ? 2 : 1;

      const pivotPrimaryTarget = primaryTarget + pivotExtraPrimary;
      const pivotStrongTarget = strongTarget + pivotExtraStrong;

      const pivotReady =
        primaryCount >= pivotPrimaryTarget &&
        strongCount >= pivotStrongTarget;

      const countNeed01 = utils.clamp((primaryTarget - primaryCount) / Math.max(1, primaryTarget), 0, 1);
      const strongNeed01 = utils.clamp((strongTarget - strongCount) / Math.max(1, strongTarget), 0, 1);
      const pivotCountNeed01 = utils.clamp((pivotPrimaryTarget - primaryCount) / Math.max(1, pivotPrimaryTarget), 0, 1);
      const pivotStrongNeed01 = utils.clamp((pivotStrongTarget - strongCount) / Math.max(1, pivotStrongTarget), 0, 1);

      return {
        primaryTarget,
        strongTarget,
        pivotPrimaryTarget,
        pivotStrongTarget,
        strongAxisFloor,
        primaryCount,
        strongCount,
        ready,
        pivotReady,
        need01: utils.clamp(0.55 * countNeed01 + 0.45 * strongNeed01, 0, 1),
        pivotNeed01: utils.clamp(0.55 * pivotCountNeed01 + 0.45 * pivotStrongNeed01, 0, 1)
      };
    };

    const evaluateManagerPivot = (ctxArg, players) => {
      const arr = Array.isArray(players) ? players : [];
      const foundation = getFoundationState(ctxArg, arr);

      const primaryColorCount = arr.filter((p) => domain.getColor(p) === ctxArg.topPriorityColor).length;
      const topAxisPlayers = arr.filter((p) => domain.getPrimaryAxisByClass(p) === ctxArg.topPriorityAxis);
      const topAxisAvg = topAxisPlayers.length
        ? topAxisPlayers.reduce((acc, p) => acc + domain.axisValue(p, ctxArg.topPriorityAxis), 0) / topAxisPlayers.length
        : 0;

      const strongPrimaryCount = topAxisPlayers.filter((p) => domain.axisValue(p, ctxArg.topPriorityAxis) >= foundation.strongAxisFloor).length;

      const focus_strength_01 = ctxArg.topPriorityLead01;

      const comfort_count_target =
        focus_strength_01 >= 0.85 ? 5 :
        focus_strength_01 >= 0.55 ? 4 : 4;

      const avg_comfort_target =
        focus_strength_01 >= 0.85 ? 64 :
        focus_strength_01 >= 0.55 ? 60 : 56;

      const countComfort01 = utils.clamp(primaryColorCount / Math.max(1, comfort_count_target), 0, 1);
      const avgComfort01 = utils.clamp((topAxisAvg - 46) / Math.max(8, avg_comfort_target - 46), 0, 1);
      const strongComfort01 = utils.clamp(strongPrimaryCount / Math.max(1, comfort_count_target - 1), 0, 1);

      const primary_comfort_01 = utils.clamp(
        0.38 * countComfort01 +
        0.32 * avgComfort01 +
        0.30 * strongComfort01,
        0, 1
      );

      const pivot_threshold =
        focus_strength_01 >= 0.80 ? 0.95 :
        focus_strength_01 >= 0.55 ? 0.90 :
        0.86;

      const canPivot =
        foundation.ready &&
        foundation.pivotReady &&
        primary_comfort_01 >= pivot_threshold;

      const launchReady =
        foundation.ready &&
        !foundation.pivotReady &&
        primary_comfort_01 >= Math.max(0.82, pivot_threshold - 0.08);

      const excessPrimary01 = utils.clamp((primaryColorCount - foundation.pivotPrimaryTarget) / 3, 0, 1);
      const excessStrong01 = utils.clamp((strongPrimaryCount - foundation.pivotStrongTarget) / 3, 0, 1);

      const launchPivot01 = launchReady
        ? utils.clamp(0.10 + 0.16 * (1 - foundation.pivotNeed01), 0, 0.24)
        : 0;

      const diversify_pivot_01 = canPivot
        ? utils.clamp(
            0.52 * utils.clamp((primary_comfort_01 - pivot_threshold) / Math.max(0.001, 1 - pivot_threshold), 0, 1) +
            0.28 * excessPrimary01 +
            0.20 * excessStrong01,
            0, 1
          )
        : launchPivot01;

      const active = canPivot && diversify_pivot_01 >= 0.10;

      const dominantColorEntry = Object.entries(
        arr.reduce((acc, p) => {
          const c = domain.getColor(p);
          if (c) acc[c] = (acc[c] || 0) + 1;
          return acc;
        }, { red: 0, green: 0, blue: 0, yellow: 0 })
      ).sort((a, b) => utils.n(b[1]) - utils.n(a[1]))[0] || ['red', 0];

      const dominant_color = dominantColorEntry[0];
      const dominant_color_count = utils.n(dominantColorEntry[1]);

      return {
        focus_strength_01: Number(focus_strength_01.toFixed(3)),
        focus_rigidity_01: Number(ctxArg.focus_rigidity_01.toFixed(3)),
        extreme_focus_01: Number(ctxArg.extreme_focus_01.toFixed(3)),
        primary_color_count: primaryColorCount,
        top_axis_avg: Number(topAxisAvg.toFixed(2)),
        strong_primary_count: strongPrimaryCount,
        comfort_count_target,
        avg_comfort_target,
        primary_comfort_01: Number(primary_comfort_01.toFixed(3)),
        min_primary_count_for_pivot: foundation.pivotPrimaryTarget,
        min_strong_primary_for_pivot: foundation.pivotStrongTarget,
        strong_axis_floor_for_pivot: foundation.strongAxisFloor,
        foundation_ready: foundation.ready,
        foundation_need_01: Number(foundation.need01.toFixed(3)),
        pivot_ready: foundation.pivotReady,
        pivot_need_01: Number(foundation.pivotNeed01.toFixed(3)),
        launch_ready: launchReady,
        pivot_threshold: Number(pivot_threshold.toFixed(3)),
        diversify_pivot_01: Number(diversify_pivot_01.toFixed(3)),
        active,
        dominant_color,
        dominant_color_count,
        top_axis_color_count: primaryColorCount
      };
    };

    const buildDynamicNeeds = (ctxArg, players) => {
      const rosterNow = Array.isArray(players) ? players : [];
      const rosterCountNow = rosterNow.length;
      const thinRosterNow = rosterCountNow < Math.max(7, ctxArg.targetRosterSize - 2);

      const managerPivot = evaluateManagerPivot(ctxArg, rosterNow);
      const foundation = getFoundationState(ctxArg, rosterNow);

      const avgAxis = (axis) =>
        rosterCountNow
          ? rosterNow.reduce((acc, p) => acc + domain.axisValue(p, axis), 0) / rosterNow.length
          : 0;

      const teamCoreNow = {
        pow: avgAxis('pow'),
        spe: avgAxis('spe'),
        men: avgAxis('men'),
        soc: avgAxis('soc')
      };

      const axisMass = {
        pow: rosterNow.reduce((acc, r) => acc + domain.axisValue(r, 'pow'), 0),
        spe: rosterNow.reduce((acc, r) => acc + domain.axisValue(r, 'spe'), 0),
        men: rosterNow.reduce((acc, r) => acc + domain.axisValue(r, 'men'), 0),
        soc: rosterNow.reduce((acc, r) => acc + domain.axisValue(r, 'soc'), 0)
      };

      const totalMass = utils.n(axisMass.pow) + utils.n(axisMass.spe) + utils.n(axisMass.men) + utils.n(axisMass.soc);

      const actualShare = (axis) =>
        totalMass <= 0 ? 0 : utils.clamp(utils.n(axisMass[axis] || 0) / totalMass, 0, 1);

      const coreVals = Object.values(teamCoreNow);
      const coreMax = coreVals.length ? Math.max(...coreVals) : 0;
      const coreMin = coreVals.length ? Math.min(...coreVals) : 0;
      const coreRange = coreMax - coreMin || 1;

      const weakness01 = (axis) => utils.clamp((coreMax - utils.n(teamCoreNow[axis])) / coreRange, 0, 1);
      const coverageGap = (axis) => utils.clamp(Math.max(0, ctxArg.desiredShare(axis) - actualShare(axis)), 0, 1);

      const rosterColorCounts = rosterNow.reduce(
        (acc, r) => {
          const c = domain.getColor(r);
          if (!c) return acc;
          acc[c] = (acc[c] || 0) + 1;
          return acc;
        },
        { red: 0, green: 0, blue: 0, yellow: 0 }
      );

      const colorShare01 = (color) =>
        utils.clamp(utils.n(rosterColorCounts[color] || 0) / Math.max(1, rosterCountNow || 1), 0, 1);

      const primaryColors = Object.entries(rosterColorCounts)
        .sort((a, b) => utils.n(b[1]) - utils.n(a[1]))
        .slice(0, 2)
        .map((x) => x[0]);

      const needsRows = [];

      const axisRows = ['soc', 'pow', 'spe', 'men']
        .map((axis) => {
          const dSh = ctxArg.desiredShare(axis);
          const gap = coverageGap(axis);
          const weak = weakness01(axis);

          const isTop = axis === ctxArg.topPriorityAxis ? 1 : 0;
          const isSecond = axis === ctxArg.secondPriorityAxis ? 1 : 0;

          const topAxisSoftener = managerPivot.active && isTop
            ? (1 - 0.34 * utils.n(managerPivot.diversify_pivot_01))
            : 1;

          const secondAxisBooster = managerPivot.active && isSecond
            ? (1 + 0.34 * utils.n(managerPivot.diversify_pivot_01))
            : 1;

          const otherAxisBooster = managerPivot.active && !isTop && !isSecond
            ? (1 + 0.20 * utils.n(managerPivot.diversify_pivot_01))
            : 1;

          const foundationTopAxisBoost =
            !foundation.ready && axis === ctxArg.topPriorityAxis ? 0.12 * utils.n(foundation.need01) : 0;

          const prePivotTopAxisHold =
            foundation.ready && !managerPivot.pivot_ready && axis === ctxArg.topPriorityAxis
              ? (0.05 + 0.05 * (1 - utils.n(foundation.pivotNeed01)) + 0.06 * ctxArg.focus_rigidity_01 + 0.10 * ctxArg.extreme_focus_01)
              : 0;

          const launchSecondBoost =
            managerPivot.launch_ready && !managerPivot.pivot_ready && axis === ctxArg.secondPriorityAxis
              ? 0.02 + 0.04 * utils.n(managerPivot.diversify_pivot_01) * (1 - 0.55 * ctxArg.extreme_focus_01)
              : 0;

          const baseScore = thinRosterNow
            ? utils.clamp(
                0.52 * dSh +
                0.28 * gap +
                0.12 * weak +
                0.05 * isTop +
                0.03 * ctxArg.topPriorityLead01 +
                foundationTopAxisBoost +
                prePivotTopAxisHold +
                launchSecondBoost,
                0, 1
              )
            : utils.clamp(
                0.72 * dSh +
                0.18 * weak +
                0.07 * isTop +
                0.03 * ctxArg.topPriorityLead01 +
                foundationTopAxisBoost +
                prePivotTopAxisHold +
                launchSecondBoost,
                0, 1
              );

          const score = utils.clamp(baseScore * topAxisSoftener * secondAxisBooster * otherAxisBooster, 0, 1);

          return {
            family: 'axis',
            type: 'axis_upgrade',
            axis,
            label:
              axis === 'pow' ? 'Power (POW) Upgrade' :
              axis === 'spe' ? 'Speed (SPE) Upgrade' :
              axis === 'men' ? 'Mental (MEN) Upgrade' :
              'Social (SOC) Upgrade',
            score,
            importance: thinRosterNow
              ? utils.clamp(54 + score * 36, 0, 100)
              : utils.clamp(34 + score * 50, 0, 100)
          };
        })
        .filter((x) => utils.n(ctxArg.axisPriorityAbs[x.axis]) > 0)
        .sort((a, b) => utils.n(b.importance) - utils.n(a.importance));

      axisRows.forEach((x) => needsRows.push(x));

      const colorRows = ['red', 'green', 'blue', 'yellow']
        .map((c) => {
          const axis = domain.colorToAxis[c];
          const sh = colorShare01(c);
          const scarcity = sh <= 0.15 ? (0.15 - sh) / 0.15 : 0;
          const mildSaturationPenalty = sh >= 0.42 ? (sh - 0.42) / 0.58 : 0;
          const focusBonus =
            c === ctxArg.topPriorityColor ? 0.08 :
            c === ctxArg.secondPriorityColor ? 0.04 : 0;

          const foundationColorBoost =
            !foundation.ready && c === ctxArg.topPriorityColor ? 0.10 * utils.n(foundation.need01) : 0;

          const pivotReduction =
            managerPivot.active && c === ctxArg.topPriorityColor
              ? 0.16 * utils.n(managerPivot.diversify_pivot_01)
              : 0;

          const launchSecondColorBoost =
            managerPivot.launch_ready && !managerPivot.pivot_ready && c === ctxArg.secondPriorityColor
              ? (0.04 + 0.04 * utils.n(managerPivot.diversify_pivot_01)) * (1 - 0.55 * ctxArg.extreme_focus_01)
              : 0;

          const v =
            0.70 * ctxArg.desiredShare(axis) +
            0.18 * scarcity +
            focusBonus +
            foundationColorBoost +
            launchSecondColorBoost -
            0.40 * mildSaturationPenalty -
            pivotReduction;

          return {
            family: 'card',
            type: 'color_economy',
            color: c,
            axis,
            label: 'Klassenfarbe: ' + c + ' (' + String(axis).toUpperCase() + ')',
            importance: utils.clamp(22 + v * 56, 0, 92)
          };
        })
        .sort((a, b) => utils.n(b.importance) - utils.n(a.importance));

      if (colorRows[0] && utils.n(colorRows[0].importance) > 26) needsRows.push(colorRows[0]);

      if (ctxArg.totalTeams > 1) {
        const disziRows = domain.DISCIPLINES
          .map((d) => {
            const weights = ctxArg.recipes[d.field] || {};
            const fallbackAxis = domain.colorToAxis[d.color] || 'pow';
            const priorityFit = ctxArg.priorityFitFromWeights01(weights, fallbackAxis);

            const estimatedDynamicSum = metrics.getEstimatedTeamDisziSum(ctxArg, rosterNow, d.field, weights);
            const leagueSums = metrics.getLeagueSumsForField(ctxArg, d.field);
            const gapStats = metrics.getLeagueGapStats(ctxArg, leagueSums, estimatedDynamicSum, fallbackAxis);

            const holeSeverity = utils.clamp((gapStats.currentRankEst - 1) / Math.max(1, ctxArg.totalTeams - 1), 0, 1);
            const share = colorShare01(d.color);
            const relevance = primaryColors.includes(d.color) ? 1 : share > 0 ? 0.65 : 0.35;

            const baseHoleScore =
              holeSeverity *
              (0.34 + 0.66 * priorityFit) *
              relevance;

            const lowFitPenalty01 = priorityFit < 0.35 ? 0.50 : priorityFit < 0.50 ? 0.24 : 0;
            const gated = baseHoleScore * (thinRosterNow ? 0.18 + 0.82 * utils.n(ctxArg.varianceCfg?.holeGate01?.sampled || 1) : 1);
            const holeScore = gated * (1 - lowFitPenalty01);

            const topAxisBonusPts =
              fallbackAxis === ctxArg.topPriorityAxis
                ? (
                    8 +
                    priorityFit * 6 +
                    ctxArg.topPriorityLead01 * 5 +
                    (!foundation.ready ? 5 * foundation.need01 : 0) +
                    (foundation.ready && !managerPivot.pivot_ready
                      ? 4 + 4 * (1 - utils.n(foundation.pivotNeed01)) + 4 * ctxArg.focus_rigidity_01 + 7 * ctxArg.extreme_focus_01
                      : 0)
                  )
                : fallbackAxis === ctxArg.secondPriorityAxis
                  ? (
                      4 +
                      priorityFit * 4 +
                      (managerPivot.launch_ready && !managerPivot.pivot_ready
                        ? (2.5 + 3.0 * utils.n(managerPivot.diversify_pivot_01)) * (1 - 0.55 * ctxArg.extreme_focus_01)
                        : 0)
                    )
                  : 0;

            const pivotCrossAxisBonusPts =
              managerPivot.active && fallbackAxis !== ctxArg.topPriorityAxis
                ? 10 * utils.n(managerPivot.diversify_pivot_01)
                : 0;

            const baseImp =
              thinRosterNow
                ? Math.min(46, utils.clamp(24 + holeScore * 54, 0, 96))
                : utils.clamp(26 + holeScore * 54, 0, 96);

            const importance = utils.clamp(
              baseImp +
              gapStats.attackability01 * 34 +
              topAxisBonusPts +
              pivotCrossAxisBonusPts -
              gapStats.hopeless01 * 28,
              0, 100
            );

            return {
              family: 'diszi',
              type: 'discipline_hole',
              diszi: d.field,
              discipline_weights: weights,
              color: d.color,
              axis: fallbackAxis,
              label: 'Loch stopfen: ' + d.label,
              holeSeverity,
              attackability01: Number(utils.n(gapStats.attackability01).toFixed(3)),
              hopeless01: Number(utils.n(gapStats.hopeless01).toFixed(3)),
              importance: Number(utils.n(importance).toFixed(2))
            };
          })
          .filter(Boolean)
          .sort((a, b) => utils.n(b.importance) - utils.n(a.importance));

        disziRows.slice(0, 5).forEach((x) => {
          if (utils.n(x.holeSeverity) >= 0.20 || utils.n(x.attackability01) >= 0.45) needsRows.push(x);
        });
      }

      needsRows.push({
        family: 'breadth',
        type: 'historical_breadth_opportunity',
        label: 'Scouting: Historical Breadth',
        importance: utils.clamp(18 + (ctxArg.ambition <= 6 ? 10 : 4), 0, 70)
      });

      needsRows.push({
        family: 'peak',
        type: 'historical_peak_opportunity',
        label: 'Scouting: Historical Peak',
        importance: utils.clamp(20 + (ctxArg.ambition >= 6 ? 10 : 4), 0, 72)
      });

      return {
        needs: needsRows.sort((a, b) => utils.n(b.importance) - utils.n(a.importance)).slice(0, 10),
        managerPivot,
        foundation
      };
    };

    const rosterInput =
      (typeof simRosterInput !== 'undefined' && Array.isArray(simRosterInput)) ? simRosterInput :
      (typeof simRoster !== 'undefined' && Array.isArray(simRoster)) ? simRoster :
      ctx.roster;

    const initialPack = buildDynamicNeeds(ctx, rosterInput);

    return {
      ok: true,
      version: ctx.version,
      team: ctx.team,
      roster_count: Array.isArray(rosterInput) ? rosterInput.length : ctx.rosterCount,
      player_min: ctx.player_min,
      target_roster_size: ctx.targetRosterSize,
      top_axis: ctx.topPriorityAxis,
      second_axis: ctx.secondPriorityAxis,
      third_axis: ctx.thirdPriorityAxis,
      top_priority_color: ctx.topPriorityColor,
      second_priority_color: ctx.secondPriorityColor,
      third_priority_color: ctx.thirdPriorityColor,
      top_priority_lead_01: Number(ctx.topPriorityLead01.toFixed(3)),
      focus_rigidity_01: Number(ctx.focus_rigidity_01.toFixed(3)),
      extreme_focus_01: Number(ctx.extreme_focus_01.toFixed(3)),
      foundation: initialPack.foundation,
      manager_pivot: initialPack.managerPivot,
      initial_dynamic_needs: initialPack.needs.slice(0, 10).map((x) => ({
        family: x.family,
        type: x.type,
        axis: x.axis || '',
        color: x.color || '',
        diszi: x.diszi || '',
        label: x.label,
        importance: Number(utils.n(x.importance).toFixed(2)),
        holeSeverity: x.holeSeverity != null ? Number(utils.n(x.holeSeverity).toFixed(3)) : undefined,
        attackability01: x.attackability01 != null ? Number(utils.n(x.attackability01).toFixed(3)) : undefined,
        hopeless01: x.hopeless01 != null ? Number(utils.n(x.hopeless01).toFixed(3)) : undefined,
        realness01: x.realness01 != null ? Number(utils.n(x.realness01).toFixed(3)) : undefined
      })),
      debug: {
        planner_slot_plan_source: plannerRes.slot_plan_source || null,
        planner_budget_tracks_source: plannerRes.budget_tracks_source || null,
        matched_team_row: ctx.debug?.matched_team_row || null,
        rankings_found: !!ctx.rankingsRow,
        total_teams: ctx.totalTeams,
        base_proxy_fields: Object.keys(ctx.baseProxyTop6ByField || {}).length
      }
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'runtime_error',
      error: String(err?.message || err),
      stack: String(err?.stack || '')
    };
  }
})();
