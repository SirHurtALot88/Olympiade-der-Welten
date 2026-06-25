import { describe, expect, it } from "vitest";

import {
  getLocalModifierSourceBundle,
  getPrismaReferenceModifierSourceBundle,
  getResolveMissingSourceReasons,
  hasResolveReadyModifierSources,
} from "@/lib/lineups/legacy-modifier-source-contract";

describe("legacy modifier source contract", () => {
  it("marks local modifier sources as resolve-ready", () => {
    const bundle = getLocalModifierSourceBundle();
    expect(bundle.contextLoadMode).toBe("sqlite_local");
    expect(bundle.formCardSource.effectStatus).toBe("ready");
    expect(bundle.mutatorSource.effectStatus).toBe("ready");
    expect(
      hasResolveReadyModifierSources({
        contextLoadMode: bundle.contextLoadMode,
        formCardSource: bundle.formCardSource,
        mutatorSource: bundle.mutatorSource,
        teamPowerSource: bundle.teamPowerSource,
        fatigueSourceStatus: "mapped",
      }),
    ).toBe(true);
  });

  it("blocks prisma reference contexts from resolve apply", () => {
    const bundle = getPrismaReferenceModifierSourceBundle();
    expect(bundle.contextLoadMode).toBe("prisma_reference");
    expect(bundle.formCardSource.effectStatus).toBe("missing_source");
    expect(
      getResolveMissingSourceReasons({
        contextLoadMode: bundle.contextLoadMode,
        formCardSource: bundle.formCardSource,
        mutatorSource: bundle.mutatorSource,
        teamPowerSource: bundle.teamPowerSource,
        fatigueSourceStatus: "missing_source",
      }),
    ).toEqual([
      "context_load_mode:prisma_reference",
      "form_card_source_missing",
      "mutator_source_missing",
      "team_power_source_missing",
      "fatigue_source_missing",
    ]);
  });
});
