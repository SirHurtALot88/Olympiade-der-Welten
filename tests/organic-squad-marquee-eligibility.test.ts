import { describe, expect, it } from "vitest";

import {
  deriveLeagueSuperstarLicenses,
  MARQUEE_SCORE_MIN,
  MARQUEE_SPLURGE_SCORE_MIN,
  MAX_LEAGUE_SUPERSTARS,
  SPLURGE_CASH_MULT,
  type MarqueeLicenseTeamInput,
} from "@/lib/ai/organic-squad/marquee-eligibility";

/** A deliberately UN-qualified default team (low ambition/star-hunger, can't afford the marquee slot) —
 *  every fixture below is built from this baseline and overrides only the fields the test cares about, so
 *  a team that isn't explicitly made eligible never accidentally clears the gates/score. */
function makeTeam(teamId: string, overrides: Partial<MarqueeLicenseTeamInput> = {}): MarqueeLicenseTeamInput {
  return {
    teamId,
    ambitionN: 0.3,
    starPriority: 3,
    archetype: "bargain_hunter",
    spendableNet: 50,
    ssPlanCost: 100,
    existingSuperstarCount: 0,
    ...overrides,
  };
}

/** 32-team synthetic league fixture, teamId = T01..T32, all un-qualified by default. */
function buildLeague(overrides: Record<string, Partial<MarqueeLicenseTeamInput>> = {}): MarqueeLicenseTeamInput[] {
  return Array.from({ length: 32 }, (_, i) => {
    const teamId = `T${String(i + 1).padStart(2, "0")}`;
    return makeTeam(teamId, overrides[teamId]);
  });
}

describe("deriveLeagueSuperstarLicenses", () => {
  it("(a) never hands out more than MAX_LEAGUE_SUPERSTARS licenses even when every team is richly qualified", () => {
    const overrides: Record<string, Partial<MarqueeLicenseTeamInput>> = {};
    for (let i = 1; i <= 32; i += 1) {
      overrides[`T${String(i).padStart(2, "0")}`] = {
        ambitionN: 0.9,
        starPriority: 9,
        archetype: "star_chaser",
        spendableNet: 500,
        ssPlanCost: 100,
      };
    }
    const licenses = deriveLeagueSuperstarLicenses(buildLeague(overrides));
    expect(licenses.size).toBeLessThanOrEqual(MAX_LEAGUE_SUPERSTARS);
    expect(licenses.size).toBe(MAX_LEAGUE_SUPERSTARS);
  });

  it("(a2) a realistic mixed league (few marquee-worthy, most middling) realizes only 2-3 licenses, not always the cap", () => {
    // Mirrors a real 32-team league: most teams are financially qualified (affordable, just clearing
    // ssPlanCost — nowhere near the elevated SPLURGE_CASH_MULT line) but only a handful clear the soft
    // desirability score on the standard path — the score gate is what prevents "always fills to 5".
    const overrides: Record<string, Partial<MarqueeLicenseTeamInput>> = {};
    for (let i = 1; i <= 32; i += 1) {
      overrides[`T${String(i).padStart(2, "0")}`] = {
        ambitionN: 0.55, // middling ambition, affordable, but well under MARQUEE_SCORE_MIN
        starPriority: 5,
        archetype: "systems_tinkerer",
        spendableNet: 110, // clears ssPlanCost (100) but well below SPLURGE_CASH_MULT × ssPlanCost (160)
        ssPlanCost: 100,
      };
    }
    // Exactly 3 genuinely marquee-worthy teams (near-maxed ambition + star-hungry GM + comfortably
    // affordable — the Z-H/H-R/R-L/M-M calibre teams the raised MARQUEE_SCORE_MIN is calibrated around).
    overrides.T01 = { ambitionN: 0.9, starPriority: 10, archetype: "star_chaser", spendableNet: 400, ssPlanCost: 100 };
    overrides.T02 = { ambitionN: 0.9, starPriority: 10, archetype: "elite_curator", spendableNet: 400, ssPlanCost: 100 };
    overrides.T03 = { ambitionN: 0.9, starPriority: 10, archetype: "risk_gambler", spendableNet: 400, ssPlanCost: 100 };
    const licenses = deriveLeagueSuperstarLicenses(buildLeague(overrides));
    expect(licenses.size).toBe(3);
    expect(licenses.has("T01")).toBe(true);
    expect(licenses.has("T02")).toBe(true);
    expect(licenses.has("T03")).toBe(true);
  });

  it("(b) affordability is a REAL gate: an ambitious, star-hungry, but too-poor team never receives a license", () => {
    const league = buildLeague({
      // High ambition + star_chaser GM, but spendableNet < ssPlanCost (e.g. S-C-calibre moderate budget
      // facing the marquee price) — must be excluded regardless of score.
      T01: { ambitionN: 0.95, starPriority: 10, archetype: "star_chaser", spendableNet: 90, ssPlanCost: 100 },
      // The one genuinely affordable + qualified team, so the pool isn't empty.
      T02: { ambitionN: 0.85, starPriority: 9, archetype: "star_chaser", spendableNet: 400, ssPlanCost: 100 },
    });
    const licenses = deriveLeagueSuperstarLicenses(league);
    expect(licenses.has("T01")).toBe(false);
    expect(licenses.has("T02")).toBe(true);
  });

  it("(c) a rich star_chaser beats a high-ambition team the plan can't actually afford", () => {
    const league = buildLeague({
      // High ambition, high GM star priority — but genuinely can't afford the Superstar slot (below
      // ssPlanCost), so the afford gate excludes it entirely no matter how ambitious it is.
      T01: { ambitionN: 0.95, starPriority: 9, archetype: "talent_builder", spendableNet: 50, ssPlanCost: 100 },
      // Rich star_chaser, comfortably clears the afford gate and the (raised) score bar.
      T02: { ambitionN: 0.85, starPriority: 9, archetype: "star_chaser", spendableNet: 150, ssPlanCost: 100 },
    });
    const licenses = deriveLeagueSuperstarLicenses(league);
    expect(licenses.has("T02")).toBe(true);
    expect(licenses.has("T01")).toBe(false);
  });

  it("(d) 5 existing league-wide Superstar holders leaves 0 licenses to hand out, regardless of qualification", () => {
    const overrides: Record<string, Partial<MarqueeLicenseTeamInput>> = {
      T01: { existingSuperstarCount: 1 },
      T02: { existingSuperstarCount: 1 },
      T03: { existingSuperstarCount: 1 },
      T04: { existingSuperstarCount: 1 },
      T05: { existingSuperstarCount: 1 },
      // A perfectly-qualified 6th team should still get nothing — the pool is exhausted.
      T06: { ambitionN: 0.95, starPriority: 10, archetype: "star_chaser", spendableNet: 1000, ssPlanCost: 100 },
    };
    const licenses = deriveLeagueSuperstarLicenses(buildLeague(overrides));
    expect(licenses.size).toBe(0);
  });

  it("(e) an existing Superstar holder never receives an additional license", () => {
    const league = buildLeague({
      T01: {
        ambitionN: 0.95,
        starPriority: 10,
        archetype: "star_chaser",
        spendableNet: 1000,
        ssPlanCost: 100,
        existingSuperstarCount: 1, // already a holder
      },
    });
    const licenses = deriveLeagueSuperstarLicenses(league);
    expect(licenses.has("T01")).toBe(false);
  });

  it("a team below MARQUEE_SCORE_MIN but financially qualified is excluded even with headroom in the pool", () => {
    const league = buildLeague({
      // Affordable, but low ambition/star-hunger ⇒ standard score well under MARQUEE_SCORE_MIN, and NOT a
      // cash splurge (spendableNet stays below SPLURGE_CASH_MULT × ssPlanCost = 160).
      T01: { ambitionN: 0.4, starPriority: 4, archetype: "bargain_hunter", spendableNet: 120, ssPlanCost: 100 },
    });
    const licenses = deriveLeagueSuperstarLicenses(league);
    expect(licenses.size).toBe(0);
    expect(licenses.has("T01")).toBe(false);
  });

  it("returns an empty set when no team clears the gates", () => {
    const licenses = deriveLeagueSuperstarLicenses(buildLeague());
    expect(licenses.size).toBe(0);
  });

  it("is deterministic / order-independent for a fixed input set (tiebreak is a pure function of the data)", () => {
    const league = buildLeague({
      T10: { ambitionN: 0.9, starPriority: 10, archetype: "star_chaser", spendableNet: 300, ssPlanCost: 100 },
      T20: { ambitionN: 0.9, starPriority: 10, archetype: "star_chaser", spendableNet: 300, ssPlanCost: 100 },
    });
    const shuffled = [...league].reverse();
    const a = deriveLeagueSuperstarLicenses(league);
    const b = deriveLeagueSuperstarLicenses(shuffled);
    expect([...a].sort()).toEqual([...b].sort());
  });

  it("MARQUEE_SCORE_MIN is within (0, 1.06] so the score gate is meaningful (not trivially always-pass/always-fail)", () => {
    expect(MARQUEE_SCORE_MIN).toBeGreaterThan(0);
    expect(MARQUEE_SCORE_MIN).toBeLessThanOrEqual(1.06);
  });

  it("MARQUEE_SPLURGE_SCORE_MIN is strictly lower than MARQUEE_SCORE_MIN (splurge must stay reachable via cash alone)", () => {
    // The splurge formula weights afford at only 0.60, so a near-zero-ambition/star team can reach at most
    // ~0.60 through cash alone — sharing the raised standard-path bar would make the splurge path
    // unreachable for exactly the low-ambition hoarders it's designed for.
    expect(MARQUEE_SPLURGE_SCORE_MIN).toBeLessThan(MARQUEE_SCORE_MIN);
    expect(MARQUEE_SPLURGE_SCORE_MIN).toBeGreaterThan(0);
  });

  describe("cash-splurge path", () => {
    it("a cash-mountain team with LOW ambition and a non-star-hunting GM still earns a license via cash alone", () => {
      const ssPlanCost = 100;
      const splurgeCash = SPLURGE_CASH_MULT * ssPlanCost * 1.3; // comfortably past the splurge line
      const league = buildLeague({
        T01: {
          ambitionN: 0.35, // well under the standard-path bar
          starPriority: 3, // non-star-hungry GM
          archetype: "facility_architect", // no archBonus
          spendableNet: splurgeCash,
          ssPlanCost,
        },
      });
      const licenses = deriveLeagueSuperstarLicenses(league);
      expect(licenses.has("T01")).toBe(true);
    });

    it("a team merely clearing basic ssPlanCost affordability (not the elevated splurge line) does NOT qualify on ambition/star alone", () => {
      const league = buildLeague({
        T01: {
          ambitionN: 0.35,
          starPriority: 3,
          archetype: "facility_architect",
          spendableNet: 110, // clears ssPlanCost (100) but nowhere near SPLURGE_CASH_MULT × ssPlanCost (160)
          ssPlanCost: 100,
        },
      });
      const licenses = deriveLeagueSuperstarLicenses(league);
      expect(licenses.has("T01")).toBe(false);
    });

    it("a poor (S-C-calibre) team never splurges — the basic ssPlanCost gate excludes it before the splurge line is even checked", () => {
      const league = buildLeague({
        T01: {
          ambitionN: 0.6,
          starPriority: 5,
          archetype: "bargain_hunter",
          spendableNet: 130, // below ssPlanCost (150: marquee 75 + 9 depth-floor slots) — genuinely can't afford
          ssPlanCost: 150,
        },
      });
      const licenses = deriveLeagueSuperstarLicenses(league);
      expect(licenses.has("T01")).toBe(false);
    });

    it("splurge and standard paths both feed the SAME league-wide pool cap", () => {
      const overrides: Record<string, Partial<MarqueeLicenseTeamInput>> = {};
      // 3 standard-path marquee teams + 3 splurge-path hoarders = 6 candidates chasing a 5-slot pool.
      for (let i = 1; i <= 3; i += 1) {
        overrides[`T0${i}`] = { ambitionN: 0.85, starPriority: 9, archetype: "star_chaser", spendableNet: 400, ssPlanCost: 100 };
      }
      for (let i = 4; i <= 6; i += 1) {
        overrides[`T0${i}`] = {
          ambitionN: 0.3,
          starPriority: 3,
          archetype: "facility_architect",
          spendableNet: SPLURGE_CASH_MULT * 100 * 1.3,
          ssPlanCost: 100,
        };
      }
      const licenses = deriveLeagueSuperstarLicenses(buildLeague(overrides));
      // 6 qualifying candidates (3 standard + 3 splurge) chasing a 5-slot pool ⇒ exactly the cap, one excluded.
      expect(licenses.size).toBe(MAX_LEAGUE_SUPERSTARS);
    });
  });
});
