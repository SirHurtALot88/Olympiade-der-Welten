/**
 * League-wide Marquee-Lizenz allocation for Superstar-tier (65+ MW, aspirational ~75+ MW — see
 * marqueeTargetMw below) picks in the organic draft (ANPASSUNG COMPOSE, flag OLY_DRAFT_COMPOSE). PURE —
 * no gameState/env read, no I/O; the caller (draft-adapter.ts) builds the per-team input from the live
 * save and reads no env here either.
 *
 * WHY: `computeIdentityLaneAppetite` (ai-needs-picks-compare-service.ts) folds `(1 − financesN)` into
 * `premiumAppetite` — a deliberate "board pressure on a mid/poor club" signal for the base Season1 lane
 * philosophy. But that means the RICHEST, most star-hungry clubs (high finances) can score a LOWER
 * premiumAppetite than a cash-strapped-but-ambitious one, so a single-team appetite threshold selected
 * the wrong teams for a marquee buy — poor teams that then couldn't actually afford it, while rich
 * star-chasers (M-M, B-P, Z-H, S-C-calibre) never got a shot.
 *
 * This module replaces that with an explicit LEAGUE-WIDE allocation: a Superstar is "nice to have, not a
 * must" — the licensing here only decides which (few) teams are even IN THE RUNNING for one; whether they
 * actually buy it is still the base greedy utility's call (see utility.ts COMPOSITION_SUPERSTAR_VALUE, a
 * moderate — not forced — nudge). A hard league-wide pool (MAX_LEAGUE_SUPERSTARS minus however many
 * Superstar-tier players already exist league-wide) is handed to teams that clear a real affordability gate
 * AND a SOFT combined desirability score, reached via either of TWO paths (see deriveLeagueSuperstarLicenses
 * doc): the ambition+star-GM path, or a cash-splurge path (a team that has quietly banked a cash mountain
 * over several seasons and, in an "attacking" season, suddenly springs for a marquee — the classic "Cash
 * Creators" story — without needing top-tier ambition/star-hunger to justify it). The score threshold
 * (MARQUEE_SCORE_MIN) is what keeps the realized league-wide count "typically 2-3, cap 5" instead of
 * always filling every remaining license: only genuinely marquee-worthy teams (on either path) clear it,
 * most affordable-but-middling teams don't. A team that already holds a Superstar never gets an additional
 * license (one marquee name per club).
 *
 * `deriveLeagueSuperstarLicenses` is called ONCE per draft pass over all 32 teams (see draft-adapter.ts)
 * so the same license set is used for every team's individual composition plan that season — the licenses
 * are a scarce league resource, not a per-team roll. Because it depends on live spendableNet (this
 * season's cash), a hoarder's splurge is naturally self-limiting: it spends the pile down, so it typically
 * doesn't re-qualify next season — "unerwartet", exactly as intended.
 */

export type MarqueeLicenseTeamInput = {
  teamId: string;
  /** normalizeManagementValue(identity.ambition) — 0..1, post GM-blended value used elsewhere in the plan. */
  ambitionN: number;
  /** GM bias.starPriority, 1..10 raw scale (NOT pre-normalized). */
  starPriority: number;
  /** GM profile archetype (e.g. "star_chaser", "elite_curator", "risk_gambler", ...). */
  archetype: string;
  /** Cash actually spendable toward the draft (already net of the club's cash buffer). */
  spendableNet: number;
  /**
   * Estimated cost of planning ONE Superstar slot (at this draft pass's league-scaled marquee price — see
   * draft-adapter.ts: max(MARQUEE_TARGET_MW_FLOOR, quantilePrice(candidate MWs, 0.98)), which inflates with
   * the league across seasons) + filling the rest of the roster at Depth floor, i.e.
   * marqueeTargetMw + max(0, slotsToFill−1)·depth.floorMw. Both the basic affordability gate AND the
   * cash-splurge line (SPLURGE_CASH_MULT·ssPlanCost, see below) are measured against this SAME full-plan
   * cost, not just the bare marquee price — a splurge means affording the whole plan with room to spare,
   * not merely the marquee sticker price.
   */
  ssPlanCost: number;
  /** # Superstar-tier (brackets.superstar.floorMw+) players already on this team's roster. */
  existingSuperstarCount: number;
};

/** Hard league-wide ceiling on Superstar-tier players (existing + newly licensed), never exceeded. This is
 *  a CAP, not a target — the score gate below is what usually keeps the realized count well under it. */
export const MAX_LEAGUE_SUPERSTARS = 5;
/**
 * Aspirational marquee price FLOOR (MW): "ein krasser Spieler" costs at least ~75 MW even when the
 * league's live Superstar bracket target (brackets.superstar.targetMw, price-derived) sits lower. The
 * caller (draft-adapter.ts) scales the ACTUAL marqueeTargetMw up from here with league inflation
 * (quantilePrice over the candidate pool at the 98th percentile), so a late-season inflated league prices
 * its marquee at ~85-90 MW while an early S1 league stays near this floor — this constant is only the
 * lower bound, never a hard cap. Shared by the license affordability gate here AND composition-plan.ts's
 * own superstarAffordable check, so a moderate-budget team (e.g. S-C-calibre: ambitious, but ~200 MW
 * total budget across a 10-slot roster) genuinely cannot clear this bar and settles for a Star via the
 * normal premiumAppetite path instead — this is a REAL gate, unlike the soft score below.
 */
export const MARQUEE_TARGET_MW_FLOOR = 75;
/**
 * Standard-path (ambition + star-GM) score threshold — see standardScore in deriveLeagueSuperstarLicenses.
 * Empirically calibrated against real fresh-Season-1 league generations (32 teams: identity ambition ×
 * GM archetype/bias): a flat 0.70 let 6-7 financially-qualified teams clear it most seasons (the pool then
 * simply fills to the MAX_LEAGUE_SUPERSTARS=5 cap every time — exactly the "always 5" outcome this whole
 * license system exists to avoid). Only the top few % of ambition+star-GM combinations (near-maxed
 * ambitionN AND starPriority AND a star-hunting archetype — the Z-H/H-R/R-L/M-M calibre teams) clear 0.90;
 * a good-but-not-elite team like a B-P (ambitious, but starPriority mid-range and a non-star archetype)
 * legitimately misses it and stays on the normal Star path instead. This is what keeps the realized
 * league-wide count "typically 2-3 (observed 3-4 in test leagues), cap 5" instead of maxing out every
 * season. Deliberately a SEPARATE constant from MARQUEE_SPLURGE_SCORE_MIN below (see its own doc for why).
 */
export const MARQUEE_SCORE_MIN = 0.9;
/**
 * Cash-splurge path multiplier: a team whose spendableNet clears SPLURGE_CASH_MULT × ssPlanCost — i.e. it
 * could afford the ENTIRE marquee-plus-roster-fill plan roughly 1.6× over, real headroom well beyond just
 * scraping past the basic affordability gate — is eligible via cash alone, regardless of ambition/star-
 * hunger. "Ein Team, das sich über Jahre viel Cash erarbeitet hat, holt in der Season, wo es angreift,
 * plötzlich einen Superstar." Deliberately measured against ssPlanCost (marquee price + rest-of-roster
 * fill), NOT the bare marqueeTargetMw alone: for a normal-sized roster the fill cost dwarfs the marquee
 * price itself, so gating only on the marquee price would let almost any merely-affordable team "splurge"
 * trivially — measuring against the full plan cost keeps this a genuinely rare, cash-mountain-only path.
 */
export const SPLURGE_CASH_MULT = 1.6;
/**
 * Splurge-path score threshold — deliberately SEPARATE from (and lower than) MARQUEE_SCORE_MIN. The
 * splurge score formula weights affordability at 0.60 and ambition/star-GM at only 0.40 combined
 * (0.20·ambitionN + 0.20·(gmStarN+archBonus) + 0.60·splurgeAffordN), specifically so a team with LOW
 * ambition/star-hunger can still qualify "via cash alone" once splurgeAffordN saturates near 1 — that
 * only works if the bar sits at/below the ~0.6 ceiling the afford term alone can reach. Sharing the raised
 * MARQUEE_SCORE_MIN (0.90) here would make the splurge path nearly unreachable for exactly the low-
 * ambition hoarders it exists for, defeating its purpose — hence a dedicated, lower bar.
 */
export const MARQUEE_SPLURGE_SCORE_MIN = 0.65;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Derives which teams hold a league-wide Superstar "marquee license" this draft pass.
 *
 * poolRemaining = max(0, MAX_LEAGUE_SUPERSTARS − Σ existingSuperstarCount) — the remaining hard-cap
 * headroom once the Superstar-tier players already on rosters are counted (an existing holder is also
 * excluded from receiving a NEW license below, so this pool only ever grows the league's Superstar count
 * toward the cap, never lets a team stack a second one via this path).
 *
 * A team is financially qualified only if:
 *  - spendableNet >= ssPlanCost (a REAL gate — can actually afford the marquee slot without starving the
 *    rest of the roster; this is what excludes S-C-calibre moderate-budget teams on EITHER path below)
 *  - existingSuperstarCount === 0 (no second marquee name for an existing holder)
 *
 * Financially-qualified teams are scored via TWO INDEPENDENT paths, each gated by its OWN threshold (a
 * team can qualify via either without needing both — its marqueeScore for ranking is the max of whichever
 * path(s) it actually clears):
 *  - standard (ambition + star-GM), must clear MARQUEE_SCORE_MIN:
 *    0.45·ambitionN + 0.40·(gmStarN + archBonus) + 0.15·affordN — archBonus rewards a star-hunting
 *    archetype, affordN saturates once a team clears the ssPlanCost gate so it only ever breaks close ties.
 *  - splurge (cash mountain), only computed when spendableNet >= SPLURGE_CASH_MULT·ssPlanCost (a materially
 *    HIGHER bar than the basic affordability gate above), must clear MARQUEE_SPLURGE_SCORE_MIN (a LOWER bar
 *    than MARQUEE_SCORE_MIN — see its doc for why they must differ):
 *    0.20·ambitionN + 0.20·(gmStarN + archBonus) + 0.60·splurgeAffordN, where splurgeAffordN saturates at
 *    the elevated splurge line — so a team doesn't need ambition or a star-hungry GM at all if its cash
 *    pile alone is overwhelming enough.
 *
 * Only teams clearing at least one path's own threshold are ranked (by the best score they achieved) and
 * granted the top `poolRemaining` licenses. Ties break lexicographically on teamId (deterministic).
 */
export function deriveLeagueSuperstarLicenses(input: readonly MarqueeLicenseTeamInput[]): Set<string> {
  const existingTotal = input.reduce((sum, team) => sum + Math.max(0, team.existingSuperstarCount), 0);
  const poolRemaining = Math.max(0, MAX_LEAGUE_SUPERSTARS - existingTotal);
  if (poolRemaining <= 0) return new Set();

  // Financial qualification: a REAL gate (affordability + not already holding one). Ambition/star-hunger
  // are NOT hard-gated here — they feed the soft score below instead, so a team can compensate across axes
  // (or qualify entirely via the cash-splurge path, see below).
  const qualifiedFinancially = input.filter(
    (team) => team.existingSuperstarCount === 0 && team.spendableNet >= team.ssPlanCost,
  );
  if (qualifiedFinancially.length === 0) return new Set();

  const scored = qualifiedFinancially
    .map((team) => {
      const archBonus =
        team.archetype === "star_chaser" ? 0.15 : team.archetype === "elite_curator" || team.archetype === "risk_gambler" ? 0.05 : 0;
      const gmStarN = clamp((team.starPriority - 1) / 9, 0, 1);

      const affordN = clamp(team.spendableNet / Math.max(1, team.ssPlanCost), 0, 1);
      const standardScore = 0.45 * team.ambitionN + 0.4 * (gmStarN + archBonus) + 0.15 * affordN;
      const standardQualifies = standardScore >= MARQUEE_SCORE_MIN;

      const splurgeLine = SPLURGE_CASH_MULT * Math.max(1, team.ssPlanCost);
      const splurgeEligible = team.spendableNet >= splurgeLine;
      const splurgeAffordN = clamp(team.spendableNet / splurgeLine, 0, 1);
      const splurgeScore = 0.2 * team.ambitionN + 0.2 * (gmStarN + archBonus) + 0.6 * splurgeAffordN;
      const splurgeQualifies = splurgeEligible && splurgeScore >= MARQUEE_SPLURGE_SCORE_MIN;

      const marqueeScore = Math.max(standardQualifies ? standardScore : -Infinity, splurgeQualifies ? splurgeScore : -Infinity);
      return { teamId: team.teamId, qualifies: standardQualifies || splurgeQualifies, marqueeScore };
    })
    .filter((entry) => entry.qualifies);

  scored.sort((a, b) => b.marqueeScore - a.marqueeScore || a.teamId.localeCompare(b.teamId));

  return new Set(scored.slice(0, poolRemaining).map((entry) => entry.teamId));
}
