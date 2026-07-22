import { describe, expect, it } from "vitest";

import type { SponsorCurveFamily, SponsorOffer, SponsorOfferComponent, SponsorRarity } from "@/lib/data/olyDataTypes";
import {
  SPONSOR_MODULE_COUNT_BY_RARITY,
  SPONSOR_PERK_SPOTLIGHT_X2,
  SPONSOR_RISK_PREMIUM,
  applySpotlightPerkToComponents,
  buildSponsorOfferModuleIds,
  composeSponsorOfferComponentsP4b,
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

// ── P4b: tiefe modulare Komposition ───────────────────────────────────────────────────────────────────
describe("sponsor Baukasten P4b — modular composition", () => {
  // Volle P0–P3-Komponentenliste (base + rank + improvement + special[+fanInfra] + overperf) als Ausgangs-
  // punkt der Umverteilung. rankEvAtExpected getrennt (kommt aus der gelockten Kurve).
  function fullComponents(): SponsorOfferComponent[] {
    return [
      { componentId: "base-cash", kind: "base", label: "Basis", targetValue: 46, rewardCash: 46 },
      { componentId: "rank-target", kind: "rank", label: "Gewinnstufen", targetValue: 8, rewardCash: 28 },
      { componentId: "improvement-target", kind: "improvement", label: "Tabellenziel", targetValue: 1, rewardCash: 7.5, ratePerUnitC: 1.5, maxUnits: 5 },
      { componentId: "special-x", kind: "special", label: "Sonderziel", targetValue: "x", rewardCash: 9, specialKey: "momentum_series", spotlightBonus: 0.2 },
      { componentId: "special-fan-infrastructure", kind: "special", label: "Fan-Infrastruktur", targetValue: 1, rewardCash: 2.5, specialKey: "fan_infrastructure" },
      { componentId: "overperformance", kind: "overperformance", label: "Überperformance", targetValue: 14, rewardCash: 12, ratePerUnitC: 1.5 },
    ];
  }

  function compose(rarity: SponsorRarity, family: SponsorCurveFamily = "stetig") {
    return composeSponsorOfferComponentsP4b({
      components: fullComponents(),
      rarity,
      family,
      expectedRank: 14,
      teamCount: 32,
      rankEvAtExpected: 20,
    });
  }

  function cashModuleCount(components: SponsorOfferComponent[]): number {
    return components.length;
  }

  // Honest EV am Erwartungsrang: base + rankEvAtExpected(behalten) + Σ attainment×Reward (behaltene Boni)
  // + Klausel-EV. Rein aus den komponierten Komponenten rekonstruiert (Basis absorbiert weggelassene EV).
  function composedEv(components: SponsorOfferComponent[], rankEv: number, clauseDropP: number): number {
    let ev = 0;
    for (const c of components) {
      if (c.kind === "base") ev += c.rewardCash;
      else if (c.kind === "rank") ev += rankEv;
      else if (c.kind === "special") ev += 0.45 * c.rewardCash;
      else if (c.kind === "overperformance") ev += 0.25 * c.rewardCash;
      else if (c.kind === "improvement") ev += 0.2 * c.rewardCash;
      else if (c.kind === "clause") ev += -(c.penaltyCash ?? 0) * clauseDropP;
    }
    return ev;
  }

  it("rarity controls the number of cash modules (2/3/4/5)", () => {
    expect(cashModuleCount(compose("gewöhnlich"))).toBe(SPONSOR_MODULE_COUNT_BY_RARITY.gewöhnlich);
    expect(cashModuleCount(compose("magisch"))).toBe(SPONSOR_MODULE_COUNT_BY_RARITY.magisch);
    expect(cashModuleCount(compose("selten"))).toBe(SPONSOR_MODULE_COUNT_BY_RARITY.selten);
    expect(cashModuleCount(compose("legendär"))).toBe(SPONSOR_MODULE_COUNT_BY_RARITY.legendär);
    expect([2, 3, 4, 5]).toEqual([
      SPONSOR_MODULE_COUNT_BY_RARITY.gewöhnlich,
      SPONSOR_MODULE_COUNT_BY_RARITY.magisch,
      SPONSOR_MODULE_COUNT_BY_RARITY.selten,
      SPONSOR_MODULE_COUNT_BY_RARITY.legendär,
    ]);
  });

  it("every composed offer keeps exactly one base module", () => {
    for (const rarity of ["gewöhnlich", "magisch", "selten", "legendär"] as SponsorRarity[]) {
      expect(compose(rarity).filter((c) => c.kind === "base")).toHaveLength(1);
    }
  });

  it("preserves the EV budget within ±3% across rarities (redistribution, not inflation)", () => {
    // Referenz-EV der vollen Liste (mittelfeld-team, drop-P ≈ 0 bei Erwartung 14).
    const referenceEv = composedEv(fullComponents(), 20, 0);
    for (const rarity of ["gewöhnlich", "magisch", "selten", "legendär"] as SponsorRarity[]) {
      const ev = composedEv(compose(rarity), 20, 0);
      expect(Math.abs(ev - referenceEv) / referenceEv).toBeLessThan(0.03);
    }
  });

  it("makes gewöhnlich base-heavier than legendär (low rarity = XL base)", () => {
    const commonBase = compose("gewöhnlich").find((c) => c.kind === "base")!.rewardCash;
    const legendaryBase = compose("legendär").find((c) => c.kind === "base")!.rewardCash;
    expect(commonBase).toBeGreaterThan(legendaryBase);
  });

  it("gates the clause to sicherheit/aufstieg families and scales upside by the risk premium", () => {
    // sicherheit-Familie: kein overperformance, dafür Klausel; gewöhnlich = base + clause.
    const safety = compose("gewöhnlich", "sicherheit");
    expect(safety.some((c) => c.kind === "clause")).toBe(true);
    expect(safety.some((c) => c.kind === "overperformance")).toBe(false);

    // titel-Familie: keine Klausel.
    const titel = compose("legendär", "titel");
    expect(titel.some((c) => c.kind === "clause")).toBe(false);

    // Risikoprämie: behaltenes Sonderziel ist um ρ vergrößert vs. Ausgangswert.
    const special = titel.find((c) => c.kind === "special");
    if (special) {
      expect(special.rewardCash).toBeCloseTo(9 * SPONSOR_RISK_PREMIUM, 1);
    }
  });
});
