# Retool AI2 Pick Engine Port

## Extracted Retool Modules

Source: `/Users/chrisfalk/Downloads/Olympiade%20der%20Welten%20Draftboard (7).json`.

The Retool export stores most AI2 logic in serialized app state, not as separate files. The relevant references were found in the export and in the extracted `preloadedAppJavaScript.js` artifact:

- `AI2_01_Preload`: initializes `globalThis.ai2` and shared domain helpers.
- `AI2_04_Planner`: consumes salary/budget logic, planned role, step index, remaining budget, axis pressure and plan state.
- `ai2PickScoringHelpers_v10`: helper layer for numeric coercion, tuning, role/need explanations and score-row shaping.
- `aiSNP Context`: `window.aiSNP.context.buildPreviewContext()` and `enrichContext()` build team/roster/candidate context.
- `Needs Snapshot`: serialized as active/primary/secondary/side needs with `weighted_need_*`, `top_axis_open_hole_pressure_01`, `axis_shares_01`.
- `Pick Snapshot`: serialized planned pick rows with `step_axis`, `step_diszi`, `slot_role_used`, `market_role`, score and breakdown fields.
- `Scoring Debug Rows`: table columns include `axis_top6_delta`, `diszi_top6_delta`, `in_axis_hole_completion_bonus`, `off_axis_detour_penalty`, `role_mismatch_penalty`, `overpay_penalty_abs`, `fit_penalty`.
- `Budget/Planner Config`: `allowed_budget_for_search`, `reserve_target`, soft slot budget, salary risk, finance pressure, planned buys and role plan.
- `Low Impact Penalty`: Retool tuning uses low impact axis/diszi delta thresholds and a capped absolute penalty.
- `Overpay Penalty`: subtracts value when price exceeds a planned/budget ceiling, with relief for real impact.
- `In-axis Hole Completion`: rewards candidates that solve holes on the top/second identity axis.
- `Off-axis Detour Penalty`: penalizes detours while open identity-axis holes remain, without hard-filtering.
- `Role Mismatch Penalty`: planned role is binding enough to penalize wrong-role premium picks.
- `Fit Penalty`: negative fit is a penalty/debug field; in the app the hard filter remains only negative fit unless mercenary.
- `Synergy`: Retool has a bounded bonus cap for axis/diszi synergy; app port keeps this as hole/axis compatibility, not OVR/MVS/MW.

## Retool To App Mapping

| Retool field | Retool meaning | App current field | Missing? | Wrong? | Ported? | Test needed? |
| --- | --- | --- | --- | --- | --- | --- |
| `axisPriorityAbs` | Team identity axis weights | `TeamIdentity.pow/spe/men/soc` | no | no | yes | yes |
| `axis_shares_01` | Normalized identity shares | `TeamNeedState.axisShares01` | was missing | no | yes | yes |
| `topAxis/secondAxis` | Main identity lanes | `TeamNeedState.topAxis/secondAxis` | was partial | no | yes | yes |
| `focus_rigidity_01` | How hard to punish detours | `TeamNeedState.focusRigidity01` | yes | no | yes | yes |
| `active_needs` | All axis/diszi needs | `TeamNeedState.openDisciplineHoles` | yes | no | yes | yes |
| `weighted_need_primary` | Top-axis need pressure | `TeamNeedState.weightedNeedPrimary` | yes | no | yes | yes |
| `weighted_need_secondary` | Secondary need pressure | `TeamNeedState.weightedNeedSecondary` | yes | no | yes | yes |
| `weighted_need_side` | Side-need pressure | `TeamNeedState.weightedNeedSide` | yes | no | yes | smoke |
| `top_axis_open_hole_pressure_01` | Open-hole pressure on identity axis | `TeamNeedState.topAxisOpenHolePressure01` | yes | no | yes | yes |
| `axis_top6_delta` | Top-N axis marginal improvement | `MarginalNeedGain.axisTop6Delta` | yes | no | yes | yes |
| `diszi_top6_delta` | Top-N discipline marginal improvement | `MarginalNeedGain.disziTop6Delta` | yes | no | yes | yes |
| `need_score_applied` | Need score applied to pick score | `ScoredCandidate.needImpactScore` | was incomplete | no | yes | yes |
| `in_axis_hole_completion_bonus` | Bonus for solving top/second-axis holes | `scoreInAxisHoleCompletion()` | yes | no | yes | yes |
| `off_axis_detour_penalty` | Penalty for detours while identity holes remain | `scoreOffAxisDetourPenalty()` | yes | no | yes | yes |
| `overpay_penalty_abs` | Soft budget/value overpay penalty | `scoreOverpayPenalty()` | partial | previous anchor too harsh | yes | yes |
| `role_mismatch_penalty` | Planned role mismatch penalty | `scoreRoleMismatchPenalty()` | partial | no | yes | yes |
| `fit_penalty` | Fit penalty/debug value | `scoreFitPenalty()` plus existing hard fit gate | partial | no | yes | yes |
| `synergy` | Bounded axis/diszi compatibility bonus | marginal need compatibility | yes | no | partial | smoke |
| `OVR/MVS/MW` | Display/value context, not pick score | not used as pick score | no | previous overspend path used MW too heavily | guarded | regression |
| `allowed_budget_for_search` | Cash minus protected reserve before Needs/Pick scoring | `RosterTargetPlan.spendableBudget` | was flat pct | yes | yes | yes |
| `reserve_target` | Cash buffer from salary burden, finance safety, sponsor/runway and posture | `RosterTargetPlan.reserveBudget` | was flat pct | yes | yes | yes |
| `reserve_policy` | aggressive/balanced/conservative spend posture | `RosterTargetPlan.reservePolicy` | yes | no | yes | yes |
| `aggression01/caution01` | Manager posture from ambition, rank trend, finances, harmony, salary burden | `budgetAggression01/budgetCaution01` | yes | no | yes | yes |
| `roster_color.shares` | Current class/form-card color distribution | `TeamNeedState.formColorShares01` | yes | no | yes | yes |
| `color_economy` | Need for red/green/blue/yellow form-card playability | `formColorNeed01`, `formColorNeedScore` | yes | no | yes | yes |

## Current Port Status

Implemented central helpers in `lib/ai/retool-ai2-pick-engine.ts`:

- `buildTeamNeedState()`
- `buildOpenDisciplineHoles()`
- `scoreMarginalNeedGain()`
- `scoreInAxisHoleCompletion()`
- `scoreOffAxisDetourPenalty()`
- `scoreOverpayPenalty()`
- `scoreRoleMismatchPenalty()`
- `scoreFitPenalty()`
- `scoreFormColorStackPenalty()`
- `buildSequentialPickPlan()`
- `updateNeedsAfterPick()`

Integrated into `lib/ai/chunked-redraft-topup-service.ts`:

- Every team-pick step rebuilds needs from the current roster.
- Candidate score includes `needImpactScore`.
- Pick score applies in-axis bonus, off-axis detour, form-color stack, overpay, role mismatch and fit penalty.
- Team target planning now builds a Retool-style budget plan before scoring: `allowedBudgetForSearch`, `reserveTarget`, `reservePolicy`, `aggression01`, `caution01`, sponsor forecast and soft slot budget.
- Form-card color economy is part of the need score: Pow=red, Spe=green, Men=blue, Soc=yellow; stacked teams are nudged toward missing colors so they can actually use form cards and boosted discipline lanes.
- Removed the harsh portfolio shock / anchor identity penalty path that was not Retool-parity.
- Hard filters remain limited to negative fit unless mercenary, and cash cannot go below zero.

## Retool Budget And Color Economy Port

Retool sources: `transfermarktSalaryBudgetLogic.v2.4_salaryFactors5Forecast`, `aiTeamPlan.v3.5`, `aiTeamNeeds`.

- `allowed_budget_for_search` is computed before Needs/Pick scoring. The app keeps this as soft planning, not as a hard pool restriction.
- C-C/value/finance teams reserve more cash; M-M/high-ambition teams can use a larger planned budget, while cash non-negative remains the only hard budget rule.
- Salary burden, sponsor/prize support and runway feed `caution01`; ambition, rank pressure and missing roster slots feed `aggression01`.
- `color_economy` is now included in `buildTeamNeedState()` and `scoreMarginalNeedGain()`.
- A team that stacks one color, such as all-green Sprinter picks, now receives non-green form-card needs even when its top identity axis remains Speed.
- Once a color reaches its planned target and other colors are still missing, `scoreFormColorStackPenalty()` softly lowers another same-color pick. This keeps identity picks possible, but stops A-A-style runs from drafting only green and losing access to useful red/blue/yellow form cards.

## Retool MVS Formula

Retool source: `calculatePlayerMVSSaison`.

MVS is season-performance based and must not be confused with market value, OVR or pick attractiveness:

- For live seasons, Retool reads per-player discipline point columns from `getDisciplinePointsBySeason`.
- For every discipline, players with points above zero are ranked descending.
- Rank points are fixed: rank 1 = 10, rank 2 = 8, rank 3 = 6, rank 4-6 = 5, rank 7-10 = 4, rank 11-15 = 3, rank 16-20 = 2, rank 21-25 = 1, rank 26-30 = 0.5, lower = 0.
- `disziplin` = sum of those rank points across all 20 disciplines.
- `clutch` = 30% of rank points in Retool's hardcoded 6-player/team-discipline set: `showcase`, `eiskunstlauf`, `football`, `basketball`, `battlefield`.
- `versatility` = 5 for 9+ played disciplines, 3 for 7+, 1 for 5+, otherwise 0.
- `einsatz` = number of disciplines with positive points times 0.5.
- Final `mvs = disziplin + clutch + versatility + einsatz`.
- Historical seasons use archived `player_stats_history.mvs`.

App port:

- Centralized in `lib/foundation/player-rating-contract.ts`.
- Uses `SeasonPointsLedger.pointEntries` when available, falling back to `scoreContribution` from performance rows in isolated tests/legacy calls.
- Replaces the previous Rank-to-Diszi-MW-table MVS approximation.
