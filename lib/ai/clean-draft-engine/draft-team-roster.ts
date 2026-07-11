import type { Player } from "@/lib/data/olyDataTypes";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import { FIXED_ROSTER_MIN } from "@/lib/foundation/roster-limits";

import { planTeamLanes } from "./plan-team-lanes";
import { scoreCandidate } from "./score-candidate";
import { candidateToThemePlayer, evaluateCleanTheme, isCleanThemeHardEligible } from "./theme-match";
import type {
  CleanDraftPick,
  CleanLanePlanSlot,
  CleanThemeTarget,
  DraftTeamRosterInput,
} from "./types";

const EPS = 0.01;

/** Canonical on-theme test for an already-rostered Player (counts toward primary/secondary share). */
function playerCountsOnTheme(player: Player, themeTarget: CleanThemeTarget): boolean {
  return evaluateCleanTheme({ player, target: themeTarget, onThemeCountSoFar: 0, rosterCountSoFar: 0 }).counts;
}

function candidateFee(candidate: TransfermarktFreeAgentItem): number | null {
  const value = candidate.marketValue;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Minimal Player projection of a bought free agent so that need/marginal-axis and discipline-coverage
 * scoring can evolve DURING the draft (S1 rosters start empty — without this the coverage terms would
 * be inert). Only the fields the scorer reads are populated.
 */
function itemToPseudoPlayer(item: TransfermarktFreeAgentItem): Player {
  return {
    id: item.playerId,
    race: item.race,
    // className is REQUIRED for form-color tracking (getPlayerClassColor -> CLASS_COLOR_MAP[className]);
    // without it the color/class anti-monoculture penalty never fires on the accumulating roster.
    className: item.className,
    coreStats: {
      pow: item.pow ?? 0,
      spe: item.spe ?? 0,
      men: item.men ?? 0,
      soc: item.soc ?? 0,
    },
    preferredDisciplineIds: item.preferredDisciplineIds ?? [],
  } as unknown as Player;
}

type Selection = { candidate: TransfermarktFreeAgentItem; score: number; onTheme: boolean };

function selectBest(input: {
  pool: TransfermarktFreeAgentItem[];
  used: Set<string>;
  minPrice: number;
  maxPrice: number;
  slot: CleanLanePlanSlot;
  themeTarget: CleanThemeTarget;
  identity: DraftTeamRosterInput["identity"];
  strategy: DraftTeamRosterInput["strategy"];
  onThemeCountSoFar: number;
  rosterCountSoFar: number;
  currentRosterPlayers: Player[];
}): Selection | null {
  let best: Selection | null = null;
  let bestFee = Number.POSITIVE_INFINITY;
  for (const candidate of input.pool) {
    if (input.used.has(candidate.playerId)) continue;
    const fee = candidateFee(candidate);
    if (fee == null) continue;
    if (fee + EPS < input.minPrice) continue;
    if (fee > input.maxPrice + EPS) continue;
    const { score, onTheme } = scoreCandidate({
      candidate,
      identity: input.identity,
      strategy: input.strategy,
      slot: input.slot,
      themeTarget: input.themeTarget,
      onThemeCountSoFar: input.onThemeCountSoFar,
      rosterCountSoFar: input.rosterCountSoFar,
      currentRosterPlayers: input.currentRosterPlayers,
    });
    // Tie-breaks: higher score, then cheaper fee, then stable by playerId.
    if (
      best == null ||
      score > best.score + EPS ||
      (Math.abs(score - best.score) <= EPS && fee < bestFee - EPS) ||
      (Math.abs(score - best.score) <= EPS && Math.abs(fee - bestFee) <= EPS && candidate.playerId < best.candidate.playerId)
    ) {
      best = { candidate, score, onTheme };
      bestFee = fee;
    }
  }
  return best;
}

/**
 * Clean per-team draft executor (pure). Builds the lane plan, then for each planned slot picks the
 * best-scoring affordable candidate within the slot's price band, removing it from the pool and
 * decrementing budget. Respects the plan's spread-aware price caps, guarantees at least playerMin
 * players while cash allows, and never spends into negative cash.
 */
export function draftTeamRoster(input: DraftTeamRosterInput): CleanDraftPick[] {
  const playerMin = input.playerMin ?? FIXED_ROSTER_MIN;
  const plan = planTeamLanes({
    teamId: input.teamId,
    identity: input.identity,
    strategy: input.strategy,
    spendableCash: input.spendableCash,
    currentRosterCount: input.currentRoster.length,
    brackets: input.brackets,
  });

  const used = new Set<string>();
  const picks: CleanDraftPick[] = [];
  let cashLeft = Math.max(0, input.spendableCash);

  // HARD-FOCUS eligibility: for hard-strictness identity teams (undead, demon, female-humanoid,
  // construct, pirate, giant …) the planned roster is drafted ONLY from theme-eligible candidates —
  // reproducing the legacy hard-focus gate from the theme target alone (no team-code hardcodes).
  // Non-hard teams keep the full pool (theme stays a scoring lean). The below-min safety net below
  // may still relax to the full pool so a hard team is never stranded under its minimum.
  const isHardFocus = input.themeTarget?.strictness === "hard";
  const eligiblePool = isHardFocus
    ? input.freeAgents.filter((candidate) =>
        isCleanThemeHardEligible(
          evaluateCleanTheme({
            player: candidateToThemePlayer(candidate),
            target: input.themeTarget,
            onThemeCountSoFar: 0,
            rosterCountSoFar: 0,
          }),
          input.themeTarget,
        ),
      )
    : input.freeAgents;

  let onThemeCount = input.currentRoster.filter((player) => playerCountsOnTheme(player, input.themeTarget)).length;
  let rosterCount = input.currentRoster.length;
  // Roster-so-far grows as we buy, so need/marginal-axis and discipline-coverage scoring reflects the
  // team's evolving gaps (not just the pre-draft roster, which is empty in S1).
  const rosterSoFar: Player[] = [...input.currentRoster];

  // DYNAMIC BUFFER: track the running gap between planned lane means and actual fees. When early picks
  // come in UNDER their lane mean, the surplus lets later slots reach a bit higher (depth->core); when
  // over, later slots naturally tighten (the spread ceiling already forces cheaper picks). The buffer
  // breathes so cash isn't left unused and the roster still lands near opt.
  const laneMean = (slot: CleanLanePlanSlot) => input.brackets[slot.lane].targetMw;
  let dynamicSurplus = 0;

  // Cheapest realistic per-slot price in the current pool — the absolute fallback reservation so even
  // reserve-tier slots (bracket floor 0) always hold back real cash for a cheap player.
  const poolFees = input.freeAgents.map(candidateFee).filter((fee): fee is number => fee != null && fee > 0);
  const cheapFloor = poolFees.length > 0 ? Math.max(1, Math.min(...poolFees)) : 1;

  // SPREAD guard at execution time: reserve the sum of every REMAINING planned slot's floor (never
  // below the cheap floor). The budget-fitted plan already sized premium to the budget, so reserving
  // the plan's own floors executes it faithfully — planned premium goes through, while every later
  // slot is guaranteed enough cash to be filled at its tier. This makes below-min impossible and,
  // because the plan is the authority on how much premium exists, also prevents the barbell.
  const effectiveFloor = (slot: CleanLanePlanSlot) => Math.max(slot.priceFloor, cheapFloor);
  const suffixReserve: number[] = new Array(plan.slots.length + 1).fill(0);
  for (let i = plan.slots.length - 1; i >= 0; i -= 1) {
    suffixReserve[i] = suffixReserve[i + 1]! + effectiveFloor(plan.slots[i]!);
  }

  // CASH BUFFER: the plan holds back a trait-driven retention slice (plan.spendable is already net of
  // it). Keep that buffer untouched during the planned buys so finance-/cash-priority teams actually
  // end with a war chest (the user's "C-S should keep a buffer") instead of splashing to zero. It is a
  // SOFT reserve — the below-min safety net may still dip into it so the hard minimum is never missed.
  const retainedBuffer = Math.max(0, Math.round((input.spendableCash - plan.spendable) * 100) / 100);

  const buy = (selection: Selection, slot: CleanLanePlanSlot) => {
    const fee = candidateFee(selection.candidate) ?? 0;
    used.add(selection.candidate.playerId);
    cashLeft = Math.round((cashLeft - fee) * 100) / 100;
    dynamicSurplus = Math.round((dynamicSurplus + (laneMean(slot) - fee)) * 100) / 100;
    rosterCount += 1;
    if (selection.onTheme) onThemeCount += 1;
    rosterSoFar.push(itemToPseudoPlayer(selection.candidate));
    picks.push({
      playerId: selection.candidate.playerId,
      fee,
      salary: typeof selection.candidate.salary === "number" ? selection.candidate.salary : 0,
      lane: slot.lane,
      onTheme: selection.onTheme,
    });
  };

  // 1) Planned slots, premium-first — each buy preserves the reservation for all remaining slots.
  for (let i = 0; i < plan.slots.length; i += 1) {
    if (cashLeft <= cheapFloor - EPS) break;
    const slot = plan.slots[i]!;
    const reserveForRest = suffixReserve[i + 1]!;
    const spendCeiling = Math.round((cashLeft - reserveForRest - retainedBuffer) * 100) / 100;
    if (spendCeiling < cheapFloor - EPS) continue; // nothing affordable without starving later slots

    // Dynamic buffer: let this slot reach above its planned cap by the accumulated surplus (bounded by
    // the spread ceiling), so a run of under-mean picks upgrades later slots instead of hoarding cash.
    const extendedCap = slot.priceCap + Math.max(0, dynamicSurplus);
    const bandMax = Math.min(extendedCap, spendCeiling);

    // Prefer a candidate at or above the slot's tier floor (respecting the spread reservation).
    let selection = selectBest({
      pool: eligiblePool,
      used,
      minPrice: slot.priceFloor,
      maxPrice: bandMax,
      slot,
      themeTarget: input.themeTarget,
      identity: input.identity,
      strategy: input.strategy,
      onThemeCountSoFar: onThemeCount,
      rosterCountSoFar: rosterCount,
      currentRosterPlayers: rosterSoFar,
    });

    // Tier unaffordable (or empty) while preserving the reservation: downgrade to the best affordable
    // player at or below the spread ceiling. The plan self-corrects — over-optimistic premium slots
    // become real-tier body picks instead of stranding the roster below its minimum.
    if (!selection) {
      selection = selectBest({
        pool: eligiblePool,
        used,
        minPrice: 0,
        maxPrice: spendCeiling,
        slot,
        themeTarget: input.themeTarget,
        identity: input.identity,
        strategy: input.strategy,
        onThemeCountSoFar: onThemeCount,
        rosterCountSoFar: rosterCount,
        currentRosterPlayers: rosterSoFar,
      });
    }

    if (!selection) continue;
    buy(selection, slot);
  }

  // 2) Safety net: while still below the hard minimum, buy the best affordable player regardless of
  //    tier (should rarely trigger — the reservation above already guarantees fillability). Hard-focus
  //    teams still prefer an eligible (on-theme) player and only relax to the full pool if no eligible
  //    candidate remains, so the minimum is always reachable without abandoning identity prematurely.
  while (rosterCount < playerMin && cashLeft > cheapFloor - EPS) {
    const reserveSlot: CleanLanePlanSlot = { lane: "reserve", priceFloor: 0, priceCap: cashLeft };
    const selection =
      selectBest({
        pool: eligiblePool,
        used,
        minPrice: 0,
        maxPrice: cashLeft,
        slot: reserveSlot,
        themeTarget: input.themeTarget,
        identity: input.identity,
        strategy: input.strategy,
        onThemeCountSoFar: onThemeCount,
        rosterCountSoFar: rosterCount,
        currentRosterPlayers: rosterSoFar,
      }) ??
      (isHardFocus
        ? selectBest({
            pool: input.freeAgents,
            used,
            minPrice: 0,
            maxPrice: cashLeft,
            slot: reserveSlot,
            themeTarget: input.themeTarget,
            identity: input.identity,
            strategy: input.strategy,
            onThemeCountSoFar: onThemeCount,
            rosterCountSoFar: rosterCount,
            currentRosterPlayers: rosterSoFar,
          })
        : null);
    if (!selection) break;
    buy(selection, reserveSlot);
  }

  return picks;
}
