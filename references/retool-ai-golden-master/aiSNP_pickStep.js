// term: aiTeamNeeds
// id: aiSNP_pickStep
// type: datasource
// subtype: JavascriptQuery
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: query
// dependencies: none
// extractionStatus: complete_or_primary_match
return (async () => {
  try {
    const VERSION = 'aiSequentialNeedsPreview.v22_0_direct_clean_chain';

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
    const arr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];

    const runQuery = async (ref, additionalScope = undefined) => {
      if (!ref) return { ok: false, reason: 'query_not_found' };

      if (typeof ref.trigger !== 'function') {
        const cached = ref?.data ?? ref?.value ?? null;
        return cached ?? { ok: false, reason: 'query_has_no_trigger_and_no_cached_value' };
      }

      return additionalScope
        ? await ref.trigger({ additionalScope })
        : await ref.trigger();
    };

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

    const ctx = context.enrichContext(baseCtx);

    const initialRoster = arr(ctx?.roster);
    const rosterCountStart = initialRoster.length;

    const initialBudget = Number(n(ctx?.initial_budget).toFixed(2));
    const playerMin = Math.max(7, n(ctx?.player_min || 8));
    const targetRosterSize = Math.max(playerMin, n(ctx?.targetRosterSize || 11));

    const missingToMin = Math.max(0, playerMin - rosterCountStart);
    const missingToTarget = Math.max(0, targetRosterSize - rosterCountStart);

    const plannedSteps = Math.min(5, Math.max(missingToMin, Math.min(5, missingToTarget)));

    const slotPlan = [];
    for (let i = 0; i < plannedSteps; i++) {
      if (i === 0) slotPlan.push('core');
      else if (i <= 2) slotPlan.push('depth');
      else slotPlan.push('reserve');
    }

    const simSeed =
      (typeof simSeedInput !== 'undefined' && simSeedInput != null)
        ? String(simSeedInput)
        : String(Date.now());

    const qNeeds = (typeof aiSNP_needsCore !== 'undefined' ? aiSNP_needsCore : null);
    const initialNeeds = await runQuery(qNeeds, {
      simRosterInput: initialRoster,
      pickedNamesInput: [],
      remainingBudgetInput: initialBudget,
      stepIdxInput: 0,
      plannedRoleInput: slotPlan[0] || 'core',
      pickedCountInput: 0,
      simSeedInput: simSeed
    });

    const topAxis = s(initialNeeds?.top_axis || '');
    const secondAxis = s(initialNeeds?.second_axis || '');
    const thirdAxis = s(initialNeeds?.third_axis || '');
    const topPriorityColor = s(initialNeeds?.top_color || '');
    const secondPriorityColor = s(initialNeeds?.second_color || '');
    const thirdPriorityColor = s(initialNeeds?.third_color || '');

    const simRoster = [...initialRoster];
    const pickedNames = [];
    const steps = [];
    const laneSpent = { star: 0, core: 0, depth: 0, reserve: 0, diszi: 0 };

    let remainingBudget = initialBudget;

    const qPick = (typeof aiSNP_pickStep !== 'undefined' ? aiSNP_pickStep : null);

    for (let stepIdx = 0; stepIdx < plannedSteps; stepIdx++) {
      const plannedRole = slotPlan[stepIdx] || 'reserve';

      if (remainingBudget <= 0.01) {
        steps.push({
          step: stepIdx + 1,
          slot_role_planned: plannedRole,
          stop_reason: 'budget_exhausted_before_step'
        });
        break;
      }

      const pickRes = await runQuery(qPick, {
        simRosterInput: simRoster,
        pickedNamesInput: pickedNames,
        laneSpentInput: laneSpent,
        remainingBudgetInput: remainingBudget,
        stepIdxInput: stepIdx,
        plannedRoleInput: plannedRole,
        pickedCountInput: pickedNames.length,
        simSeedInput: simSeed
      });

      if (!pickRes?.ok) {
        steps.push({
          step: stepIdx + 1,
          slot_role_planned: plannedRole,
          stop_reason: s(pickRes?.reason || 'pick_step_failed'),
          error: s(pickRes?.error || ''),
          score_debug: pickRes?.score_debug || null
        });
        break;
      }

      const pickedName = s(pickRes?.picked_player);
      const price = n(pickRes?.price);

      if (!pickedName || !(price > 0)) {
        steps.push({
          step: stepIdx + 1,
          slot_role_planned: plannedRole,
          stop_reason: 'invalid_top_pick_payload'
        });
        break;
      }

      const candidatePool =
        arr(ctx?.candidatePool).length
          ? arr(ctx.candidatePool)
          : (
              Array.isArray(aiTransferCandidatePool?.value)
                ? aiTransferCandidatePool.value
                : Array.isArray(aiTransferCandidatePool?.data)
                  ? aiTransferCandidatePool.data
                  : []
            );

      const pickedRow = candidatePool.find((row) => {
        const rowName = s(row?.name || row?.player_name || row?.Name || '');
        const rowPrice = n(row?.marktwert || row?.market_value || row?.mw || row?.MW || row?.price || 0);
        return rowName === pickedName && Math.abs(rowPrice - price) < 0.01;
      });

      if (!pickedRow) {
        steps.push({
          step: stepIdx + 1,
          slot_role_planned: plannedRole,
          picked_player: pickedName,
          price: Number(price.toFixed(2)),
          stop_reason: 'picked_row_not_found_in_candidate_pool'
        });
        break;
      }

      pickedNames.push(pickedName);
      simRoster.push(pickedRow);
      remainingBudget = Number((remainingBudget - price).toFixed(2));
      laneSpent[plannedRole] = Number((n(laneSpent[plannedRole]) + price).toFixed(2));

      steps.push({
        step: stepIdx + 1,
        strategy_key: 'direct_chain',
        slot_role_planned: plannedRole,

        top_axis: s(pickRes?.top_axis || ''),
        top_color: s(pickRes?.top_color || ''),

        active_need_count: n(pickRes?.active_need_count || 0),
        primary_need_count: n(pickRes?.primary_need_count || 0),
        secondary_need_count: n(pickRes?.secondary_need_count || 0),
        side_need_count: n(pickRes?.side_need_count || 0),

        weighted_need_primary: Number(n(pickRes?.weighted_need_primary).toFixed(3)),
        weighted_need_secondary: Number(n(pickRes?.weighted_need_secondary).toFixed(3)),
        weighted_need_side: Number(n(pickRes?.weighted_need_side).toFixed(3)),
        weighted_need_total: Number(n(pickRes?.weighted_need_total).toFixed(3)),

        top_axis_open_hole_count: n(pickRes?.top_axis_open_hole_count || 0),
        top_axis_open_hole_pressure_01: Number(n(pickRes?.top_axis_open_hole_pressure_01).toFixed(3)),
        identity_locked_hole_pressure_01: Number(n(pickRes?.identity_locked_hole_pressure_01).toFixed(3)),
        blue_hole_pressure_01: Number(n(pickRes?.blue_hole_pressure_01).toFixed(3)),

        in_axis_hole_completion_bonus: Number(n(pickRes?.in_axis_hole_completion_bonus).toFixed(3)),
        off_axis_detour_penalty: Number(n(pickRes?.off_axis_detour_penalty).toFixed(3)),

        picked_player: pickedName,
        klasse: s(pickRes?.klasse),
        color: s(pickRes?.color),
        price: Number(price.toFixed(2)),
        fit: Number(n(pickRes?.fit).toFixed(2)),
        score: Number(n(pickRes?.score).toFixed(3)),
        pre_jitter_score: Number(n(pickRes?.pre_jitter_score).toFixed(3)),
        market_role: s(pickRes?.market_role),
        role_band: s(pickRes?.role_band),
        matched_need_count: n(pickRes?.matched_need_count || 0),
        matched_need_labels: arr(pickRes?.matched_need_labels),
        best_diszi_field: s(pickRes?.best_diszi_field),
        best_diszi_score: Number(n(pickRes?.best_diszi_score).toFixed(2)),
        identity_fit_01: Number(n(pickRes?.identity_fit_01).toFixed(3)),
        value_signal_01: Number(n(pickRes?.value_signal_01).toFixed(3)),
        value_bonus: Number(n(pickRes?.value_bonus).toFixed(2)),
        score_jitter: Number(n(pickRes?.score_jitter).toFixed(3)),
        budget_before: Number((remainingBudget + price).toFixed(2)),
        budget_after: Number(remainingBudget.toFixed(2)),
        why_picked:
          `Slot=${plannedRole} ; Role=${s(pickRes?.market_role)} ; MW=${Number(price.toFixed(2))} ; ` +
          `NeedTotal=${Number(n(pickRes?.weighted_need_total).toFixed(3))} ; ` +
          `Best=${s(pickRes?.best_diszi_field)} (${Number(n(pickRes?.best_diszi_score).toFixed(1))}) ; ` +
          `Fit=${Number(n(pickRes?.fit).toFixed(2))} ; Color=${s(pickRes?.color)} ; ` +
          `Labels=${arr(pickRes?.matched_need_labels).slice(0, 3).join(' | ')}`,

        weighted_need_breakdown_top6: arr(pickRes?.weighted_need_breakdown_top6).slice(0, 6),
        ranked_candidates: arr(pickRes?.ranked_candidates).slice(0, 6)
      });
    }

    const pickedSteps = steps.filter((x) => x?.picked_player);
    const totalSpent = pickedSteps.reduce((acc, x) => acc + n(x?.price), 0);

    return {
      ok: true,
      version: VERSION,
      team: s(ctx?.team || ''),
      reason: 'direct_clean_chain_complete',
      sim_seed: simSeed,

      planned_steps: plannedSteps,
      simulated_steps: pickedSteps.length,
      initial_budget: initialBudget,
      total_spent: Number(totalSpent.toFixed(2)),
      remaining_budget: Number(Math.max(0, remainingBudget).toFixed(2)),
      candidate_pool_count:
        arr(ctx?.candidatePool).length ||
        arr(aiTransferCandidatePool?.value).length ||
        arr(aiTransferCandidatePool?.data).length,
      roster_count_start: rosterCountStart,
      roster_count_end: simRoster.length,

      player_min: playerMin,
      target_roster_size: targetRosterSize,

      top_axis: topAxis,
      second_axis: secondAxis,
      third_axis: thirdAxis,
      top_priority_color: topPriorityColor,
      second_priority_color: secondPriorityColor,
      third_priority_color: thirdPriorityColor,

      pow: Number(n(initialNeeds?.team_ratings_raw?.pow).toFixed(2)),
      spe: Number(n(initialNeeds?.team_ratings_raw?.spe).toFixed(2)),
      men: Number(n(initialNeeds?.team_ratings_raw?.men).toFixed(2)),
      soc: Number(n(initialNeeds?.team_ratings_raw?.soc).toFixed(2)),

      top_priority_lead_01: Number(n(initialNeeds?.top_priority_lead_01).toFixed(6)),
      focus_rigidity_01: Number(n(initialNeeds?.focus_rigidity_01).toFixed(6)),
      extreme_focus_01: Number(n(initialNeeds?.extreme_focus_01).toFixed(6)),

      slot_plan_source: 'preview_autobuild_clean',
      slot_plan_used: slotPlan,
      budget_tracks_source: 'direct_clean_chain',
      budget_tracks: {},
      lane_spent_final: laneSpent,
      picked_names: pickedNames,

      steps,

      debug: {
        preview_fill_target: rosterCountStart < playerMin,
        upstream_planned_steps: missingToMin,
        auto_step_planner_active: true,
        upstream_slot_plan_too_short: false,
        needs_query_used: 'aiSNP_needsCore',
        score_query_used: 'aiSNP_pickScoreEngine',
        pick_query_used: 'aiSNP_pickStep',
        market_role_truth: 'player_stats_history_percentiles_only'
      }
    };
  } catch (err) {
    return {
      ok: false,
      version: 'aiSequentialNeedsPreview.v22_0_direct_clean_chain',
      reason: 'runtime_error',
      error: String(err?.message || err),
      stack: String(err?.stack || '')
    };
  }
})();
