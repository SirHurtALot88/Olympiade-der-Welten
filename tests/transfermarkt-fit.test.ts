import { describe, expect, it } from "vitest";

import {
  MERCENARY_NEGATIVE_FIT_PENALTY,
  MERCENARY_NEGATIVE_FIT_PENALTY_REASON,
  NEGATIVE_MERCENARY_FIT_MALUS,
  applyMercenaryNegativeFitPenaltyToFinalPickScore,
  calculateTransfermarktFit,
  getMercenaryNegativeFitPenalty,
  getNegativeMercenaryFitMalus,
  isNegativeMercenaryFitMalusExemptTeam,
} from "@/lib/market/transfermarkt-fit";
import { getTeamRaceFit, getTeamSubclassFit, getTeamSubclassFitSum } from "@/lib/market/team-fit-matrix";

describe("transfermarkt fit helpers", () => {
  it("adds a small malus for negative-fit mercenaries outside Wrecking Legionnaires", () => {
    expect(
      getNegativeMercenaryFitMalus({
        teamId: "A-A",
        isMercenary: true,
        teamFit: -1.2,
      }),
    ).toBe(NEGATIVE_MERCENARY_FIT_MALUS);
    expect(
      getMercenaryNegativeFitPenalty({
        teamId: "A-A",
        isMercenary: true,
        teamFit: -1.2,
      }),
    ).toBe(MERCENARY_NEGATIVE_FIT_PENALTY);
    expect(MERCENARY_NEGATIVE_FIT_PENALTY_REASON).toBe("negative_fit_mercenary_penalty");
  });

  it("applies the mercenary penalty only to the final pick score", () => {
    expect(
      applyMercenaryNegativeFitPenaltyToFinalPickScore({
        finalPickScoreBeforePenalty: 42,
        mercenaryNegativeFitPenalty: MERCENARY_NEGATIVE_FIT_PENALTY,
      }),
    ).toBe(40.5);
  });

  it("does not penalize Wrecking Legionnaires mercenaries", () => {
    expect(isNegativeMercenaryFitMalusExemptTeam({ teamId: "W-L" })).toBe(true);
    expect(isNegativeMercenaryFitMalusExemptTeam({ teamName: "Wrecking Legionnaires" })).toBe(true);
    expect(
      getNegativeMercenaryFitMalus({
        teamId: "W-L",
        isMercenary: true,
        teamFit: -4,
      }),
    ).toBe(0);
    expect(
      getMercenaryNegativeFitPenalty({
        teamId: "W-L",
        isMercenary: true,
        teamFit: -4,
      }),
    ).toBe(0);
  });

  it("keeps non-mercenaries and non-negative fits unchanged", () => {
    expect(getNegativeMercenaryFitMalus({ teamId: "A-A", isMercenary: false, teamFit: -5 })).toBe(0);
    expect(getNegativeMercenaryFitMalus({ teamId: "A-A", isMercenary: true, teamFit: 0 })).toBe(0);
    expect(getNegativeMercenaryFitMalus({ teamId: "A-A", isMercenary: true, teamFit: 3 })).toBe(0);
    expect(getMercenaryNegativeFitPenalty({ teamId: "A-A", isMercenary: false, teamFit: -5 })).toBe(0);
    expect(getMercenaryNegativeFitPenalty({ teamId: "A-A", isMercenary: true, teamFit: 3 })).toBe(0);
  });

  it("does not change the displayed transfermarkt fit values", () => {
    const mercenary = {
      race: "Elf",
      alignment: "Chaotic",
      subclasses: ["Raider"],
      traitsPositive: ["Mercenary"],
      traitsNegative: [],
    };
    const roster = [
      {
        race: "Human",
        alignment: "Lawful",
        subclasses: ["Guardian"],
        traitsPositive: ["Disciplined"],
        traitsNegative: [],
      },
    ];
    const fitBeforePenalty = calculateTransfermarktFit(mercenary, roster);
    const teamFitScore = fitBeforePenalty.teamFit;
    const teamIdentityScore = fitBeforePenalty.teamFit;

    expect(getMercenaryNegativeFitPenalty({ teamId: "A-A", isMercenary: true, teamFit: teamFitScore })).toBe(
      MERCENARY_NEGATIVE_FIT_PENALTY,
    );
    expect(calculateTransfermarktFit(mercenary, roster)).toEqual(fitBeforePenalty);
    expect(teamFitScore).toBe(fitBeforePenalty.teamFit);
    expect(teamIdentityScore).toBe(fitBeforePenalty.teamFit);
  });

  it("loads race and subclass fits from the synced team fit matrix", () => {
    expect(getTeamRaceFit({ teamId: "C-C", race: "Human" })).toBe(4);
    expect(getTeamSubclassFit({ teamId: "W-W", subclass: "Mage" })).toBe(5);
    expect(getTeamSubclassFitSum({ teamId: "C-C", subclasses: ["Lord", "Ambassador"] })).toBe(10);
  });

  it("uses synced race and subclass matrix values when teamId is provided", () => {
    const fit = calculateTransfermarktFit(
      {
        race: "Human",
        alignment: "Neutral",
        subclasses: ["Lord", "Ambassador"],
        traitsPositive: [],
        traitsNegative: [],
      },
      [],
      { teamId: "C-C" },
    );

    expect(fit.fitRace).toBe(4);
    expect(fit.fitSubclasses).toBe(10);
    expect(fit.teamFit).toBe(14);
  });
});
