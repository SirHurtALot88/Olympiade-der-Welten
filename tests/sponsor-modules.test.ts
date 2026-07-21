import { describe, expect, it } from "vitest";

import type { SponsorOffer, SponsorOfferComponent } from "@/lib/data/olyDataTypes";
import {
  SPONSOR_PERK_SPOTLIGHT_X2,
  applySpotlightPerkToComponents,
  buildSponsorOfferModuleIds,
  describeSponsorOfferModules,
  offerQualifiesForSpotlightPerk,
} from "@/lib/sponsor/sponsor-modules";

function makeOffer(overrides: Partial<SponsorOffer> = {}): SponsorOffer {
  const components: SponsorOfferComponent[] = [
    { componentId: "base-cash", kind: "base", label: "Basis", targetValue: 40, rewardCash: 40 },
    { componentId: "rank-target", kind: "rank", label: "Gewinnstufen", targetValue: 8, rewardCash: 20 },
    { componentId: "special-x", kind: "special", label: "Sonderziel", targetValue: "x", rewardCash: 8, specialKey: "form_color_cover", spotlightBonus: 0.2 },
    { componentId: "overperformance", kind: "overperformance", label: "Überperformance", targetValue: 14, rewardCash: 14, ratePerUnitC: 1.8 },
  ];
  return {
    offerId: "o1",
    seasonId: "season-1",
    teamId: "M-M",
    archetype: "performance",
    rarity: "magisch",
    name: "Test",
    flavor: "",
    components,
    totalUpsideEstimate: 82,
    ...overrides,
  };
}

describe("sponsor Baukasten modules (P4)", () => {
  it("maps each cash component to a module and lists ids", () => {
    const offer = makeOffer();
    const modules = describeSponsorOfferModules(offer);
    expect(modules.map((m) => m.kind)).toEqual(["base_income", "rank_ladder", "special_objective", "overperformance"]);
    expect(modules.every((m) => m.cash)).toBe(true);
    expect(buildSponsorOfferModuleIds(offer)).toEqual(["base-cash", "rank-target", "special-x", "overperformance"]);
  });

  it("adds a non-cash Spotlight perk only for legendär or golden", () => {
    expect(offerQualifiesForSpotlightPerk("magisch", false)).toBe(false);
    expect(offerQualifiesForSpotlightPerk("legendär", false)).toBe(true);
    expect(offerQualifiesForSpotlightPerk("gewöhnlich", true)).toBe(true); // golden

    const legendary = makeOffer({ rarity: "legendär" });
    const modules = describeSponsorOfferModules(legendary);
    const perk = modules.find((m) => m.kind === "perk");
    expect(perk?.id).toBe(SPONSOR_PERK_SPOTLIGHT_X2);
    expect(perk?.cash).toBe(false);
    expect(buildSponsorOfferModuleIds(legendary)).toContain(SPONSOR_PERK_SPOTLIGHT_X2);
  });

  it("Spotlight perk doubles the special's spotlightBonus (cash-neutral) for legendär, no-op otherwise", () => {
    const base = makeOffer().components;
    const magisch = applySpotlightPerkToComponents(base, "magisch", false);
    expect(magisch.find((c) => c.kind === "special")?.spotlightBonus).toBe(0.2); // unverändert

    const legendary = applySpotlightPerkToComponents(base, "legendär", false);
    expect(legendary.find((c) => c.kind === "special")?.spotlightBonus).toBeCloseTo(0.4, 5); // ×2
    // Cash unverändert (Perk ist rein Popularity):
    const cashBefore = base.reduce((s, c) => s + c.rewardCash, 0);
    const cashAfter = legendary.reduce((s, c) => s + c.rewardCash, 0);
    expect(cashAfter).toBe(cashBefore);
  });
});
