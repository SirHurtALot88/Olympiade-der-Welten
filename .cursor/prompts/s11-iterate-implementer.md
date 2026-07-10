# S11 Iterate — Auto Implementer

You are the **Implementer** for the S11 10× iterate loop.

## Input
- Read `reviewer-plan.md` from the iteration folder
- Read `REVIEW_PROMPT.md` constraints

## Task
1. Implement Fix 1 (and Fix 2 if specified)
2. Run tests:
   - `tests/planner-opt-buy-policy.test.ts`
   - `tests/ai-team-cash-reserve-service.test.ts`
   - `tests/ai-transfer-window-session.test.ts`
   - `tests/unified-pick-planner.test.ts`
   - `tests/ai-market-plan-convergence.test.ts` (if convergence touched)
3. Write `implementer-log.md` with what changed and test results

## Rules
- Minimal focused diff
- No sell caps
- Do not revert Opt-first / transfer-bucket / planned-over-Opt policy
- Do not commit unless asked
