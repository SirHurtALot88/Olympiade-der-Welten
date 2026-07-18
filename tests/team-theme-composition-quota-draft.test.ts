import { describe, expect, it } from "vitest";

import { createGameStateFromSeed, loadFreshSeasonOneSeedData } from "@/lib/data/dataAdapter";
import { planOrganicDraftForTeam } from "@/lib/ai/organic-squad/draft-adapter";
import {
  classifyIdentityQuotaRole,
  derivePlayerThemeTags,
  getTeamThemeCompositionTarget,
} from "@/lib/ai/team-theme-composition-service";
import type { GameState, Player } from "@/lib/data/olyDataTypes";

/**
 * Real end-to-end draft check for the AI squad-builder RACE/THEME composition fixes:
 * - hard race/tag quotas are honoured (S-S ~50% Construct/Bots, P-C ~50% Pirate),
 * - the best/top pick of a hard-quota team is a strong theme fit (S-S top pick is a Construct),
 * - a monster-variety team (T-G) pulls its SECONDARY thematic races (dragons/constructs), not just
 *   its primary race, and keeps clearly-off-theme fillers (Dwarf) OUT.
 * Runs the organic draft on the real season-1 seed pool so it exercises derivePlayerThemeTags,
 * the quota classification, and computeThemeFit together (not a synthetic fixture).
 */
function draftTeam(gs: GameState, teamId: string): Player[] {
  const team = gs.teams.find((t) => t.teamId === teamId);
  if (!team) throw new Error(`team ${teamId} not in seed`);
  const identity = (gs.teamIdentities ?? []).find((i) => i.teamId === teamId) ?? null;
  const result = planOrganicDraftForTeam({
    gameState: gs,
    team,
    identity,
    startingSquad: [],
    candidates: gs.players.slice(),
    draftSeed: `quota-test:${teamId}`,
  });
  const byId = new Map(gs.players.map((p) => [p.id, p] as const));
  return result.decisions.map((d) => byId.get(d.playerId)).filter((p): p is Player => Boolean(p));
}

function quotaShare(picks: Player[], teamId: string): number {
  const target = getTeamThemeCompositionTarget(teamId)!;
  const counts = picks.filter((p) => classifyIdentityQuotaRole(p, target) === "counts").length;
  return picks.length === 0 ? 0 : counts / picks.length;
}

const race = (p: Player) => String(p.race ?? "").toLowerCase();

describe("team-theme-composition quota + variety (real seed draft)", () => {
  const gs = createGameStateFromSeed(loadFreshSeasonOneSeedData());

  it("S-S meets its hard ~50% Construct/Bot quota and its top pick is a Construct", () => {
    const picks = draftTeam(gs, "S-S");
    expect(picks.length).toBeGreaterThan(0);
    const target = getTeamThemeCompositionTarget("S-S")!;
    expect(target.raceQuotaScoped?.races).toContain("construct");
    // Hard quota floor honoured (minimumShare, "more is better").
    expect(quotaShare(picks, "S-S")).toBeGreaterThanOrEqual(target.minimumShare);
    // The best/top pick must be a strong theme fit, not an off-theme (e.g. Orc) power pick.
    expect(race(picks[0])).toBe("construct");
  });

  it("P-C meets its hard ~50% Pirate tag quota (not zero pirates)", () => {
    const picks = draftTeam(gs, "P-C");
    expect(picks.length).toBeGreaterThan(0);
    const target = getTeamThemeCompositionTarget("P-C")!;
    expect(target.themeTagQuotaScoped?.tags).toContain("Pirate");
    expect(quotaShare(picks, "P-C")).toBeGreaterThanOrEqual(target.minimumShare);
  });

  it("T-G (Giants) pulls secondary thematic races (dragon/construct variety) and excludes off-theme Dwarf", () => {
    const picks = draftTeam(gs, "T-G");
    expect(picks.length).toBeGreaterThan(0);
    const races = picks.map(race);
    // Secondary thematic variety: the roster is NOT a single-race monoculture and includes at least
    // one non-Tauren monster race (dragon or construct-giant).
    expect(races.some((r) => r === "dragon" || r === "construct")).toBe(true);
    expect(new Set(races).size).toBeGreaterThanOrEqual(3);
    // Clearly-off-theme filler (Dwarf) must not leak in.
    expect(races).not.toContain("dwarf");
  });
});

describe("derivePlayerThemeTags emits previously-missing monster race tags", () => {
  const tagsFor = (over: Partial<Player>) =>
    derivePlayerThemeTags({
      id: "x",
      name: "X",
      race: over.race ?? "Human",
      className: over.className ?? "Fighter",
      alignment: "Neutral",
      gender: "unknown",
      subclasses: over.subclasses ?? [],
      traitsPositive: [],
      traitsNegative: [],
      coreStats: { pow: 50, spe: 50, men: 50, soc: 50 },
      preferredDisciplineIds: [],
      disciplineRatings: {},
    } as Player).playerThemeTags;

  it("tags Dragon/Orc/Tauren races (referenced by team targets but formerly never emitted)", () => {
    expect(tagsFor({ race: "Dragon" })).toEqual(expect.arrayContaining(["Dragon", "Monster"]));
    expect(tagsFor({ race: "Orc" })).toContain("Orc");
    expect(tagsFor({ race: "Tauren" })).toEqual(expect.arrayContaining(["Tauren", "Monster", "Tall"]));
  });
});
