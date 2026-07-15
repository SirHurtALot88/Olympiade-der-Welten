import { describe, expect, it } from "vitest";

import { foundationSeedDisciplines } from "@/lib/data/dataAdapter";
import { loadImportedPlayerStats } from "@/lib/data/playerStatsAdapter";
import { loadPlayerFormulaSources } from "@/lib/player-formulas/formula-source-loader";
import {
  createDefaultPlayerGeneratorInput,
  deriveAxisIntentFromProfile,
  generatePlayerDraft,
  recalculatePlayerGeneratorDraft,
} from "@/lib/player-generator/player-generator-service";
import { officialDisciplineWeightTable } from "@/lib/player-generator/official-discipline-weights";

const players = loadImportedPlayerStats();

function attributeSpread(draft: ReturnType<typeof generatePlayerDraft>) {
  return Math.max(...Object.values(draft.generated.attributes)) - Math.min(...Object.values(draft.generated.attributes));
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function supportPeakCount(draft: ReturnType<typeof generatePlayerDraft>) {
  const supportAttributes = [
    draft.generated.attributes.spirit,
    draft.generated.attributes.charisma,
    draft.generated.attributes.awareness,
    draft.generated.attributes.will,
    draft.generated.attributes.intelligence,
    draft.generated.attributes.determination,
  ];
  const center = average(Object.values(draft.generated.attributes));
  return supportAttributes.filter((value) => value >= center + 6).length;
}

describe("player generator service", () => {
  it("loads the current repo formula sources with ready rank-to-mw data while class factors remain missing", () => {
    const sources = loadPlayerFormulaSources();

    expect(sources.attributeSalaryModifiersStatus).toBe("ready");
    expect(sources.traitSalaryFactorsStatus).toBe("ready");
    expect(sources.rankMarketValueStatus).toBe("ready");
    expect(sources.marketValueEngineStatus).toBe("ready");
    expect(sources.classFactorsStatus).toBe("missing_source");
    expect(sources.classEngineStatus).toBe("heuristic");
    expect(sources.loadedTables.attributeSalaryModifiers).toBe(true);
    expect(sources.loadedTables.traitSalaryFactors).toBe(true);
    expect(sources.loadedTables.rankToDisciplineMarketValue).toBe(true);
    expect(sources.loadedTables.classFactors).toBe(false);
  });

  it("blocks rank-to-mw on missing and incomplete sources without inventing a curve", () => {
    expect(loadPlayerFormulaSources({ rankToDisciplineMarketValue: null }).rankMarketValueStatus).toBe("missing_source");
    expect(loadPlayerFormulaSources({ rankToDisciplineMarketValue: [] }).rankMarketValueStatus).toBe("incomplete_source");
    expect(loadPlayerFormulaSources({ rankToDisciplineMarketValue: [{ rank: 1, disciplineMarketValue: 6.5 }] }).marketValueEngineStatus).toBe(
      "blocked_missing_rank_to_mw_source",
    );
  });

  it("matches the official 12x20 discipline weight table exactly", () => {
    expect(officialDisciplineWeightTable).toEqual({
      power: { tdm: 28, "mini-dm": 16, battlefield: 10, gewichtheben: 28, climbing: 8, staffel: 0, "time-trial": 5, spurt: 10, tennis: 0, hockey: 18, showcase: 11, "speed-schach": 0, "takeshis-castle": 0, breaking: 10, wettessen: 0, basketball: 7, football: 6, eiskunstlauf: 0, fechten: 10, "i-spy": 0 },
      health: { tdm: 20, "mini-dm": 20, battlefield: 8, gewichtheben: 16, climbing: 10, staffel: 2, "time-trial": 0, spurt: 6, tennis: 0, hockey: 18, showcase: 3, "speed-schach": 0, "takeshis-castle": 4, breaking: 18, wettessen: 22, basketball: 0, football: 14, eiskunstlauf: 0, fechten: 4, "i-spy": 2 },
      determination: { tdm: 6, "mini-dm": 0, battlefield: 4, gewichtheben: 12, climbing: 16, staffel: 4, "time-trial": 0, spurt: 15, tennis: 6, hockey: 4, showcase: 14, "speed-schach": 14, "takeshis-castle": 18, breaking: 10, wettessen: 16, basketball: 0, football: 8, eiskunstlauf: 6, fechten: 6, "i-spy": 8 },
      stamina: { tdm: 14, "mini-dm": 16, battlefield: 4, gewichtheben: 2, climbing: 26, staffel: 16, "time-trial": 15, spurt: 4, tennis: 12, hockey: 10, showcase: 0, "speed-schach": 0, "takeshis-castle": 6, breaking: 8, wettessen: 22, basketball: 6, football: 6, eiskunstlauf: 0, fechten: 0, "i-spy": 0 },
      speed: { tdm: 0, "mini-dm": 0, battlefield: 0, gewichtheben: 6, climbing: 12, staffel: 24, "time-trial": 22, spurt: 18, tennis: 6, hockey: 12, showcase: 8, "speed-schach": 10, "takeshis-castle": 4, breaking: 0, wettessen: 0, basketball: 10, football: 0, eiskunstlauf: 10, fechten: 16, "i-spy": 8 },
      dexterity: { tdm: 0, "mini-dm": 10, battlefield: 0, gewichtheben: 6, climbing: 12, staffel: 8, "time-trial": 25, spurt: 12, tennis: 12, hockey: 4, showcase: 9, "speed-schach": 7, "takeshis-castle": 6, breaking: 2, wettessen: 0, basketball: 8, football: 0, eiskunstlauf: 18, fechten: 20, "i-spy": 8 },
      awareness: { tdm: 2, "mini-dm": 0, battlefield: 10, gewichtheben: 0, climbing: 8, staffel: 12, "time-trial": 12, spurt: 7, tennis: 20, hockey: 8, showcase: 0, "speed-schach": 21, "takeshis-castle": 8, breaking: 0, wettessen: 0, basketball: 14, football: 11, eiskunstlauf: 14, fechten: 15, "i-spy": 5 },
      intelligence: { tdm: 6, "mini-dm": 0, battlefield: 16, gewichtheben: 0, climbing: 0, staffel: 0, "time-trial": 18, spurt: 0, tennis: 22, hockey: 0, showcase: 10, "speed-schach": 28, "takeshis-castle": 11, breaking: 2, wettessen: 8, basketball: 16, football: 0, eiskunstlauf: 8, fechten: 4, "i-spy": 18 },
      will: { tdm: 0, "mini-dm": 14, battlefield: 0, gewichtheben: 7, climbing: 8, staffel: 8, "time-trial": 0, spurt: 14, tennis: 0, hockey: 4, showcase: 0, "speed-schach": 14, "takeshis-castle": 22, breaking: 28, wettessen: 26, basketball: 0, football: 10, eiskunstlauf: 0, fechten: 0, "i-spy": 12 },
      charisma: { tdm: 10, "mini-dm": 0, battlefield: 20, gewichtheben: 23, climbing: 0, staffel: 10, "time-trial": 0, spurt: 0, tennis: 4, hockey: 0, showcase: 27, "speed-schach": 6, "takeshis-castle": 14, breaking: 0, wettessen: 0, basketball: 11, football: 4, eiskunstlauf: 28, fechten: 0, "i-spy": 9 },
      spirit: { tdm: 12, "mini-dm": 0, battlefield: 16, gewichtheben: 0, climbing: 0, staffel: 16, "time-trial": 0, spurt: 0, tennis: 18, hockey: 12, showcase: 16, "speed-schach": 0, "takeshis-castle": 0, breaking: 0, wettessen: 0, basketball: 22, football: 25, eiskunstlauf: 16, fechten: 0, "i-spy": 13 },
      torment: { tdm: 2, "mini-dm": 24, battlefield: 12, gewichtheben: 0, climbing: 0, staffel: 0, "time-trial": 3, spurt: 14, tennis: 0, hockey: 10, showcase: 2, "speed-schach": 0, "takeshis-castle": 7, breaking: 22, wettessen: 6, basketball: 6, football: 16, eiskunstlauf: 0, fechten: 25, "i-spy": 17 },
    });
  });

  it("creates reproducible drafts from the same seed", () => {
    const generatorInput = {
      ...createDefaultPlayerGeneratorInput(),
      roleIntent: "offense" as const,
      strengthTier: "strong" as const,
      randomness: "medium" as const,
      preferredArchetype: "mercenary" as const,
      seed: "same-seed",
    };

    const first = generatePlayerDraft({
      generatorInput,
      players,
      disciplines: foundationSeedDisciplines,
      draftId: "draft-a",
      createdAt: "2026-06-06T10:00:00.000Z",
    });
    const second = generatePlayerDraft({
      generatorInput,
      players,
      disciplines: foundationSeedDisciplines,
      draftId: "draft-b",
      createdAt: "2026-06-06T10:00:00.000Z",
    });

    expect(first.generated.attributes).toEqual(second.generated.attributes);
    expect(first.generated.axes).toEqual(second.generated.axes);
    expect(first.generated.disciplineRatings).toEqual(second.generated.disciplineRatings);
    expect(first.generated.classSuggestion.className).toBe(second.generated.classSuggestion.className);
  });

  it("allows axis intent to be fully auto by default", () => {
    const defaults = createDefaultPlayerGeneratorInput();
    expect(defaults.axisIntent).toEqual({
      pow: "auto",
      spe: "auto",
      men: "auto",
      soc: "auto",
    });

    const resolved = deriveAxisIntentFromProfile({
      ...defaults,
      preferredArchetype: "undead",
      roleIntent: "support",
    });

    expect(resolved.resolvedAxisIntent).toEqual({
      pow: 2,
      spe: 2,
      men: 5,
      soc: 3,
    });
    expect(Object.values(resolved.axisIntentSources).every((source) => source !== "user")).toBe(true);
  });

  it("supports mixed user-set and auto-derived axis values", () => {
    const resolved = deriveAxisIntentFromProfile({
      ...createDefaultPlayerGeneratorInput(),
      preferredArchetype: "construct",
      roleIntent: "defense",
      axisIntent: {
        pow: 5,
        spe: "auto",
        men: null,
        soc: "auto",
      },
    });

    expect(resolved.resolvedAxisIntent.pow).toBe(5);
    expect(resolved.axisIntentSources.pow).toBe("user");
    expect(resolved.axisIntentSources.spe).not.toBe("user");
    expect(resolved.axisIntentSources.men).not.toBe("user");
    expect(resolved.axisIntentSources.soc).not.toBe("user");
  });

  it("derives clear example profiles for undead support, beast offense, construct defense and angel support", () => {
    expect(
      deriveAxisIntentFromProfile({
        ...createDefaultPlayerGeneratorInput(),
        roleIntent: "support",
        preferredArchetype: "undead",
      }).resolvedAxisIntent,
    ).toEqual({ pow: 2, spe: 2, men: 5, soc: 3 });

    expect(
      deriveAxisIntentFromProfile({
        ...createDefaultPlayerGeneratorInput(),
        roleIntent: "offense",
        preferredArchetype: "beast",
      }).resolvedAxisIntent,
    ).toEqual({ pow: 5, spe: 4, men: 1, soc: 1 });

    expect(
      deriveAxisIntentFromProfile({
        ...createDefaultPlayerGeneratorInput(),
        roleIntent: "defense",
        preferredArchetype: "construct",
      }).resolvedAxisIntent,
    ).toEqual({ pow: 3, spe: 2, men: 3, soc: 1 });

    expect(
      deriveAxisIntentFromProfile({
        ...createDefaultPlayerGeneratorInput(),
        roleIntent: "support",
        preferredArchetype: "angel",
      }).resolvedAxisIntent,
    ).toEqual({ pow: 2, spe: 3, men: 4, soc: 5 });
  });

  it("keeps undead support inside undead-friendly race and subclass constraints", () => {
    const draft = generatePlayerDraft({
      generatorInput: {
        ...createDefaultPlayerGeneratorInput(),
        preferredArchetype: "undead",
        roleIntent: "support",
        seed: "undead-support",
      },
      players,
      disciplines: foundationSeedDisciplines,
    });

    expect(["Dwarf", "Divine", "Animal"]).not.toContain(draft.generated.race);
    expect(draft.generated.subclasses).not.toContain("Amazoness");
    expect(draft.generated.subclasses.some((entry) => ["Undead", "Vampire", "Wraith", "Apparition", "Warlock"].includes(entry))).toBe(true);
    expect(draft.generated.diagnostics.archetypeMatch).toBe("ok");
    expect(draft.generated.diagnostics.roleMatch).toBe("ok");
    expect(draft.generated.diagnostics.statSilhouette).toBe("ok");
  });

  it("produces beast offense, construct defense and angel support as distinct silhouettes", () => {
    const beast = generatePlayerDraft({
      generatorInput: {
        ...createDefaultPlayerGeneratorInput(),
        preferredArchetype: "beast",
        roleIntent: "offense",
        seed: "beast-offense",
      },
      players,
      disciplines: foundationSeedDisciplines,
    });
    const construct = generatePlayerDraft({
      generatorInput: {
        ...createDefaultPlayerGeneratorInput(),
        preferredArchetype: "construct",
        roleIntent: "defense",
        seed: "construct-defense",
      },
      players,
      disciplines: foundationSeedDisciplines,
    });
    const angel = generatePlayerDraft({
      generatorInput: {
        ...createDefaultPlayerGeneratorInput(),
        preferredArchetype: "angel",
        roleIntent: "support",
        seed: "angel-support",
      },
      players,
      disciplines: foundationSeedDisciplines,
    });

    expect(["Animal", "Orc", "Tauren", "Lizard", "Dragon", "Mutant", "Goblin"]).toContain(beast.generated.race);
    expect(beast.generated.diagnostics.resolvedAxisIntent.pow).toBeGreaterThan(beast.generated.diagnostics.resolvedAxisIntent.men);
    expect(beast.generated.diagnostics.resolvedAxisIntent.spe).toBeGreaterThan(beast.generated.diagnostics.resolvedAxisIntent.soc);
    expect(construct.generated.race).toBe("Construct");
    expect(construct.generated.attributes.health).toBeGreaterThan(construct.generated.attributes.charisma);
    expect(construct.generated.diagnostics.roleMatch).toBe("ok");
    expect(angel.generated.race).toBe("Divine");
    expect(angel.generated.subclasses.some((entry) => ["Angel", "Fallen Angel", "Cleric", "God"].includes(entry))).toBe(true);
    expect(angel.generated.diagnostics.resolvedAxisIntent.soc).toBeGreaterThanOrEqual(5);
  });

  it("gives support at least three support-relevant peaks", () => {
    const draft = generatePlayerDraft({
      generatorInput: {
        ...createDefaultPlayerGeneratorInput(),
        preferredArchetype: "angel",
        roleIntent: "support",
        seed: "support-peaks",
      },
      players,
      disciplines: foundationSeedDisciplines,
    });

    expect(supportPeakCount(draft)).toBeGreaterThanOrEqual(3);
  });

  it("keeps specialist and chaos highly variable while allround stays readable but not flat", () => {
    const specialist = generatePlayerDraft({
      generatorInput: {
        ...createDefaultPlayerGeneratorInput(),
        preferredArchetype: "ninja",
        roleIntent: "specialist",
        seed: "specialist-ninja",
      },
      players,
      disciplines: foundationSeedDisciplines,
    });
    const chaos = generatePlayerDraft({
      generatorInput: {
        ...createDefaultPlayerGeneratorInput(),
        preferredArchetype: "demon",
        roleIntent: "chaos",
        randomness: "high",
        seed: "chaos-demon",
      },
      players,
      disciplines: foundationSeedDisciplines,
    });
    const allround = generatePlayerDraft({
      generatorInput: {
        ...createDefaultPlayerGeneratorInput(),
        roleIntent: "allround",
        seed: "allround-neutral",
      },
      players,
      disciplines: foundationSeedDisciplines,
    });

    expect(attributeSpread(specialist)).toBeGreaterThanOrEqual(26);
    expect(attributeSpread(chaos)).toBeGreaterThanOrEqual(30);
    expect(chaos.generated.diagnostics.archetypeMatch).toBe("ok");
    expect(attributeSpread(allround)).toBeGreaterThanOrEqual(12);
    expect(allround.generated.diagnostics.flatAttributeCount).toBeLessThanOrEqual(8);
  });

  it("lets user-set axis values override derived values", () => {
    const draft = generatePlayerDraft({
      generatorInput: {
        ...createDefaultPlayerGeneratorInput(),
        preferredArchetype: "beast",
        roleIntent: "offense",
        axisIntent: {
          pow: 5,
          spe: 5,
          men: 4,
          soc: 1,
        },
        seed: "override-axis",
      },
      players,
      disciplines: foundationSeedDisciplines,
    });

    expect(draft.generated.diagnostics.resolvedAxisIntent).toEqual({
      pow: 5,
      spe: 5,
      men: 4,
      soc: 1,
    });
    expect(draft.generated.diagnostics.axisIntentSources.men).toBe("user");
  });

  it("exposes the requested axis target alongside the achieved axes so drift is legible", () => {
    const draft = generatePlayerDraft({
      generatorInput: {
        ...createDefaultPlayerGeneratorInput(),
        preferredArchetype: "beast",
        roleIntent: "offense",
        seed: "axis-target-transparency",
      },
      players,
      disciplines: foundationSeedDisciplines,
    });

    const { axisTargets } = draft.generated.diagnostics;
    expect(axisTargets).not.toBeNull();
    expect(axisTargets).toEqual(
      expect.objectContaining({
        pow: expect.any(Number),
        spe: expect.any(Number),
        men: expect.any(Number),
        soc: expect.any(Number),
      }),
    );
    // buildAxisTargets() steers generation; deriveAxesFromAttributes()
    // recomputes the shown axes independently afterwards via the attribute
    // silhouette shaping — so target and achieved are legitimately allowed
    // to drift from each other. Both should be sane 0-100-scale numbers.
    for (const axis of ["pow", "spe", "men", "soc"] as const) {
      expect(axisTargets![axis]).toBeGreaterThanOrEqual(0);
      expect(axisTargets![axis]).toBeLessThanOrEqual(100);
      expect(draft.generated.axes[axis]).toBeGreaterThanOrEqual(0);
      expect(draft.generated.axes[axis]).toBeLessThanOrEqual(100);
    }

    // A manual-edit recalculate pass has nothing fresh to target against, so
    // it preserves the draft's original target rather than discarding it.
    const recalculated = recalculatePlayerGeneratorDraft({
      draft,
      players,
      disciplines: foundationSeedDisciplines,
    });
    expect(recalculated.generated.diagnostics.axisTargets).toEqual(axisTargets);
  });

  it("keeps normal and strong profiles above the minimum spread floor", () => {
    const normal = generatePlayerDraft({
      generatorInput: {
        ...createDefaultPlayerGeneratorInput(),
        strengthTier: "normal",
        roleIntent: "allround",
        seed: "normal-spread",
      },
      players,
      disciplines: foundationSeedDisciplines,
    });
    const strong = generatePlayerDraft({
      generatorInput: {
        ...createDefaultPlayerGeneratorInput(),
        strengthTier: "strong",
        roleIntent: "defense",
        preferredArchetype: "construct",
        seed: "strong-spread",
      },
      players,
      disciplines: foundationSeedDisciplines,
    });

    expect(attributeSpread(normal)).toBeGreaterThanOrEqual(12);
    expect(attributeSpread(strong)).toBeGreaterThanOrEqual(22);
  });

  it("makes high randomness more volatile than low randomness across multiple seeds", () => {
    const spreads = Array.from({ length: 6 }, (_, index) => {
      const low = generatePlayerDraft({
        generatorInput: {
          ...createDefaultPlayerGeneratorInput(),
          randomness: "low",
          seed: `random-low-${index}`,
        },
        players,
        disciplines: foundationSeedDisciplines,
      });
      const high = generatePlayerDraft({
        generatorInput: {
          ...createDefaultPlayerGeneratorInput(),
          randomness: "high",
          seed: `random-high-${index}`,
        },
        players,
        disciplines: foundationSeedDisciplines,
      });
      return {
        low: attributeSpread(low),
        high: attributeSpread(high),
      };
    });

    expect(average(spreads.map((entry) => entry.high))).toBeGreaterThan(average(spreads.map((entry) => entry.low)));
  });

  it("flags anti-flatness and archetype conflicts when a draft is manually flattened or broken", () => {
    const draft = generatePlayerDraft({
      generatorInput: {
        ...createDefaultPlayerGeneratorInput(),
        preferredArchetype: "undead",
        roleIntent: "support",
        seed: "broken-draft",
      },
      players,
      disciplines: foundationSeedDisciplines,
    });

    const broken = recalculatePlayerGeneratorDraft({
      draft: {
        ...draft,
        generated: {
          ...draft.generated,
          race: "Dwarf",
          className: "Bard",
          subclasses: ["Amazoness", "Healer"],
          attributes: {
            power: 37,
            health: 38,
            stamina: 39,
            intelligence: 40,
            awareness: 41,
            determination: 39,
            speed: 38,
            dexterity: 37,
            charisma: 40,
            will: 39,
            spirit: 41,
            torment: 38,
          },
        },
      },
      players,
      disciplines: foundationSeedDisciplines,
    });

    expect(broken.warnings.some((warning) => warning.includes("too_flat_profile"))).toBe(true);
    expect(broken.generated.diagnostics.qualityWarnings).toContain("too_flat_profile");
    expect(broken.generated.diagnostics.qualityWarnings).toContain("archetype_constraint_failed");
    expect(["needs_edit", "blocked_archetype_conflict"]).toContain(broken.validationStatus);
    expect(broken.generated.diagnostics.archetypeMatch).toBe("failed");
    expect(broken.generated.diagnostics.statSilhouette).toBe("failed");
  });

  it("shows draft economy projections while keeping the real commit path disabled", () => {
    const draft = generatePlayerDraft({
      generatorInput: {
        ...createDefaultPlayerGeneratorInput(),
        preferredArchetype: "mage",
        contractMode: "front_loaded",
        seed: "draft-economy-projection",
      },
      players,
      disciplines: foundationSeedDisciplines,
    });

    expect(draft.generated.marketValue).toBeGreaterThan(0);
    expect(draft.generated.salary).toBeGreaterThan(0);
    // Phase 1 fix: the draft's market value has only ever come from the
    // heuristic estimator (estimateDraftMarketValue), never from the real
    // rank-based MV engine (which needs the draft ranked against the whole
    // league to work at all). marketValueStatus/engineStatus now say so
    // honestly instead of misreporting "ready" for an engine that was never
    // actually consulted.
    expect(draft.generated.marketValueStatus).toBe("heuristic_estimate");
    expect(draft.generated.salaryStatus).toBe("ready");
    expect(draft.generated.economyProjection?.contractMode).toBe("front_loaded");
    expect(draft.generated.economyProjection?.salarySchedule.length).toBeGreaterThan(0);
    expect(draft.generated.disciplineOutlook?.length).toBeGreaterThan(0);
    expect(draft.generated.disciplineOutlook?.[0]?.bestSlotLabel).toBeTruthy();
    expect(draft.generated.projectedRole).toBeTruthy();
    expect(draft.generated.captaincyScore).toBeGreaterThan(0);
    expect(draft.generated.formulaStatus.attributeSalaryModifiersStatus).toBe("ready");
    expect(draft.generated.formulaStatus.traitSalaryFactorsStatus).toBe("ready");
    expect(draft.generated.formulaStatus.rankMarketValueStatus).toBe("ready");
    expect(draft.generated.formulaStatus.marketValueEngineStatus).toBe("ready");
    expect(draft.generated.formulaStatus.classEngineStatus).toBe("heuristic");
    expect(draft.generated.formulaStatus.salaryEngineStatus).toBe("ready_if_market_value_input_present");
    expect(draft.generated.diagnostics.engineStatus.marketValueEngine).toBe("heuristic");
    expect(draft.generated.diagnostics.engineStatus.salaryEngine).toBe("ready");
    expect(draft.generated.diagnostics.engineStatus.classEngine).toBe("heuristic");
    // Phase 1 fix: potential is now wired to the real CA/PO star model
    // instead of being hardcoded null/missing.
    expect(draft.generated.diagnostics.engineStatus.potentialEngine).toBe("ready");
    expect(draft.generated.potential).not.toBeNull();
    expect(draft.generated.diagnostics.draftStatus.ovr).toBe("draft_preview");
    expect(draft.generated.diagnostics.draftStatus.pps).toBe("draft_preview");
    expect(draft.generated.diagnostics.saveStatus.save).toBe("draft_only");
    expect(draft.generated.diagnostics.saveStatus.commit).toBe("disabled");
    expect(draft.generated.diagnostics.saveStatus.commitReasons).toContain("commit_path_not_ready");
    expect(draft.warnings.filter((warning) => warning.includes("rank_to_discipline_market_value_source_incomplete"))).toHaveLength(0);
    expect(draft.warnings.filter((warning) => warning.includes("class_factors_source_missing"))).toHaveLength(1);
    expect(draft.warnings.filter((warning) => warning.includes("salary_engine_waits_for_market_value_input"))).toHaveLength(0);
    expect(draft.generated.diagnostics.qualityWarnings).not.toContain("unknown_trait");
    expect(draft.generated.diagnostics.qualityWarnings).not.toContain("unknown_class");
    expect(draft.generated.diagnostics.qualityWarnings).not.toContain("unknown_race");
  });

  it("keeps draft preview hints separate from quality warnings", () => {
    const draft = generatePlayerDraft({
      generatorInput: {
        ...createDefaultPlayerGeneratorInput(),
        preferredArchetype: "mage",
        classHint: "Unknown Class",
        raceHint: "Unknown Race",
        traitHint: "Unknown Trait",
        seed: "warning-groups",
      },
      players,
      disciplines: foundationSeedDisciplines,
    });

    expect(draft.generated.diagnostics.qualityWarnings).toContain("axis_auto_resolved");
    expect(draft.generated.diagnostics.qualityWarnings).toContain("unknown_class");
    expect(draft.generated.diagnostics.qualityWarnings).toContain("unknown_race");
    expect(draft.generated.diagnostics.qualityWarnings).toContain("unknown_trait");
    expect(draft.warnings.some((warning) => warning.includes("OVR ist im Generator"))).toBe(false);
    expect(draft.warnings.some((warning) => warning.includes("Potential bleibt offen"))).toBe(false);
  });

  it("derives generated.ovr from the peak-weighted absolute CA formula instead of a flat axis mean", () => {
    const specialist = generatePlayerDraft({
      generatorInput: {
        ...createDefaultPlayerGeneratorInput(),
        preferredArchetype: "ninja",
        roleIntent: "specialist",
        seed: "ca-peak-weighted-specialist",
      },
      players,
      disciplines: foundationSeedDisciplines,
    });

    const { pow, spe, men, soc } = specialist.generated.axes;
    const flatMean = (pow + spe + men + soc) / 4;
    const sortedDesc = [pow, spe, men, soc].sort((left, right) => right - left);
    const peakWeighted = sortedDesc[0] * 0.5 + sortedDesc[1] * 0.27 + sortedDesc[2] * 0.15 + sortedDesc[3] * 0.08;

    expect(specialist.generated.ovr).not.toBeNull();
    // Matches lib/scouting/current-ability-score.ts exactly (same formula,
    // same absolute/league-independent scale as scouting/profile CA).
    expect(specialist.generated.ovr!).toBeCloseTo(peakWeighted, 1);
    // Rearrangement inequality: peak-weighting a spiky specialist axis
    // profile always scores at least as high as a flat mean of the same
    // values, and strictly higher whenever the axes aren't all equal. This
    // is the whole point of the Phase 1 fix — specialists no longer get
    // flattened toward mediocrity by a plain average.
    expect(specialist.generated.ovr!).toBeGreaterThan(flatMean);
  });

  it("wires generated.potential to the real CA/PO star model instead of leaving it null", () => {
    const draft = generatePlayerDraft({
      generatorInput: {
        ...createDefaultPlayerGeneratorInput(),
        preferredArchetype: "warrior",
        roleIntent: "offense",
        seed: "potential-wiring",
      },
      players,
      disciplines: foundationSeedDisciplines,
    });

    expect(draft.generated.potential).not.toBeNull();
    expect(draft.generated.potential!).toBeGreaterThanOrEqual(1);
    expect(draft.generated.potential!).toBeLessThanOrEqual(99);
    expect(draft.generated.diagnostics.engineStatus.potentialEngine).toBe("ready");

    // Same seed -> same deterministic potential (mirrors the existing
    // reproducibility guarantee for attributes/axes/discipline ratings).
    const second = generatePlayerDraft({
      generatorInput: {
        ...createDefaultPlayerGeneratorInput(),
        preferredArchetype: "warrior",
        roleIntent: "offense",
        seed: "potential-wiring",
      },
      players,
      disciplines: foundationSeedDisciplines,
    });
    expect(second.generated.potential).toBe(draft.generated.potential);
  });
});
