import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

const shellRouterPath = path.join(process.cwd(), "app/foundation/FoundationShellRouter.tsx");
const shellRouterBodyScopePath =
  path.join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
const crossTabTrainingPath =
  path.join(process.cwd(), "lib/foundation/tabs/use-foundation-cross-tab-training.ts");
const trainingPanelDerivationsPath =
  path.join(process.cwd(), "lib/foundation/tabs/use-training-panel-derivations.ts");
const facilityEffectsPath = path.join(process.cwd(), "lib/facilities/facility-effects.ts");
const foundationPageTypesPath = path.join(process.cwd(), "lib/foundation/tabs/foundation-page-types.ts");
const moduleHelpersPath = path.join(process.cwd(), "lib/foundation/tabs/foundation-page-module-helpers.tsx");
// FacilitiesV2Client.tsx / TrainingCompactClient.tsx are now thin wrappers;
// the actual markup lives in their *NewLook.tsx successors.
const facilitiesV2Path = path.join(process.cwd(), "app/foundation/facilities-v2/FacilitiesV2NewLook.tsx");
const trainingCompactPath = path.join(process.cwd(), "app/foundation/training-compact/TrainingCompactNewLook.tsx");
const trainingViewSharedPath = path.join(process.cwd(), "app/foundation/training-facilities-v2/training-view-shared.tsx");
const globalsPath = path.join(process.cwd(), "app/globals.css");

describe("foundation training and facilities ui contract", () => {
  it("routes the main navigation into compact training and facilities v2 grid", async () => {
    const [pageTypesText, moduleHelpersText, shellRouterText, trainingCompactShellHostText, shellRouterBodyText, facilitiesText] =
      await Promise.all([
        fs.readFile(foundationPageTypesPath, "utf8"),
        fs.readFile(moduleHelpersPath, "utf8"),
        fs.readFile(shellRouterPath, "utf8"),
        fs.readFile(
          path.join(process.cwd(), "app/foundation/training-compact/FoundationTrainingCompactShellHost.tsx"),
          "utf8",
        ),
        fs.readFile(path.join(process.cwd(), "app/foundation/FoundationShellRouterBody.tsx"), "utf8"),
        fs.readFile(facilitiesV2Path, "utf8"),
      ]);

    expect(pageTypesText).toContain('| "trainingCompact"');
    expect(pageTypesText).toContain('| "trainingV2"');
    expect(moduleHelpersText).toContain('{ id: "trainingCompact", label: "Training"');
    expect(moduleHelpersText).toContain('{ id: "trainingV2", label: "Gebäude"');
    expect(moduleHelpersText).toContain('return "foundation-training-compact";');
    expect(moduleHelpersText).toContain('return "foundation-facilities-v2";');
    expect(shellRouterText).toContain('id="foundation-training-compact"');
    expect(trainingCompactShellHostText).toContain("<TrainingCompactClient");
    expect(shellRouterBodyText).toContain("<FacilitiesV2Client");
    expect(facilitiesText).toContain('id="foundation-facilities-v2"');
    expect(facilitiesText).toContain('data-testid="foundation-facilities-v2"');
  });

  it("keeps the facilities grid focused on upgrades, maintenance and level strips", async () => {
    const [fileText, gridText] = await Promise.all([
      fs.readFile(facilitiesV2Path, "utf8"),
      fs.readFile(
        path.join(process.cwd(), "app/foundation/facilities-v2/FacilityGridCard.tsx"),
        "utf8",
      ),
    ]);

    expect(fileText).toContain("Gebäude");
    expect(fileText).toContain("facilities-v2-grid");
    expect(gridText).toContain("FacilityLevelStrip");
    expect(fileText).toContain("Upgrade");
    expect(fileText).toContain("Wartung");
    expect(fileText).toContain("FacilityDecisionModal");
    expect(fileText).not.toContain("TrainingPlayerLane");
  });

  it("keeps compact training focused on player development controls", async () => {
    const fileText = await fs.readFile(trainingCompactPath, "utf8");

    expect(fileText).toContain('data-testid="foundation-training-compact"');
    // NOTE: `TrainingPlayerLane` (in training-view-shared.tsx) is no longer
    // imported/rendered anywhere in the codebase — TrainingCompactNewLook.tsx
    // builds its own player rows with FoundationPlayerPortraitPreview +
    // VeloIntensityRail instead. This looks like orphaned dead code / a
    // possible feature loss (see final report), left red intentionally.
    expect(fileText).toContain("TrainingPlayerLane");
    expect(fileText).toContain("organicForecast.netSetpoints");
    expect(fileText).toContain("Training");
  });

  it("still builds training and facilities around local preview services", async () => {
    // The training/facilities wiring this test guards moved out of the
    // FoundationPageClient monolith into the shell-router-body scope hook and
    // dedicated per-tab derivation hooks during the Foundation perf split.
    const [scopeText, crossTabTrainingText, trainingDerivationsText, facilityEffectsText] = await Promise.all([
      fs.readFile(shellRouterBodyScopePath, "utf8"),
      fs.readFile(crossTabTrainingPath, "utf8"),
      fs.readFile(trainingPanelDerivationsPath, "utf8"),
      fs.readFile(facilityEffectsPath, "utf8"),
    ]);

    expect(scopeText).toContain("buildPlayerProgressionForecast");
    expect(trainingDerivationsText).toContain("buildOrganicSeasonProgression");
    expect(trainingDerivationsText).toContain("buildTrainingPlayerRowView");
    expect(scopeText).toContain("trainingModeDraft");
    // setPlayerTrainingMode was refactored from an immediately-awaited async
    // call into a synchronous state update that debounces the persistence via
    // a setTimeout -> flushPendingTrainingModes() (see pendingTrainingModesRef
    // right above it); the capability itself is unchanged.
    expect(scopeText).toContain("function setPlayerTrainingMode");
    expect(trainingDerivationsText).toContain("player.trainingMode ?? \"mittel\"");
    expect(scopeText).toContain("persistLocalGameStateImmediately(nextGameState)");
    expect(scopeText).toContain("getTeamFacilityState");
    expect(crossTabTrainingText).toContain("calculateFacilityUpkeep");
    expect(crossTabTrainingText).toContain("calculateFacilityIncome");
    expect(crossTabTrainingText).toContain("describeTrainingXpFacilityEffect");
    expect(crossTabTrainingText).toContain("applyRecoveryFacilityModifiers");
    expect(facilityEffectsText).toContain("applyUpgradeCostFacilityModifiers");
    expect(facilityEffectsText).toContain("applyTrainingXpFacilityModifiers");
    expect(scopeText).toContain("/api/facilities/upgrade");
  });

  it("keeps the modern v2 layout classes wired up", async () => {
    const cssText = await fs.readFile(globalsPath, "utf8");

    expect(cssText).toContain(".training-v2-shell");
    expect(cssText).toContain(".training-compact-shell");
    expect(cssText).toContain(".training-v2-lane");
    expect(cssText).toContain(".training-v2-rider-card");
    expect(cssText).toContain(".facilities-v2-grid");
    expect(cssText).toContain(".facilities-v2-card");
    expect(cssText).toContain(".facilities-v2-level-strip");
    expect(cssText).toContain(".facilities-v2-action-bar");
  });

  it("uses full-art portrait cards with training context presets in the player lane", async () => {
    const [trainingText, cssText] = await Promise.all([
      fs.readFile(trainingViewSharedPath, "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(trainingText).toContain("FoundationPlayerPortraitCard");
    expect(trainingText).toContain('context="training"');
    expect(trainingText).toContain('density="full"');
    expect(trainingText).toContain("organicForecast.netSetpoints");
    expect(trainingText).toContain("forecast.regressionRisk");
    expect(trainingText).toContain("trainingModeLabel");
    expect(trainingText).toContain("footerSlot");
    expect(trainingText).toContain("team-portraits-grid");
    expect(cssText).toContain(".foundation-player-portrait-card.is-density-compact");
  });

  it("exposes sprint K global mode chips, upgrade strip, why disclosure, and facility maintenance preview", async () => {
    const [trainingCompactText, trainingSharedText, facilitiesOverviewText, cssText] = await Promise.all([
      fs.readFile(trainingCompactPath, "utf8"),
      fs.readFile(trainingViewSharedPath, "utf8"),
      // FacilitiesOverviewV2Client.tsx is now a thin wrapper; the actual markup
      // lives in FacilitiesOverviewV2NewLook.tsx.
      fs.readFile(
        path.join(process.cwd(), "app/foundation/facilities-overview-v2/FacilitiesOverviewV2NewLook.tsx"),
        "utf8",
      ),
      fs.readFile(globalsPath, "utf8"),
    ]);

    // NOTE: None of "training-global-mode-chips" / "Alle auf" / TrainingModeComparePanel /
    // compareActivePlayerId are referenced anywhere in app/ or lib/ anymore.
    // components/foundation/modern-game/TrainingModeComparePanel.tsx exists on
    // disk but is not imported by anything, and .training-v2-global-mode-chips
    // in globals.css has no matching JSX usage either. This looks like a real
    // feature loss (bulk "set all players to X" training-mode control, and a
    // mode-compare panel) — see final report. Left red intentionally.
    expect(trainingCompactText).toContain('data-testid="training-global-mode-chips"');
    expect(trainingCompactText).toContain("Alle auf");
    expect(trainingCompactText).toContain("TrainingModeComparePanel");
    expect(trainingCompactText).toContain("compareActivePlayerId");

    // XP-System abgeschafft: TrainingAttributeUpgradeStrip (dekorativer „+1 ~40 SP"-Streifen) entfernt.
    // NOTE: scoped to an actual JSX usage (`<TrainingAttributeUpgradeStrip`)
    // rather than any substring, because the source file itself now carries a
    // comment documenting the removal ("XP-System abgeschafft:
    // TrainingAttributeUpgradeStrip ... entfernt") that would otherwise trip a
    // bare .not.toContain(name) check — the intent (component not rendered) is
    // unchanged and still fully enforced.
    expect(trainingSharedText).not.toContain("<TrainingAttributeUpgradeStrip");
    expect(trainingSharedText).toContain("TrainingWhyDisclosure");
    expect(trainingSharedText).toContain("is-compare-active");
    expect(trainingSharedText).toContain("is-signature");
    expect(trainingSharedText).toContain("regressionRisk");

    // NOTE: class names were migrated to the "nl-facility-overview-*" prefix
    // convention (facilities-overview-v2-maintenance-card -> nl-facility-overview-card,
    // facilities-overview-v2-upgrade-preview -> nl-facility-overview-upgrade),
    // consistent with the rest of the v2 redesign.
    expect(facilitiesOverviewText).toContain("nl-facility-overview-card");
    expect(facilitiesOverviewText).toContain("nl-facility-overview-upgrade");

    expect(cssText).toContain(".training-v2-global-mode-chips");
    // XP-System abgeschafft: .training-v2-upgrade-strip / -tile CSS entfernt.
    // NOTE: scoped to an actual rule definition rather than any substring,
    // because globals.css itself now carries a comment documenting the
    // removal that would otherwise trip a bare .not.toContain(selector) check.
    expect(cssText).not.toContain(".training-v2-upgrade-strip {");
    expect(cssText).toContain(".training-v2-rider-card.is-compare-active");
    // NOTE: the New Look facility-overview card has no bespoke
    // ".facilities-overview-v2-maintenance-card"-equivalent CSS rule anymore —
    // it's styled generically via the shared NlCard component instead of a
    // dedicated selector, so there's nothing meaningful to redirect this to.
    expect(cssText).toContain(".facilities-overview-v2-maintenance-card");
  });
});
