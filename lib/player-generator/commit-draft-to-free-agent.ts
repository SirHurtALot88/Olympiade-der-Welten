import type { GameState, Player, PlayerGeneratorDraft } from "@/lib/data/olyDataTypes";
import { getTransfermarktTierFromPoints } from "@/lib/market/transfermarkt-sheet-stats";

/**
 * Player-Generator Phase 2 — "Als Free Agent übernehmen" commit path.
 *
 * A free agent in this game is simply a `Player` in `gameState.players` that
 * no `gameState.rosters` entry points at (see
 * `lib/market/transfermarkt-local-service.ts`'s `rosterPlayerIds` filter and
 * `app/api/transfermarkt/free-agents/route.ts`). There is no separate
 * "free agent" table/flag, so committing a draft is nothing more than
 * appending a fully-materialized `Player` to `gameState.players` — we
 * deliberately never touch `gameState.rosters`, so the new player is a free
 * agent from the moment this function returns (Decision: no review queue —
 * the player is immediately visible in the Transfermarkt free-agent pool,
 * same as every other free agent).
 *
 * This module is intentionally pure (no filesystem/db access, no `Date.now`
 * side effects beyond an id suffix) so it can be unit tested directly and
 * reused from the guarded API route (`app/api/player-generator/commit/route.ts`)
 * without pulling in persistence.
 */

export type CommitDraftAsFreeAgentResult =
  | {
      ok: true;
      gameState: GameState;
      playerId: string;
      player: Player;
    }
  | {
      ok: false;
      error: CommitDraftBlockedReason;
    };

export type CommitDraftBlockedReason =
  | "draft_missing_market_value"
  | "draft_missing_salary"
  | "draft_missing_ability_score"
  | "draft_validation_blocked";

const DEFAULT_ALIGNMENT = "N";
const DEFAULT_GENDER = "x";

function roundTo2(value: number) {
  return Number(value.toFixed(2));
}

function slugifyName(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "spieler";
}

/**
 * Mirrors `buildPlayerId` from `lib/player-import/character-import-service.ts`
 * (same `player-<n>-<slug>` scheme) but is duplicated here on purpose: that
 * helper lives in an offline import module that also touches the
 * filesystem, and this commit path must stay pure/I-O free. Falls back to a
 * numeric suffix on the rare name collision instead of ever reusing an id.
 */
function buildFreeAgentPlayerId(name: string, existingPlayers: Player[]): string {
  const maxNumber = existingPlayers.reduce((max, player) => {
    const match = player.id.match(/^player-(\d+)-/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const slug = slugifyName(name);
  const existingIds = new Set(existingPlayers.map((player) => player.id));
  let candidate = `player-${maxNumber + 1}-${slug}`;
  let attempt = 2;
  while (existingIds.has(candidate)) {
    candidate = `player-${maxNumber + 1}-${slug}-${attempt}`;
    attempt += 1;
  }
  return candidate;
}

/** Same >20/>40/>60/>80 tiering used league-wide, see discipline-rating-engine.ts. */
function deriveDisciplineTierCounts(disciplineRatings: Record<string, number>): Player["disciplineTierCounts"] {
  const values = Object.values(disciplineRatings);
  return {
    above20: values.filter((value) => value > 20).length,
    above40: values.filter((value) => value > 40).length,
    above60: values.filter((value) => value > 60).length,
    above80: values.filter((value) => value > 80).length,
  };
}

/** Top-3 disciplines by rating, same fallback used league-wide when no explicit picks exist. */
function derivePreferredDisciplineIds(disciplineRatings: Record<string, number>): string[] {
  return Object.entries(disciplineRatings)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([disciplineId]) => disciplineId);
}

function buildAttributeSheetRatings(attributes: PlayerGeneratorDraft["generated"]["attributes"]): NonNullable<Player["attributeSheetRatings"]> {
  return {
    powerRating: getTransfermarktTierFromPoints(attributes.power),
    healthRating: getTransfermarktTierFromPoints(attributes.health),
    staminaRating: getTransfermarktTierFromPoints(attributes.stamina),
    intelligenceRating: getTransfermarktTierFromPoints(attributes.intelligence),
    awarenessRating: getTransfermarktTierFromPoints(attributes.awareness),
    determinationRating: getTransfermarktTierFromPoints(attributes.determination),
    speedRating: getTransfermarktTierFromPoints(attributes.speed),
    dexterityRating: getTransfermarktTierFromPoints(attributes.dexterity),
    charismaRating: getTransfermarktTierFromPoints(attributes.charisma),
    willRating: getTransfermarktTierFromPoints(attributes.will),
    spiritRating: getTransfermarktTierFromPoints(attributes.spirit),
    tormentRating: getTransfermarktTierFromPoints(attributes.torment),
  };
}

/**
 * Defense-in-depth re-check of the draft's own `saveStatus.commitReasons`
 * (see `validateGeneratedPlayerDraft` in `player-generator-service.ts`).
 * The panel already disables the commit button on these reasons, but this
 * server-side function is the balance-sensitive authority and must not
 * trust the client to have re-derived them honestly.
 */
function findBlockingReason(draft: PlayerGeneratorDraft): CommitDraftBlockedReason | null {
  if (draft.generated.marketValue == null) {
    return "draft_missing_market_value";
  }
  if (draft.generated.salary == null) {
    return "draft_missing_salary";
  }
  if (draft.generated.ovr == null) {
    return "draft_missing_ability_score";
  }
  if (draft.validationStatus === "blocked_archetype_conflict" || draft.validationStatus === "blocked_missing_engine") {
    return "draft_validation_blocked";
  }
  return null;
}

export function commitDraftAsFreeAgent(input: {
  gameState: GameState;
  draft: PlayerGeneratorDraft;
  /** Unused by the pure mapping itself; accepted so callers can thread the
   * save id through without a second wrapper object (kept for API
   * symmetry with the guarded route, which needs it to load/persist). */
  saveId?: string;
}): CommitDraftAsFreeAgentResult {
  const { gameState, draft } = input;

  const blockingReason = findBlockingReason(draft);
  if (blockingReason) {
    return { ok: false, error: blockingReason };
  }

  const generated = draft.generated;
  const playerId = buildFreeAgentPlayerId(generated.name, gameState.players);

  // --- Decisions (see PR description / code review for owner sign-off) ---
  // * rating/ovr: the draft's already-computed peak-weighted CA
  //   (`generated.ovr`, Phase 1). No re-derivation against the league.
  // * marketValue/salaryDemand: the draft's heuristic estimate
  //   (`generated.marketValue` / `generated.salary`), i.e. whatever the
  //   generator preview already showed the caller — never recomputed here.
  // * potential: the draft's already-computed potential (Phase 1's real
  //   CA/PO model); falls back to `ovr` only in the (blocked-otherwise)
  //   case that the generator genuinely couldn't derive one.
  // * alignment/gender: the generator has no alignment/gender axis at all
  //   (see `PlayerGeneratorInput`), so both default to the same sentinel
  //   values already used for missing import data elsewhere
  //   (`lib/data/playerImportRepairs.ts` repairRileyLeRogue: alignment "N",
  //   gender "x").
  // * visibility: no review queue — inserted straight into `gameState.players`
  //   with no roster entry, so it is an ordinary free agent immediately.
  const ovr = generated.ovr as number;
  const marketValue = generated.marketValue as number;
  const salary = generated.salary as number;
  const potential = generated.potential ?? ovr;

  const player: Player = {
    id: playerId,
    name: generated.name,
    portraitPath: null,
    portraitUrl: generated.portraitUrl ?? null,
    rating: roundTo2(ovr),
    marketValue: roundTo2(marketValue),
    salaryDemand: roundTo2(salary),
    pps: generated.pps,
    ovr: roundTo2(ovr),
    className: generated.className,
    race: generated.race,
    alignment: DEFAULT_ALIGNMENT,
    gender: DEFAULT_GENDER,
    referenceClass: null,
    imageSource: "player-generator",
    bracketLabel: null,
    subclasses: [...generated.subclasses],
    traitsPositive: [...generated.traitsPositive],
    traitsNegative: [...generated.traitsNegative],
    coreStats: { ...generated.axes },
    attributeSheetStats: { ...generated.attributes },
    attributeSheetRatings: buildAttributeSheetRatings(generated.attributes),
    preferredDisciplineIds: derivePreferredDisciplineIds(generated.disciplineRatings),
    disciplineRatings: { ...generated.disciplineRatings },
    disciplineTierCounts: deriveDisciplineTierCounts(generated.disciplineRatings),
    flavorEn: "",
    flavorDe: "",
    fatigue: 0,
    form: 0,
    potential: roundTo2(potential),
  };

  const nextGameState: GameState = {
    ...gameState,
    players: [...gameState.players, player],
  };

  return {
    ok: true,
    gameState: nextGameState,
    playerId,
    player,
  };
}
