import type { LeagueMarketBrackets, MarketBracketBand } from "@/lib/ai/market-pick-engine/market-brackets";
import { deriveRosterTargets } from "@/lib/foundation/roster-limits";

import { CLEAN_LANE_ORDER, type CleanLane, type CleanLanePlan, type CleanLanePlanSlot, type PlanTeamLanesInput } from "./types";

const EPS = 0.01;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Management identity axes (ambition, finances, ...) are 0-10 in the runtime data
 * (data/source/team-identities.json; the repo convention — see normalizeManagementValue,
 * ai-transfer-doctrine-layer.ts:84). Map to 0..1 by dividing by 10; a missing axis takes the
 * neutral midpoint (5 -> 0.5).
 */
export function normalizeIdentityAxis(value: number | null | undefined, fallback = 5) {
  const raw = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return clamp(raw / 10, 0, 1);
}

/** strategy bias axes are 1-10 (see clampBias in team-strategy-profiles). */
function normalizeBias(value: number | null | undefined, fallback: number) {
  const raw = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return clamp((raw - 1) / 9, 0, 1);
}

export type CleanTeamTraits = {
  ambition: number; // 0..1
  finances: number; // 0..1
  starPriority: number; // 0..1
  valuePriority: number; // 0..1
  rosterDepthPreference: number; // 0..1
  cashPriority: number; // 0..1
  /** Trait-derived lean toward developing potential over current ability (value/depth, low ambition). */
  developmentBias: number; // 0..1
};

export function resolveCleanTeamTraits(input: Pick<PlanTeamLanesInput, "identity" | "strategy">): CleanTeamTraits {
  const ambition = normalizeIdentityAxis(input.identity?.ambition, 5);
  const valuePriority = normalizeBias(input.strategy?.bias?.valuePriority, 5);
  const rosterDepthPreference = normalizeBias(input.strategy?.bias?.rosterDepthPreference, 5);
  const developmentBias = clamp(0.5 * valuePriority + 0.3 * rosterDepthPreference - 0.3 * ambition + 0.15, 0, 1);
  return {
    ambition,
    finances: normalizeIdentityAxis(input.identity?.finances, 5),
    starPriority: normalizeBias(input.strategy?.bias?.starPriority, 5),
    valuePriority,
    rosterDepthPreference,
    cashPriority: normalizeBias(input.strategy?.bias?.cashPriority, 5),
    developmentBias,
  };
}

function bandFor(brackets: LeagueMarketBrackets, lane: CleanLane): MarketBracketBand {
  return brackets[lane];
}

/** Finite spend ceiling for a lane (superstar has an open bracket ceiling). */
function laneSpendCeiling(brackets: LeagueMarketBrackets, lane: CleanLane): number {
  const band = bandFor(brackets, lane);
  if (band.ceilingMw != null && Number.isFinite(band.ceilingMw)) return band.ceilingMw;
  // superstar: open bracket — allow paying up to ~1.3x the superstar target.
  return Math.max(band.floorMw, band.targetMw * 1.3);
}

/**
 * Trait-driven cash retention buffer. This is slack the plan intentionally does NOT allocate against
 * lane means; the executor holds it back so picks that come in ABOVE their lane mean draw from the
 * buffer instead of dropping slots. Finance-rich / cash-priority teams keep more; ambitious teams
 * keep less. Mirrors the intent of the (dead) season-1 spend corridor without hard per-tier caps.
 */
export function resolveCashRetentionPct(traits: CleanTeamTraits): number {
  const keep = 0.06 + traits.finances * 0.07 + traits.cashPriority * 0.06 - traits.ambition * 0.05;
  return clamp(keep, 0.05, 0.2);
}

/** Highest lane the team's traits are willing to reach (premium desire, NOT affordability). */
function resolveReachLaneIndex(traits: CleanTeamTraits): number {
  const reach = Math.max(traits.ambition, traits.starPriority, traits.finances * 0.85);
  if (reach >= 0.62) return 0; // superstar
  if (reach >= 0.45) return 1; // star
  if (reach >= 0.28) return 2; // core
  return 3; // depth
}

/** Per-slot allowed spend cap: around the lane mean, with headroom the buffer can cover. */
function laneSlotCap(brackets: LeagueMarketBrackets, lane: CleanLane): number {
  const band = bandFor(brackets, lane);
  return round2(clamp(band.targetMw * 1.25, band.floorMw, laneSpendCeiling(brackets, lane)));
}

/**
 * Budget-fitted lane mix (per the user's design): pre-calculate with each lane's MEAN price so the
 * sum of (count × mean) lands near spendable at the OPT roster size — the plan reaches ~OPT with a
 * real-tier body instead of stopping early. Trait tendency decides how premium-vs-depth-heavy the
 * pyramid is; the budget then scales that tendency (upgrade the mix when cash is spare, downgrade
 * when it is tight) while keeping the slot count fixed at OPT. NO hard caps — richer teams simply
 * afford more premium; poorer teams settle into Depth/Backup cores.
 */
export function planTeamLanes(input: PlanTeamLanesInput): CleanLanePlan {
  const traits = resolveCleanTeamTraits(input);
  const { playerMin, playerOpt, playerMax } = deriveRosterTargets(undefined, input.identity ?? undefined);
  const currentCount = Math.max(0, input.currentRosterCount);
  const opt = clamp(Math.round(playerOpt), playerMin, playerMax);

  // OPT is a SOFT target. Center the plan on OPT but let the budget-fit flex the final size within
  // ~[opt-2, opt+1] (clamped to the roster min/max): a tight budget lands a slot or two short rather
  // than dumping cheap filler; a spare budget can add one extra real-tier player.
  const centerN = Math.max(0, opt - currentCount);
  const minN = Math.max(0, playerMin - currentCount); // mandatory floor to reach the hard minimum
  const lowN = Math.max(minN, centerN - 2);
  const highN = Math.max(centerN, Math.min(centerN + 1, playerMax - currentCount));

  const retentionPct = resolveCashRetentionPct(traits);
  const spendable = Math.max(0, input.spendableCash) * (1 - retentionPct);

  const means = CLEAN_LANE_ORDER.map((lane) => bandFor(input.brackets, lane).targetMw);
  const reserveMean = means[CLEAN_LANE_ORDER.length - 1]!;

  // Soft-flex DOWN: a genuinely cash-poor team plans a slightly smaller squad rather than being
  // forced to buy more sub-real filler than its budget covers (never below the hard minimum).
  let openSlots = centerN;
  while (openSlots > lowN && spendable + EPS < openSlots * reserveMean) {
    openSlots -= 1;
  }
  openSlots = Math.max(openSlots, minN);

  const perSlotBudget = openSlots > 0 ? spendable / openSlots : 0;
  if (openSlots === 0) {
    return { spendable: round2(spendable), perSlotBudget: round2(perSlotBudget), targetRosterSize: currentCount, slots: [] };
  }

  const reachIdx = resolveReachLaneIndex(traits);
  const depthIdx = CLEAN_LANE_ORDER.indexOf("depth");
  // Concentration vs breadth: star/ambition-led teams pour surplus into a few high picks; depth-led
  // teams spread it across many one-tier upgrades toward Core/Depth.
  const concentrate = traits.starPriority + 0.5 * traits.ambition >= traits.rosterDepthPreference + 0.35;

  // Affordable base = highest tier whose MEAN the team can afford for EVERY slot (Σ mean <= spendable).
  let affordableBaseIdx = CLEAN_LANE_ORDER.length - 1; // reserve
  for (let idx = 0; idx < CLEAN_LANE_ORDER.length; idx += 1) {
    if (means[idx]! * openSlots <= spendable + EPS) {
      affordableBaseIdx = idx;
      break;
    }
  }

  // A concentrate team that can already sustain a REAL body (Depth+) starts one tier lower on
  // purpose, freeing surplus to buy a Superstar/Star while the rest stays a real (Backup) body — a
  // premium behaviour that only emerges when the team is genuinely rich enough. Poor/breadth teams
  // keep the highest affordable base (a broad Depth/Backup body, no barbell).
  const baseIdx =
    concentrate && affordableBaseIdx <= depthIdx
      ? Math.min(affordableBaseIdx + 1, CLEAN_LANE_ORDER.length - 1)
      : affordableBaseIdx;

  // Start every slot at the base tier, then spend the leftover on upgrades.
  const laneOf: number[] = new Array(openSlots).fill(baseIdx);
  let budgetLeft = spendable - openSlots * means[baseIdx]!;

  const upgradeSlot = (slotIdx: number, toLane: number) => {
    const cost = means[toLane]! - means[laneOf[slotIdx]!]!;
    if (cost > budgetLeft + EPS) return false;
    budgetLeft -= cost;
    laneOf[slotIdx] = toLane;
    return true;
  };

  // Guard against pathological loops (bounded by slots × tiers).
  const maxUpgradeSteps = openSlots * CLEAN_LANE_ORDER.length + 4;
  for (let step = 0; step < maxUpgradeSteps; step += 1) {
    // Concentrate: lift the currently-highest upgradable slot one more tier (up to reach).
    // Breadth: lift the currently-lowest slot one tier (up to reach). Stop when nothing affordable.
    let targetSlot = -1;
    if (concentrate) {
      let bestLane = CLEAN_LANE_ORDER.length; // higher number = lower lane
      for (let s = 0; s < openSlots; s += 1) {
        if (laneOf[s]! > reachIdx && laneOf[s]! < bestLane) {
          bestLane = laneOf[s]!;
          targetSlot = s;
        }
      }
    } else {
      let worstLane = -1;
      for (let s = 0; s < openSlots; s += 1) {
        if (laneOf[s]! > reachIdx && laneOf[s]! > worstLane) {
          worstLane = laneOf[s]!;
          targetSlot = s;
        }
      }
    }
    if (targetSlot < 0) break;
    if (!upgradeSlot(targetSlot, laneOf[targetSlot]! - 1)) break;
  }

  // Soft-flex UP: a spare budget (leftover still covers a real-tier player) adds ONE extra slot at
  // the best body tier the leftover affords, rather than overloading the existing slots — so a rich
  // team lands slightly above OPT with an extra real player instead of a lone Superstar + filler.
  if (openSlots < highN && budgetLeft + EPS >= means[depthIdx]!) {
    let addLane = CLEAN_LANE_ORDER.length - 1;
    for (let idx = Math.max(reachIdx, 0); idx < CLEAN_LANE_ORDER.length; idx += 1) {
      if (means[idx]! <= budgetLeft + EPS && idx <= depthIdx) {
        addLane = idx;
        break;
      }
    }
    if (means[addLane]! <= budgetLeft + EPS) {
      budgetLeft -= means[addLane]!;
      laneOf.push(addLane);
      openSlots += 1;
    }
  }

  // Emit slots premium-first (ascending lane index).
  laneOf.sort((left, right) => left - right);
  const slots: CleanLanePlanSlot[] = laneOf.map((idx) => {
    const lane = CLEAN_LANE_ORDER[idx]!;
    return {
      lane,
      priceFloor: bandFor(input.brackets, lane).floorMw,
      priceCap: laneSlotCap(input.brackets, lane),
    };
  });

  return {
    spendable: round2(spendable),
    perSlotBudget: round2(perSlotBudget),
    targetRosterSize: currentCount + slots.length,
    slots,
  };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
