// term: aiTeamNeeds
// id: aiSNP_needsCore
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
    const VERSION = 'aiSNP_pickStep.v22_0_direct_clean';

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

    const simRosterSafe =
      (typeof simRosterInput !== 'undefined' && Array.isArray(simRosterInput))
        ? simRosterInput
        : arr(ctx?.roster);

    const pickedNamesSafe =
      (typeof pickedNamesInput !== 'undefined' && Array.isArray(pickedNamesInput))
        ? pickedNamesInput
        : [];

    const laneSpentSafe =
      (typeof laneSpentInput !== 'undefined' && laneSpentInput && typeof laneSpentInput === 'object')
        ? laneSpentInput
        : { star: 0, core: 0, depth: 0, reserve: 0, diszi: 0 };

    const remainingBudgetSafe =
      (typeof remainingBudgetInput !== 'undefined')
        ? n(remainingBudgetInput)
        : n(ctx?.initial_budget);

    const stepIdxSafe =
      (typeof stepIdxInput !== 'undefined')
        ? n(stepIdxInput)
        : 0;

    const plannedRoleSafe =
      (typeof plannedRoleInput !== 'undefined' && s(plannedRoleInput))
        ? s(plannedRoleInput)
        : 'depth';

    const pickedCountSafe =
      (typeof pickedCountInput !== 'undefined')
        ? n(pickedCountInput)
        : pickedNamesSafe.length;

    const simSeedSafe =
      (typeof simSeedInput !== 'undefined' && simSeedInput != null)
        ? String(simSeedInput)
        : String(Date.now());

    const sharedScope = {
      simRosterInput: simRosterSafe,
      pickedNamesInput: pickedNamesSafe,
      laneSpentInput: laneSpentSafe,
      remainingBudgetInput: remainingBudgetSafe,
      stepIdxInput: stepIdxSafe,
      plannedRoleInput: plannedRoleSafe,
      pickedCountInput: pickedCountSafe,
      simSeedInput: simSeedSafe
    };

    const qNeeds = (typeof aiSNP_needsCore !== 'undefined' ? aiSNP_needsCore : null);
    const qScore = (typeof aiSNP_pickScoreEngine !== 'undefined' ? aiSNP_pickScoreEngine : null);

    const needsRes = await runQuery(qNeeds, sharedScope);
    if (!needsRes?.ok) {
      return {
        ok: false,
        version: VERSION,
        reason: 'needs_core_failed',
        error: String(needsRes?.error || ''),
        needs_reason: String(needsRes?.reason || ''),
        debug_scope: sharedScope
      };
    }

    let scoreRes;
    let scoreTriggerError = '';

    try {
      scoreRes = await runQuery(qScore, sharedScope);
    } catch (err) {
      scoreTriggerError = String(err?.message || err);
    }

    if (scoreTriggerError) {
      return {
        ok: false,
        version: VERSION,
        reason: 'score_engine_trigger_threw',
        error: scoreTriggerError,
        debug_scope: sharedScope
      };
    }

    if (typeof scoreRes === 'undefined') {
      return {
        ok: false,
        version: VERSION,
        reason: 'score_engine_returned_undefined',
        debug_scope: sharedScope
      };
    }

    if (!scoreRes || typeof scoreRes !== 'object') {
      return {
        ok: false,
        version: VERSION,
        reason: 'score_engine_returned_non_object',
        score_type: typeof scoreRes,
        score_value: scoreRes,
        debug_scope: sharedScope
      };
    }

    if (!scoreRes?.ok) {
      return {
        ok: false,
        version: VERSION,
        reason: 'score_engine_failed',
        error: String(scoreRes?.error || ''),
        score_reason: String(scoreRes?.reason || ''),
        score_version: String(scoreRes?.version || ''),
        score_debug: scoreRes?.debug || null,
        debug_scope: sharedScope
      };
    }

    const chosen = scoreRes?.chosen_pick || null;
    if (!chosen || !s(chosen?.player_name || chosen?.picked_player) || !(n(chosen?.price) > 0)) {
      return {
        ok: false,
        version: VERSION,
        reason: 'invalid_top_pick_payload',
        chosen_preview: chosen,
        debug_scope: sharedScope
      };
    }

    return {
      ok: true,
      version: VERSION,
      reason: 'direct_clean_pick_step',
      team: s(ctx?.team || ''),

      picked_player: s(chosen?.player_name || chosen?.picked_player),
      klasse: s(chosen?.klasse),
      color: s(chosen?.color),
      price: Number(n(chosen?.price).toFixed(2)),
      fit: Number(n(chosen?.fit).toFixed(2)),
      score: Number(n(chosen?.score).toFixed(3)),
      pre_jitter_score: Number(n(chosen?.preJitterScore || chosen?.pre_jitter_score).toFixed(3)),

      matched_need_count: n(chosen?.matchedNeedCount || chosen?.matched_need_count),
      matched_need_labels: arr(chosen?.matched_need_labels),

      weighted_need_primary: Number(n(chosen?.weighted_need_primary).toFixed(3)),
      weighted_need_secondary: Number(n(chosen?.weighted_need_secondary).toFixed(3)),
      weighted_need_side: Number(n(chosen?.weighted_need_side).toFixed(3)),
      weighted_need_total: Number(n(chosen?.weighted_need_total).toFixed(3)),

      in_axis_hole_completion_bonus: Number(n(chosen?.in_axis_hole_completion_bonus).toFixed(3)),
      off_axis_detour_penalty: Number(n(chosen?.off_axis_detour_penalty).toFixed(3)),
      top_axis_open_hole_pressure_01: Number(n(chosen?.top_axis_open_hole_pressure_01).toFixed(3)),

      best_diszi_field: s(chosen?.bestDisziField || chosen?.best_diszi_field),
      best_diszi_score: Number(n(chosen?.bestDisziScore || chosen?.best_diszi_score).toFixed(2)),
      market_role: s(chosen?.market_role),
      role_band: s(chosen?.role_band),
      identity_fit_01: Number(n(chosen?.identityFit01 || chosen?.identity_fit_01).toFixed(3)),
      value_signal_01: Number(n(chosen?.value_signal_01).toFixed(3)),
      value_bonus: Number(n(chosen?.value_bonus).toFixed(2)),
      score_jitter: Number(n(chosen?.score_jitter).toFixed(3)),

      ranked_candidates: arr(scoreRes?.ranked_candidates).slice(0, 12),

      top_axis: s(scoreRes?.top_axis || needsRes?.top_axis || ''),
      top_color: s(scoreRes?.top_color || needsRes?.top_color || ''),
      active_need_count: n(scoreRes?.active_need_count || needsRes?.active_need_count || 0),
      primary_need_count: n(scoreRes?.primary_need_count || needsRes?.primary_need_count || 0),
      secondary_need_count: n(scoreRes?.secondary_need_count || needsRes?.secondary_need_count || 0),
      side_need_count: n(scoreRes?.side_need_count || needsRes?.side_need_count || 0),

      weighted_need_primary_ctx: Number(n(scoreRes?.weighted_need_primary_ctx || needsRes?.weighted_need_primary).toFixed(3)),
      weighted_need_secondary_ctx: Number(n(scoreRes?.weighted_need_secondary_ctx || needsRes?.weighted_need_secondary).toFixed(3)),
      weighted_need_side_ctx: Number(n(scoreRes?.weighted_need_side_ctx || needsRes?.weighted_need_side).toFixed(3)),
      weighted_need_total_ctx: Number(n(scoreRes?.weighted_need_total_ctx || needsRes?.weighted_need_total).toFixed(3)),

      top_axis_open_hole_count: n(scoreRes?.top_axis_open_hole_count || needsRes?.top_axis_open_hole_count || 0),
      identity_locked_hole_pressure_01: Number(n(scoreRes?.identity_locked_hole_pressure_01 || needsRes?.identity_locked_hole_pressure_01 || 0).toFixed(3)),
      blue_hole_pressure_01: Number(n(scoreRes?.blue_hole_pressure_01 || needsRes?.blue_hole_pressure_01 || 0).toFixed(3)),

      weighted_need_breakdown_top6: arr(scoreRes?.debug?.weighted_need_breakdown_top6 || needsRes?.weighted_need_breakdown_top6).slice(0, 6),

      debug_scope: sharedScope
    };
  } catch (err) {
    return {
      ok: false,
      version: 'aiSNP_pickStep.v22_0_direct_clean',
      reason: 'runtime_error',
      error: String(err?.message || err),
      stack: String(err?.stack || '')
    };
  }
})();
