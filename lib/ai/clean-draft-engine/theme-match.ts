import type { Player } from "@/lib/data/olyDataTypes";
import type { TransfermarktFreeAgentItem } from "@/lib/market/transfermarkt-read-service";
import {
  classifyIdentityQuotaRole,
  derivePlayerThemeTags,
  isQuotaScopedTarget,
  type TeamThemeCompositionTarget,
} from "@/lib/ai/team-theme-composition-service";

/**
 * Minimal Player projection of a free-agent candidate carrying exactly the fields the canonical theme
 * tagger (derivePlayerThemeTags) and the quota classifier (classifyIdentityQuotaRole) read: race,
 * className, gender, alignment, subclasses, traits, name. Without gender/subclasses/traits the tagger
 * misses Female/Succubus/Undead/etc. tags entirely (the bug that left D-P & co. themeless).
 */
export function candidateToThemePlayer(candidate: TransfermarktFreeAgentItem): Player {
  return {
    id: candidate.playerId,
    name: candidate.name ?? candidate.playerId,
    race: candidate.race ?? "",
    className: candidate.className ?? "",
    gender: candidate.gender ?? "",
    alignment: candidate.alignment ?? "",
    subclasses: candidate.subclasses ?? [],
    traitsPositive: candidate.traitsPositive ?? [],
    traitsNegative: candidate.traitsNegative ?? [],
  } as unknown as Player;
}

/**
 * Canonical theme matching for the clean S1 draft engine.
 *
 * The old clean-engine theme only read `raceQuotaScoped.races`, which exists on just two teams
 * (R-R fish/aqua/lizard, H-R demon). Every other team themes via `primaryThemeTags` / gender quota,
 * so ~30 teams drafted with NO identity signal (random rosters, e.g. D-P losing its Female/Succubus
 * identity). This helper reuses the SAME canonical tag derivation + quota classification the audit
 * uses (derivePlayerThemeTags / classifyIdentityQuotaRole), so every themed team gets a real on-theme
 * signal — without needing a full GameState (the clean engine is gameState-free by design). The tier
 * weights mirror calculateThemeCompositionScore so the draft and the audit agree on what "on theme"
 * means.
 */

export type CleanThemeTier = "core" | "secondary" | "soft" | "outsider_allowed" | "outsider" | "exempt" | "avoid";

export type CleanThemeEval = {
  /** Counts toward the theme share (primary or secondary match / quota "counts"). */
  counts: boolean;
  tier: CleanThemeTier;
  /** Theme score contribution BEFORE any premium-slot multiplier (negative for outsider/avoid). */
  bonus: number;
};

function hasAny(tags: Set<string>, list: string[] | undefined | null): boolean {
  if (!list) return false;
  for (const tag of list) if (tags.has(tag)) return true;
  return false;
}

function strictnessWeight(strictness: TeamThemeCompositionTarget["strictness"] | null | undefined): number {
  return strictness === "hard" ? 1.4 : strictness === "strong" ? 1.15 : strictness === "medium" ? 0.9 : 0.65;
}

/**
 * Evaluate a candidate against a team's full theme target. Uses the tracked on-theme share
 * (onThemeCountSoFar / rosterCountSoFar) as a gameState-free proxy for the roster share, so the
 * below-minimum / below-target urgency still fires while the roster fills.
 */
export function evaluateCleanTheme(input: {
  player: Player;
  target: TeamThemeCompositionTarget | null;
  onThemeCountSoFar: number;
  rosterCountSoFar: number;
}): CleanThemeEval {
  const target = input.target;
  if (!target) return { counts: false, tier: "soft", bonus: 0 };

  const tags = new Set(derivePlayerThemeTags(input.player).playerThemeTags);
  const quotaScoped = isQuotaScopedTarget(target);
  const quotaRole = quotaScoped ? classifyIdentityQuotaRole(input.player, target) : "none";
  const quotaCounts = quotaRole === "counts";
  const quotaExempt = quotaRole === "exempt";
  const quotaViolates = quotaRole === "violates";

  const primaryTag = hasAny(tags, target.primaryThemeTags);
  const primaryMatch = quotaScoped ? quotaCounts : primaryTag;
  const secondaryMatch = hasAny(tags, target.secondaryThemeTags);
  const softMatch = hasAny(tags, target.softPreferredTags);
  const allowedOutsider = hasAny(tags, target.allowedOutsiderTags);

  // A primary/secondary theme match (or a quota "counts"/"exempt") is an identity override — it
  // suppresses the avoid-tag malus, mirroring calculateThemeCompositionScore.
  const hardOverride = quotaScoped ? quotaCounts || quotaExempt : primaryTag || secondaryMatch;
  const avoidMatch = hasAny(tags, target.avoidTags) && !hardOverride;

  const sw = strictnessWeight(target.strictness);
  const currentShare = input.rosterCountSoFar > 0 ? input.onThemeCountSoFar / input.rosterCountSoFar : 0;
  const minimumShare = Number.isFinite(target.minimumShare) ? target.minimumShare : 0;
  const targetShare = Number.isFinite(target.targetShare) ? target.targetShare : 0;
  const belowMinimum = currentShare < minimumShare;
  const belowTarget = currentShare < targetShare;

  let tier: CleanThemeTier;
  let bonus = 0;
  if (primaryMatch) {
    tier = "core";
    bonus += 24 * sw;
  } else if (secondaryMatch) {
    tier = "secondary";
    bonus += 13 * sw;
  } else if (softMatch) {
    tier = "soft";
    bonus += 6;
  } else if (quotaExempt) {
    // Quota-exempt (e.g. D-P non-humanoid animals/dragons): neutral — never counts toward the quota,
    // but is not a violation, so no outsider malus.
    tier = "exempt";
  } else if (allowedOutsider) {
    tier = "outsider_allowed";
    bonus += -7;
  } else {
    tier = "outsider";
    bonus += -18 * sw;
  }

  if (avoidMatch) {
    tier = "avoid";
    bonus += -26 * sw;
  }

  // Below-minimum / below-target urgency: pull the roster toward its identity while short.
  if (belowMinimum && (primaryMatch || secondaryMatch)) {
    bonus += 18 * sw;
  } else if (belowTarget && (primaryMatch || secondaryMatch || softMatch)) {
    bonus += 8 * sw;
  }

  // Hard-quota teams (L-R, L-K, H-R, D-P …): a strong pull to reach the minimum, and a real (but
  // NOT hard-blocking) penalty for missing it — softer than the audit's -80 so a clearly superior
  // off-theme player can still win the marquee slot.
  if (target.strictness === "hard" && belowMinimum) {
    const recoveryEligible = quotaScoped ? quotaCounts : primaryMatch || secondaryMatch;
    const missEligible = quotaScoped ? quotaViolates : !(primaryMatch || secondaryMatch);
    if (recoveryEligible) bonus += 35;
    else if (missEligible) bonus += -40;
  }

  const counts = primaryMatch || secondaryMatch;
  return { counts, tier, bonus };
}

/**
 * Data-driven HARD-FOCUS eligibility. For `strictness: "hard"` teams (L-R/L-K undead, H-R demon,
 * D-P/V-D female-humanoid + exempt animals/pets, S-S construct, P-C pirate, D-L human, T-G giant)
 * the identity is a hard requirement, not a soft lean: the team must not buy plain off-theme players.
 * This reproduces the legacy getHardFocusRuleFailure gate purely from the theme target (no team-code
 * hardcodes) — quota "counts"/"exempt", primary/secondary/soft matches and explicitly-allowed
 * outsiders stay eligible; only plain outsiders and avoid-tag players are excluded. Non-hard teams
 * never filter (theme stays a scoring lean).
 */
export function isCleanThemeHardEligible(evaluation: CleanThemeEval, target: TeamThemeCompositionTarget | null): boolean {
  if (!target || target.strictness !== "hard") return true;
  return evaluation.tier !== "outsider" && evaluation.tier !== "avoid";
}
