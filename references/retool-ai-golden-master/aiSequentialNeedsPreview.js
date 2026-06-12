// term: aiTeamNeeds
// id: aiSequentialNeedsPreview
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
    const VERSION = 'aiSNP_debugSequentialChain.v4_score_factor_breakdown_clean';

    const n = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
    const s = (v) => String(v ?? '').trim();
    const lower = (v) => String(v ?? '').trim().toLowerCase();
    const arr = (v) => Array.isArray(v) ? v.filter(Boolean) : [];
    const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};

    const runRef = async (name, ref, additionalScope = undefined) => {
      if (!ref) {
        return { ok: false, query: name, reason: 'query_not_found' };
      }

      if (typeof ref.trigger !== 'function') {
        return {
          ok: true,
          query: name,
          reason: 'no_trigger_using_cached_value',
          result: ref?.data ?? ref?.value ?? null
        };
      }

      try {
        const res = additionalScope
          ? await ref.trigger({ additionalScope })
          : await ref.trigger();

        return {
          ok: true,
          query: name,
          result: res ?? ref?.data ?? ref?.value ?? null
        };
      } catch (err) {
        return {
          ok: false,
          query: name,
          reason: 'trigger_failed',
          error: String(err?.message || err),
          stack: String(err?.stack || '')
        };
      }
    };

    const getRoleBenchData = () => {
      const src =
        (typeof aiSNP_roleBenchmarks !== 'undefined'
          ? (aiSNP_roleBenchmarks?.data ?? aiSNP_roleBenchmarks?.value ?? {})
          : {});

      const quick = obj(src?.quick_summary);
      const pct = obj(src?.mw_percentiles);

      return {
        core_from: n(quick?.core_from ?? src?.core ?? pct?.p55),
        depth_from: n(quick?.depth_from ?? src?.depth ?? pct?.p35),
        backup_from: n(quick?.backup_from ?? src?.backup ?? pct?.p25),
        reserve_below: n(quick?.reserve_below ?? src?.reserve_below ?? pct?.p15),
        star_from: n(quick?.star_from ?? src?.star ?? pct?.p87_5 ?? pct?.p875),
        superstar_from: n(quick?.superstar_from ?? src?.superstar ?? pct?.p97_5 ?? pct?.p975)
      };
    };

    const compactNeed = (row) => ({
      family: s(row?.family),
      type: s(row?.type),
      axis: s(row?.axis),
      diszi: s(row?.diszi),
      color: s(row?.color),
      label: s(row?.label),
      importance: Number(n(row?.importance).toFixed(2)),
      need01: Number(n(row?.need01).toFixed(3)),
      weighted_score: Number(n(row?.weighted_score ?? (n(row?.importance) * Math.max(0, n(row?.need01)))).toFixed(2))
    });

    const compactCandidate = (row, idx = 0) => ({
      rank: n(row?.rank || idx + 1),
      player_name: s(row?.player_name || row?.picked_player || row?.name),
      klasse: s(row?.klasse || row?.class),
      color: s(row?.color),
      price: Number(n(row?.price ?? row?.marktwert ?? row?.mw).toFixed(2)),
      fit: Number(n(row?.fit).toFixed(2)),
      score: Number(n(row?.score).toFixed(3)),
      matched_need_count: n(row?.matched_need_count ?? row?.matchedNeedCount),
      best_diszi_field: s(row?.best_diszi_field ?? row?.bestDisziField),
      best_diszi_score: Number(n(row?.best_diszi_score ?? row?.bestDisziScore).toFixed(2)),
      market_role: s(row?.market_role),
      role_band: s(row?.role_band),
      weighted_need_total: Number(n(row?.weighted_need_total).toFixed(3)),
      need_score_applied: Number(n(
        row?.need_score_applied ??
        row?.need_score_applied_current ??
        row?.need_score_current ??
        row?.need_score
      ).toFixed(3)),
      weighted_need_avg_per_need: Number(n(row?.weighted_need_avg_per_need).toFixed(3)),
      weighted_need_norm_guess_100: Number(n(row?.weighted_need_norm_guess_100).toFixed(3)),
      in_axis_hole_completion_bonus: Number(n(row?.in_axis_hole_completion_bonus).toFixed(2)),
      best_diszi_hole_solve_bonus: Number(n(row?.best_diszi_hole_solve_bonus ?? row?.bestDisziHoleSolveBonus).toFixed(2)),
      off_axis_detour_penalty: Number(n(row?.off_axis_detour_penalty).toFixed(2)),
      role_mismatch_penalty: Number(n(row?.role_mismatch_penalty).toFixed(2)),
      overpay_penalty: Number(n(row?.overpay_penalty).toFixed(2)),
      value_bonus: Number(n(row?.value_bonus).toFixed(2)),
      fit_penalty: Number(n(row?.fit_penalty ?? row?.negative_fit_penalty).toFixed(2)),
      score_jitter: Number(n(row?.score_jitter).toFixed(3)),
      top_axis_open_hole_pressure_01: Number(n(row?.top_axis_open_hole_pressure_01).toFixed(3)),
      identity_locked_hole_pressure_01: Number(n(row?.identity_locked_hole_pressure_01).toFixed(3)),
      blue_hole_pressure_01: Number(n(row?.blue_hole_pressure_01).toFixed(3)),
      value_signal_01: Number(n(row?.value_signal_01).toFixed(3)),
      identity_fit_01: Number(n(row?.identity_fit_01 ?? row?.identityFit01).toFixed(3))
    });

    const getChosenPickRow = (score) => {
      const chosen = obj(score?.chosen_pick);
      if (Object.keys(chosen).length) return chosen;

      const ranked = arr(score?.ranked_candidates);
      if (ranked.length) return ranked[0];

      if (s(score?.picked_player || score?.player_name)) {
        return {
          player_name: s(score?.picked_player || score?.player_name),
          klasse: s(score?.klasse),
          color: s(score?.color),
          price: n(score?.price),
          fit: n(score?.fit),
          score: n(score?.score),
          pre_jitter_score: n(score?.pre_jitter_score ?? score?.preJitterScore),
          preJitterScore: n(score?.pre_jitter_score ?? score?.preJitterScore),
          matched_need_count: n(score?.matched_need_count ?? score?.matchedNeedCount),
          matched_need_labels: arr(score?.matched_need_labels),
          best_diszi_field: s(score?.best_diszi_field ?? score?.bestDisziField),
          best_diszi_score: n(score?.best_diszi_score ?? score?.bestDisziScore),
          market_role: s(score?.market_role),
          role_band: s(score?.role_band),
          weighted_need_primary: n(score?.weighted_need_primary),
          weighted_need_secondary: n(score?.weighted_need_secondary),
          weighted_need_side: n(score?.weighted_need_side),
          weighted_need_total: n(score?.weighted_need_total),
          weighted_need_avg_per_need: n(score?.weighted_need_avg_per_need),
          weighted_need_norm_guess_100: n(score?.weighted_need_norm_guess_100),
          need_score_applied: n(score?.need_score_applied ?? score?.need_score_applied_current ?? score?.need_score_current ?? score?.need_score),
          best_diszi_hole_solve_bonus: n(score?.best_diszi_hole_solve_bonus ?? score?.bestDisziHoleSolveBonus),
          in_axis_hole_completion_bonus: n(score?.in_axis_hole_completion_bonus),
          off_axis_detour_penalty: n(score?.off_axis_detour_penalty),
          role_mismatch_penalty: n(score?.role_mismatch_penalty),
          overpay_penalty: n(score?.overpay_penalty),
          value_bonus: n(score?.value_bonus),
          fit_penalty: n(score?.fit_penalty ?? score?.negative_fit_penalty),
          hard_block_penalty: n(score?.hard_block_penalty),
          score_jitter: n(score?.score_jitter),
          top_axis_open_hole_pressure_01: n(score?.top_axis_open_hole_pressure_01),
          identity_locked_hole_pressure_01: n(score?.identity_locked_hole_pressure_01),
          blue_hole_pressure_01: n(score?.blue_hole_pressure_01),
          value_signal_01: n(score?.value_signal_01),
          identity_fit_01: n(score?.identity_fit_01 ?? score?.identityFit01)
        };
      }

      return {};
    };

    const buildWhyPicked = ({
      strategyKey,
      slotRolePlanned,
      marketRole,
      matchedNeedCount,
      bestDisziField,
      bestDisziScore,
      fit,
      valueBonus,
      valueSignal,
      topAxis,
      topColor,
      matchedNeedLabels,
      weightedNeedTotalRaw,
      weightedNeedAvgPerNeed,
      weightedNeedNormGuess100,
      needScoreApplied,
      bestDisziHoleSolveBonus,
      inAxisHoleCompletionBonus,
      offAxisDetourPenalty,
      roleMismatchPenalty,
      overpayPenalty,
      fitPenalty,
      topAxisOpenHolePressure01
    }) => {
      const reasons = [];

      if (strategyKey) reasons.push(`Strategie=${strategyKey}`);
      if (slotRolePlanned) reasons.push(`Slot=${slotRolePlanned}`);
      if (marketRole) reasons.push(`Role=${marketRole}`);
      if (matchedNeedCount > 0) reasons.push(`${matchedNeedCount} Need-Matches`);
      if (bestDisziField) reasons.push(`Best=${bestDisziField} (${Number(n(bestDisziScore).toFixed(1))})`);
      if (Number.isFinite(n(fit))) reasons.push(`Fit=${Number(n(fit).toFixed(2))}`);
      if (n(weightedNeedTotalRaw) > 0) reasons.push(`NeedRaw=${Number(n(weightedNeedTotalRaw).toFixed(2))}`);
      if (n(weightedNeedAvgPerNeed) > 0) reasons.push(`NeedAvg=${Number(n(weightedNeedAvgPerNeed).toFixed(2))}`);
      if (n(weightedNeedNormGuess100) > 0) reasons.push(`Need100~=${Number(n(weightedNeedNormGuess100).toFixed(2))}`);
      if (n(needScoreApplied) > 0) reasons.push(`NeedApplied=${Number(n(needScoreApplied).toFixed(2))}`);
      if (n(bestDisziHoleSolveBonus) > 0) reasons.push(`BestDisziBonus=${Number(n(bestDisziHoleSolveBonus).toFixed(2))}`);
      if (n(inAxisHoleCompletionBonus) > 0) reasons.push(`InAxisBonus=${Number(n(inAxisHoleCompletionBonus).toFixed(2))}`);
      if (n(offAxisDetourPenalty) > 0) reasons.push(`OffAxisMalus=${Number(n(offAxisDetourPenalty).toFixed(2))}`);
      if (n(roleMismatchPenalty) > 0) reasons.push(`RoleMalus=${Number(n(roleMismatchPenalty).toFixed(2))}`);
      if (n(overpayPenalty) > 0) reasons.push(`OverpayMalus=${Number(n(overpayPenalty).toFixed(2))}`);
      if (n(fitPenalty) > 0) reasons.push(`FitMalus=${Number(n(fitPenalty).toFixed(2))}`);
      if (n(topAxisOpenHolePressure01) > 0) reasons.push(`HolePressure=${Number(n(topAxisOpenHolePressure01).toFixed(3))}`);
      if (n(valueBonus) > 0) reasons.push(`ValueBonus=${Number(n(valueBonus).toFixed(2))}`);
      if (n(valueSignal) > 0) reasons.push(`ValueSignal=${Number(n(valueSignal).toFixed(3))}`);
      if (topAxis || topColor) reasons.push(`Fokus=${topAxis || '-'} / ${topColor || '-'}`);

      const labels = arr(matchedNeedLabels).filter(Boolean).slice(0, 3);
      if (labels.length) reasons.push(`Labels=${labels.join(' | ')}`);

      return reasons.join(' ; ');
    };

    const findCandidateRow = (candidatePool, pickedPlayer, pickedClass, pickedPrice) => {
      const nameNeedle = lower(pickedPlayer);
      const classNeedle = lower(pickedClass);

      const matches = arr(candidatePool).filter((row) => {
        const rowName = lower(row?.name || row?.player_name || row?.Name);
        if (rowName !== nameNeedle) return false;

        if (classNeedle) {
          const rowClass = lower(row?.klasse || row?.Klasse || row?.class);
          if (rowClass && rowClass !== classNeedle) return false;
        }

        return true;
      });

      if (!matches.length) return null;
      if (matches.length === 1) return matches[0];

      if (pickedPrice > 0) {
        const exact = matches.find((row) => {
          const rowPrice = n(
            row?.marktwert ||
            row?.market_value ||
            row?.mw ||
            row?.MW ||
            row?.price ||
            0
          );
          return Math.abs(rowPrice - pickedPrice) < 0.01;
        });
        if (exact) return exact;
      }

      return matches[0];
    };

    const refs = {
      planner: (typeof aiSNP_planner !== 'undefined' ? aiSNP_planner : null),
      strategy: (typeof aiSNP_strategyProfile !== 'undefined' ? aiSNP_strategyProfile : null),
      needsCore: (typeof aiSNP_needsCore !== 'undefined' ? aiSNP_needsCore : null),
      score: (typeof aiSNP_pickScoreEngine !== 'undefined' ? aiSNP_pickScoreEngine : null),
      roleBench: (typeof aiSNP_roleBenchmarks !== 'undefined' ? aiSNP_roleBenchmarks : null)
    };

    const existence = Object.entries(refs).map(([name, ref]) => ({
      query: name,
      exists: !!ref,
      hasTrigger: !!ref?.trigger
    }));

    const plannerRun = await runRef('aiSNP_planner', refs.planner);
    const planner = plannerRun?.result ?? {};

    if (!plannerRun?.ok || !planner?.ok) {
      return {
        ok: false,
        reason: 'planner_failed',
        existence,
        planner_run: plannerRun
      };
    }

    const strategyRun0 = await runRef('aiSNP_strategyProfile', refs.strategy, {
      simSeedInput: String(Date.now()),
      stepIdxInput: 0,
      simRosterInput: Array.isArray(getActivePlayersByTeam?.data) ? getActivePlayersByTeam.data : [],
      remainingBudgetInput: n(transfermarktSalaryBudgetLogic?.value?.budget_after_sales ?? getCashFromSaisonstand?.value?.cash ?? 0)
    });

    const strategy0 = strategyRun0?.result ?? {};

    const activeRoster = Array.isArray(getActivePlayersByTeam?.data) ? getActivePlayersByTeam.data : [];
    const candidatePool =
      Array.isArray(aiTransferCandidatePool?.value) ? aiTransferCandidatePool.value :
      Array.isArray(aiTransferCandidatePool?.data) ? aiTransferCandidatePool.data :
      [];

    const simRoster = [...activeRoster];
    const pickedNames = [];
    const laneSpent = { star: 0, core: 0, depth: 0, reserve: 0, diszi: 0 };

    let remainingBudget = n(
      transfermarktSalaryBudgetLogic?.value?.budget_after_sales ??
      getCashFromSaisonstand?.value?.cash ??
      0
    );

    const plannedSteps = n(planner?.planned_steps || 0);
    const simSeed = s(strategy0?.sim_seed || Date.now());
    const slotPlan = arr(planner?.slot_plan_used);

    const roleBench = getRoleBenchData();
    const step_debug_rows = [];

    for (let stepIdx = 0; stepIdx < plannedSteps; stepIdx++) {
      const plannedRole = s(slotPlan[stepIdx] || '');

      const scope = {
        simRosterInput: simRoster,
        pickedNamesInput: pickedNames,
        laneSpentInput: laneSpent,
        remainingBudgetInput: remainingBudget,
        stepIdxInput: stepIdx,
        plannedRoleInput: plannedRole,
        pickedCountInput: pickedNames.length,
        simSeedInput: simSeed
      };

      const strategyRun = await runRef('aiSNP_strategyProfile', refs.strategy, scope);
      const needsRun = await runRef('aiSNP_needsCore', refs.needsCore, scope);
      const scoreRun = await runRef('aiSNP_pickScoreEngine', refs.score, scope);

      const strategy = strategyRun?.result ?? {};
      const needs = needsRun?.result ?? {};
      const score = scoreRun?.result ?? {};

      if (!scoreRun?.ok || !score?.ok) {
        step_debug_rows.push({
          step: stepIdx + 1,
          slot_role_planned: plannedRole,
          stop_reason: score?.reason || scoreRun?.reason || 'score_failed',
          reason: score?.reason || '',
          error: score?.error || scoreRun?.error || '',
          top_axis: s(needs?.top_axis || needs?.topAxis || ''),
          active_need_count: n(needs?.active_need_count || needs?.activeNeeds?.length || 0)
        });
        break;
      }

      const chosen = getChosenPickRow(score);

      const pickedPlayer = s(chosen?.player_name || chosen?.picked_player);
      const pickedClass = s(chosen?.klasse);
      const pickedColor = s(chosen?.color);
      const pickedPrice = n(chosen?.price ?? chosen?.marktwert ?? chosen?.mw);
      const pickedFit = n(chosen?.fit);
      const pickedScore = n(chosen?.score);
      const preJitterScore = n(chosen?.pre_jitter_score ?? chosen?.preJitterScore);
      const matchedNeedCount = n(chosen?.matched_need_count ?? chosen?.matchedNeedCount);
      const matchedNeedLabels = arr(chosen?.matched_need_labels);
      const bestDisziField = s(chosen?.best_diszi_field ?? chosen?.bestDisziField);
      const bestDisziScore = n(chosen?.best_diszi_score ?? chosen?.bestDisziScore);
      const marketRole = s(chosen?.market_role);
      const roleBand = s(chosen?.role_band);
      const valueSignal = n(chosen?.value_signal_01);
      const valueBonus = n(chosen?.value_bonus);
      const identityFit = n(chosen?.identity_fit_01 ?? chosen?.identityFit01);
      const scoreJitter = n(chosen?.score_jitter);

      const weightedNeedPrimary = n(chosen?.weighted_need_primary ?? score?.weighted_need_primary);
      const weightedNeedSecondary = n(chosen?.weighted_need_secondary ?? score?.weighted_need_secondary);
      const weightedNeedSide = n(chosen?.weighted_need_side ?? score?.weighted_need_side);
      const weightedNeedTotal = n(chosen?.weighted_need_total ?? score?.weighted_need_total);
      const weightedNeedAvgPerNeed = n(chosen?.weighted_need_avg_per_need ?? score?.weighted_need_avg_per_need);
      const weightedNeedNormGuess100 = n(chosen?.weighted_need_norm_guess_100 ?? score?.weighted_need_norm_guess_100);

      const needScoreApplied = n(
        chosen?.need_score_applied ??
        chosen?.need_score_applied_current ??
        chosen?.need_score_current ??
        chosen?.need_score ??
        score?.need_score_applied ??
        score?.need_score_applied_current ??
        score?.need_score_current ??
        score?.need_score
      );

      const inAxisHoleCompletionBonus = n(chosen?.in_axis_hole_completion_bonus ?? score?.in_axis_hole_completion_bonus);
      const bestDisziHoleSolveBonus = n(
        chosen?.best_diszi_hole_solve_bonus ??
        chosen?.bestDisziHoleSolveBonus ??
        score?.best_diszi_hole_solve_bonus ??
        score?.bestDisziHoleSolveBonus
      );
      const offAxisDetourPenalty = n(chosen?.off_axis_detour_penalty ?? score?.off_axis_detour_penalty);
      const roleMismatchPenalty = n(chosen?.role_mismatch_penalty ?? score?.role_mismatch_penalty);
      const overpayPenalty = n(chosen?.overpay_penalty ?? score?.overpay_penalty);
      const fitPenalty = n(chosen?.fit_penalty ?? chosen?.negative_fit_penalty ?? score?.fit_penalty ?? score?.negative_fit_penalty);
      const hardBlockPenalty = n(
        chosen?.hard_block_penalty ??
        (chosen?.negative_fit_hard_block ? 9999 : 0) ??
        score?.hard_block_penalty ??
        (score?.negative_fit_hard_block ? 9999 : 0)
      );

      const topAxisOpenHolePressure01 = n(chosen?.top_axis_open_hole_pressure_01 ?? score?.top_axis_open_hole_pressure_01 ?? needs?.top_axis_open_hole_pressure_01);
      const identityLockedHolePressure01 = n(chosen?.identity_locked_hole_pressure_01 ?? score?.identity_locked_hole_pressure_01 ?? needs?.identity_locked_hole_pressure_01);
      const blueHolePressure01 = n(chosen?.blue_hole_pressure_01 ?? score?.blue_hole_pressure_01 ?? needs?.blue_hole_pressure_01);
      const topAxisOpenHoleCount = n(chosen?.top_axis_open_hole_count ?? score?.top_axis_open_hole_count ?? needs?.top_axis_open_hole_count);

      const topNeeds = arr(
        needs?.weighted_need_breakdown_top6 ||
        needs?.weighted_need_breakdown_top12 ||
        score?.top_needs_for_debug ||
        []
      ).slice(0, 6).map(compactNeed);

      const topCandidates = arr(score?.ranked_candidates).slice(0, 6).map((row, idx) => compactCandidate(row, idx));

      const positiveBlocks = [
        { block: 'weighted_need_total_raw', points: Number(weightedNeedTotal.toFixed(3)), note: 'Rohsumme aller Need-Beiträge der max. 15 Scoring-Needs' },
        { block: 'weighted_need_avg_per_need', points: Number(weightedNeedAvgPerNeed.toFixed(3)), note: 'Rohsumme / verwendete Need-Anzahl' },
        { block: 'weighted_need_norm_guess_100', points: Number(weightedNeedNormGuess100.toFixed(3)), note: 'grobe 0-100 Sicht via /10' },
        { block: 'need_score_applied_current', points: Number(needScoreApplied.toFixed(3)), note: 'aktueller Need-Beitrag im Score' },
        { block: 'best_diszi_hole_solve_bonus', points: Number(bestDisziHoleSolveBonus.toFixed(3)), note: 'Bonus für stärksten einzelnen Diszi-Need' },
        { block: 'in_axis_hole_completion_bonus', points: Number(inAxisHoleCompletionBonus.toFixed(3)), note: 'Extra-Bonus wenn Top-Axis-Loch direkt getroffen wird' },
        { block: 'value_bonus', points: Number(valueBonus.toFixed(3)), note: 'Bonus für gutes Preis-/Slot-Verhältnis' }
      ];

      const penaltyBlocks = [
        { block: 'fit_penalty', points: Number((-fitPenalty).toFixed(3)), note: 'Malus für negativen Teamfit' },
        { block: 'off_axis_detour_penalty', points: Number((-offAxisDetourPenalty).toFixed(3)), note: 'Malus für thematischen Umweg' },
        { block: 'role_mismatch_penalty', points: Number((-roleMismatchPenalty).toFixed(3)), note: 'Malus wenn Marktrolle nicht zum Slot passt' },
        { block: 'overpay_penalty', points: Number((-overpayPenalty).toFixed(3)), note: 'Preis-/Overpay-Malus' },
        { block: 'hard_block_penalty', points: Number((hardBlockPenalty ? -9999 : 0).toFixed(3)), note: '0 oder -9999' }
      ];

      const finalBlocks = [
        ...positiveBlocks,
        ...penaltyBlocks,
        { block: 'score_jitter', points: Number(scoreJitter.toFixed(3)), note: 'kleines Seed-Rauschen' },
        { block: 'pre_jitter_score', points: Number(preJitterScore.toFixed(3)), note: 'Score vor Jitter' },
        { block: 'final_score', points: Number(pickedScore.toFixed(3)), note: 'Score nach Jitter' }
      ];

      const why_picked = buildWhyPicked({
        strategyKey: s(strategy?.key || strategy?.strategy?.key || score?.debug?.strategy_key),
        slotRolePlanned: plannedRole,
        marketRole,
        matchedNeedCount,
        bestDisziField,
        bestDisziScore,
        fit: pickedFit,
        valueBonus,
        valueSignal,
        topAxis: s(needs?.top_axis || needs?.topAxis || score?.top_axis),
        topColor: s(needs?.top_color || needs?.topColor || score?.top_color),
        matchedNeedLabels,
        weightedNeedTotalRaw: weightedNeedTotal,
        weightedNeedAvgPerNeed,
        weightedNeedNormGuess100,
        needScoreApplied,
        bestDisziHoleSolveBonus,
        inAxisHoleCompletionBonus,
        offAxisDetourPenalty,
        roleMismatchPenalty,
        overpayPenalty,
        fitPenalty,
        topAxisOpenHolePressure01
      });

      step_debug_rows.push({
        step: stepIdx + 1,
        strategy_key: s(strategy?.key || strategy?.strategy?.key || score?.debug?.strategy_key),
        strategy_roll: Number(n(strategy?.strategy_roll || score?.debug?.strategy_roll).toFixed(5)),
        slot_role_planned: plannedRole,

        top_axis: s(needs?.top_axis || needs?.topAxis || score?.top_axis),
        top_color: s(needs?.top_color || needs?.topColor || score?.top_color),
        active_need_count: n(score?.active_need_count ?? needs?.active_need_count ?? arr(needs?.active_needs).length),
        primary_need_count: n(score?.primary_need_count ?? needs?.primary_need_count ?? arr(needs?.primary_needs).length),
        secondary_need_count: n(score?.secondary_need_count ?? needs?.secondary_need_count ?? arr(needs?.secondary_needs).length),
        side_need_count: n(score?.side_need_count ?? needs?.side_need_count ?? arr(needs?.side_needs).length),

        need_count_used_for_scoring: s(score?.need_count_used_for_scoring || 'aktuell max. 15 Needs pro Kandidat'),
        weighted_need_primary: Number(weightedNeedPrimary.toFixed(3)),
        weighted_need_secondary: Number(weightedNeedSecondary.toFixed(3)),
        weighted_need_side: Number(weightedNeedSide.toFixed(3)),
        weighted_need_total: Number(weightedNeedTotal.toFixed(3)),
        weighted_need_avg_per_need: Number(weightedNeedAvgPerNeed.toFixed(3)),
        weighted_need_norm_guess_100: Number(weightedNeedNormGuess100.toFixed(3)),
        need_score_applied: Number(needScoreApplied.toFixed(3)),

        top_axis_open_hole_count: topAxisOpenHoleCount,
        top_axis_open_hole_pressure_01: Number(topAxisOpenHolePressure01.toFixed(3)),
        identity_locked_hole_pressure_01: Number(identityLockedHolePressure01.toFixed(3)),
        blue_hole_pressure_01: Number(blueHolePressure01.toFixed(3)),
        in_axis_hole_completion_bonus: Number(inAxisHoleCompletionBonus.toFixed(2)),
        best_diszi_hole_solve_bonus: Number(bestDisziHoleSolveBonus.toFixed(2)),
        off_axis_detour_penalty: Number(offAxisDetourPenalty.toFixed(2)),
        role_mismatch_penalty: Number(roleMismatchPenalty.toFixed(2)),
        overpay_penalty: Number(overpayPenalty.toFixed(2)),
        fit_penalty: Number(fitPenalty.toFixed(2)),
        hard_block_penalty: hardBlockPenalty ? 9999 : 0,
        top_axis_open_hole_labels: arr(score?.top_axis_open_hole_labels || []).slice(0, 6),
        top_axis_open_hole_breakdown_top6: arr(score?.top_axis_open_hole_breakdown_top6 || []).slice(0, 6),

        picked_player: pickedPlayer,
        klasse: pickedClass,
        color: pickedColor,
        price: Number(pickedPrice.toFixed(2)),
        fit: Number(pickedFit.toFixed(2)),
        score: Number(pickedScore.toFixed(3)),
        pre_jitter_score: Number(preJitterScore.toFixed(3)),
        score_jitter: Number(scoreJitter.toFixed(3)),
        market_role: marketRole,
        role_band: roleBand,
        matched_need_count: matchedNeedCount,
        matched_need_labels: matchedNeedLabels,
        best_diszi_field: bestDisziField,
        best_diszi_score: Number(bestDisziScore.toFixed(2)),
        identity_fit_01: Number(identityFit.toFixed(3)),
        why_picked,

        score_factor_breakdown: finalBlocks,

        pre_pick_context: {
          strategy: {
            key: s(strategy?.key || strategy?.strategy?.key || score?.debug?.strategy_key),
            strategy_roll: Number(n(strategy?.strategy_roll || score?.debug?.strategy_roll).toFixed(5)),
            quality_bias: Number(n(strategy?.quality_bias || score?.debug?.strategy_quality_bias).toFixed(3)),
            value_bias: Number(n(strategy?.value_bias || score?.debug?.strategy_value_bias).toFixed(3)),
            depth_bias: Number(n(strategy?.depth_bias).toFixed(3)),
            reserve_bias: Number(n(strategy?.reserve_bias).toFixed(3)),
            identity_bias: Number(n(strategy?.identity_bias || score?.debug?.strategy_identity_bias).toFixed(3)),
            hole_bias: Number(n(strategy?.hole_bias || score?.debug?.strategy_hole_bias).toFixed(3)),
            overpay_penalty_mult: Number(n(strategy?.overpay_penalty_mult || score?.debug?.strategy_overpay_penalty_mult).toFixed(3)),
            role_mismatch_mult: Number(n(strategy?.role_mismatch_mult || score?.debug?.strategy_role_mismatch_mult).toFixed(3)),
            star_tolerance: Number(n(strategy?.star_tolerance).toFixed(3))
          },
          needs: {
            top_axis: s(needs?.top_axis || needs?.topAxis || score?.top_axis),
            top_color: s(needs?.top_color || needs?.topColor || score?.top_color),
            active_need_count: n(score?.active_need_count ?? needs?.active_need_count ?? arr(needs?.active_needs).length),
            primary_need_count: n(score?.primary_need_count ?? needs?.primary_need_count ?? arr(needs?.primary_needs).length),
            secondary_need_count: n(score?.secondary_need_count ?? needs?.secondary_need_count ?? arr(needs?.secondary_needs).length),
            side_need_count: n(score?.side_need_count ?? needs?.side_need_count ?? arr(needs?.side_needs).length),
            weighted_need_primary_ctx: Number(n(score?.weighted_need_primary_ctx ?? needs?.weighted_need_primary_ctx).toFixed(3)),
            weighted_need_secondary_ctx: Number(n(score?.weighted_need_secondary_ctx ?? needs?.weighted_need_secondary_ctx).toFixed(3)),
            weighted_need_side_ctx: Number(n(score?.weighted_need_side_ctx ?? needs?.weighted_need_side_ctx).toFixed(3)),
            weighted_need_total_ctx: Number(n(score?.weighted_need_total_ctx ?? needs?.weighted_need_total_ctx).toFixed(3)),
            top_axis_open_hole_count: topAxisOpenHoleCount,
            top_axis_open_hole_pressure_01: Number(topAxisOpenHolePressure01.toFixed(3)),
            identity_locked_hole_pressure_01: Number(identityLockedHolePressure01.toFixed(3)),
            blue_hole_pressure_01: Number(blueHolePressure01.toFixed(3)),
            top_needs: topNeeds
          },
          top_candidates: topCandidates
        }
      });

      const pickedRow = findCandidateRow(candidatePool, pickedPlayer, pickedClass, pickedPrice);
      if (pickedRow) simRoster.push(pickedRow);
      if (pickedPlayer) pickedNames.push(pickedPlayer);
      if (plannedRole) {
        laneSpent[plannedRole] = Number((n(laneSpent[plannedRole]) + pickedPrice).toFixed(2));
      }
      remainingBudget = Number((remainingBudget - pickedPrice).toFixed(2));

      if (!pickedPlayer || !(pickedPrice > 0)) break;
    }

    const pick_summary_table = step_debug_rows.map((row) => ({
      pick: row.step,
      name: row.picked_player,
      klasse: row.klasse,
      farbe: row.color,
      mw: row.price,
      score: row.score,
      role: row.market_role,
      geplant: row.slot_role_planned,
      diszi: row.best_diszi_field,
      weighted_need_total_raw: row.weighted_need_total,
      weighted_need_avg_per_need: row.weighted_need_avg_per_need,
      weighted_need_norm_guess_100: row.weighted_need_norm_guess_100,
      need_score_applied: row.need_score_applied,
      best_diszi_hole_solve_bonus: row.best_diszi_hole_solve_bonus,
      in_axis_hole_completion_bonus: row.in_axis_hole_completion_bonus,
      off_axis_detour_penalty: row.off_axis_detour_penalty,
      role_mismatch_penalty: row.role_mismatch_penalty,
      overpay_penalty: row.overpay_penalty,
      fit_penalty: row.fit_penalty,
      score_jitter: row.score_jitter,
      top_axis_open_hole_pressure_01: row.top_axis_open_hole_pressure_01,
      why: row.why_picked
    }));

    return {
      ok: true,
      version: VERSION,
      reason: 'debug_direct_live_chain_with_clean_score_breakdown_complete',
      timestamp: new Date().toISOString(),

      meta: {
        team: s(filterTeam?.value || localStorage?.values?.selectedTeamCode || ''),
        sim_seed: simSeed,
        planned_steps: plannedSteps,
        simulated_steps: step_debug_rows.filter((x) => x.picked_player).length,
        initial_budget: Number(n(
          transfermarktSalaryBudgetLogic?.value?.budget_after_sales ??
          getCashFromSaisonstand?.value?.cash ??
          0
        ).toFixed(2)),
        remaining_budget_after_debug: Number(remainingBudget.toFixed(2)),
        top_axis: s(step_debug_rows[0]?.top_axis || ''),
        top_priority_color: s(step_debug_rows[0]?.top_color || ''),
        market_role_truth: 'player_stats_history_percentiles_only'
      },

      existence,

      preview_summary: {
        player_min: n(aiTeamPlan?.value?.player_min ?? 0),
        target_roster_size: n(aiTeamPlan?.value?.optimum ?? aiTeamPlan?.value?.target_roster_size ?? 0),
        roster_count_start: activeRoster.length,
        roster_count_end: simRoster.length,
        lane_spent_final: laneSpent,
        slot_plan_used: slotPlan,
        picked_names: pickedNames
      },

      role_benchmarks_summary: {
        core_from: Number(roleBench.core_from.toFixed(2)),
        depth_from: Number(roleBench.depth_from.toFixed(2)),
        backup_from: Number(roleBench.backup_from.toFixed(2)),
        reserve_below: Number(roleBench.reserve_below.toFixed(2)),
        star_from: Number(roleBench.star_from.toFixed(2)),
        superstar_from: Number(roleBench.superstar_from.toFixed(2))
      },

      score_block_legend: {
        need_count_used_for_scoring: 'aktuell max. 15 Needs pro Kandidat',
        weighted_need_total_raw: 'Rohsumme der Need-Beiträge',
        weighted_need_avg_per_need: 'Rohsumme / Need-Anzahl',
        weighted_need_norm_guess_100: 'grobe 0-100 Sicht via /10',
        need_score_applied_current: 'was aktuell wirklich in den Score eingeht',
        bestDisziHoleSolveBonus: 'Bonus für besten einzelnen Diszi-Need',
        inAxisHoleCompletionBonus: 'Bonus wenn Top-Axis-Loch direkt getroffen wird',
        offAxisDetourPenalty: 'Malus für thematischen Umweg',
        roleMismatchPenalty: 'Malus wenn Marktrolle nicht zum Slot passt',
        overpayPenalty: 'Preis-/Overpay-Malus',
        valueBonus: 'Bonus für gutes Preis-/Slot-Verhältnis',
        fitPenalty: 'Malus für negativen Teamfit',
        hardBlock: '0 oder 9999',
        scoreJitter: 'kleines Seed-Rauschen'
      },

      score_ranges_current_assumption: {
        bestDisziHoleSolveBonus: 'typisch ca. 0-20',
        inAxisHoleCompletionBonus: 'typisch ca. 0-20',
        offAxisDetourPenalty: 'typisch ca. 0-10',
        roleMismatchPenalty: 'typisch ca. 0-15',
        overpayPenalty: 'typisch ca. 0-25',
        valueBonus: 'typisch ca. 0-10',
        fitPenalty: 'typisch ca. 0-5',
        hardBlock: '0 oder 9999',
        scoreJitter: 'ca. -2 bis +2'
      },

      pick_summary_table,
      step_debug_rows
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
