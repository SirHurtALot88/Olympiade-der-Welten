import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { readFoundationOrchestratorSource } from "./foundation-orchestrator-source";

describe("player profile ui contract", () => {
  it("provides full-page player profile with tabs and projected classes report", async () => {
    const [profileText, foundationText, scopeText, serviceText, previewText, drawerText, trainingControlsText, chartText, trainingSharedText] =
      await Promise.all([
        fs.readFile(
          "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/player-profile/PlayerProfileClient.tsx",
          "utf8",
        ),
        readFoundationOrchestratorSource(),
        fs.readFile(
          "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx",
          "utf8",
        ),
        fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/player-profile-service.ts", "utf8"),
        fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/projected-class-preview.ts", "utf8"),
        fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/PlayerDetailDrawer.tsx", "utf8"),
        fs.readFile(
          "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/player-profile/PlayerTrainingControls.tsx",
          "utf8",
        ),
        fs.readFile(
          "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/player-profile/PlayerAttributeProgressChart.tsx",
          "utf8",
        ),
        fs.readFile(
          "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/training-facilities-v2/training-view-shared.tsx",
          "utf8",
        ),
      ]);

    expect(profileText).toContain("PlayerDetailDrawer");
    expect(profileText).toContain("PLAYER_PROFILE_TAB_ANCHORS");
    expect(profileText).toContain("trainingRow");
    expect(profileText).toContain("onSetTrainingMode");
    expect(foundationText).toContain("openPlayerProfileById");
    expect(foundationText).toContain("shouldLoadSeasonArchive");
    expect(foundationText).toContain("loadedSeasonArchiveSignatureRef");
    expect(foundationText).toContain("setPlayerProfileLoading(true)");
    expect(foundationText).toContain("PlayerProfileClient");
    expect(foundationText).toContain("playerProfileTrainingRow");
    expect(scopeText).toContain("const playerProfileTrainingReadOnly");
    expect(scopeText).toContain("!canManageTeamId(playerProfileData.teamId)");
    expect(foundationText).toContain("refreshOpenPlayerProfileAfterTrainingChange");
    expect(scopeText).toContain("openPlayerProfileById");
    expect(scopeText).toContain("shouldLoadSeasonArchive");
    expect(scopeText).toContain("loadedSeasonArchiveSignatureRef");
    expect(scopeText).toContain("setPlayerProfileLoading(true)");
    expect(serviceText).toContain("Stats");
    expect(serviceText).toContain("player-drawer-training-controls");
    expect(previewText).toContain("buildProjectedClassPreview");
    expect(previewText).toContain("reclassRecommended");
    expect(drawerText).toContain("Achsen-Potential");
    expect(drawerText).toContain("data.potentialOverallDelta");
    expect(drawerText).toContain("data.trainingRouteImpact");
    expect(drawerText).toContain("headroomLabel");
    expect(drawerText).toContain("data.transferHistory");
    expect(drawerText).toContain("player-drawer-training-controls");
    expect(drawerText).toContain("PlayerDrawerHistoryTable");
    expect(drawerText).toContain("PLAYER_DRAWER_HISTORY_ABLOESE_TOOLTIP");
    expect(drawerText).toContain("isSeasonDisciplineKey");
    expect(drawerText).toContain("formatValue(row.pow, 1)");
    expect(drawerText).toContain("PlayerDrawerTransferHistoryTable");
    expect(drawerText).toContain("PlayerAttributeProgressChart");
    expect(drawerText).toContain("PlayerTrainingControls");
    expect(drawerText).toContain("PlayerCaPoStarStack");
    expect(drawerText).toContain("player-drawer-ca-po-row");
    expect(drawerText).toContain('data-testid="player-drawer-ca-po-row"');
    expect(drawerText).toContain("player-drawer-hero-axis-grid");
    expect(drawerText).toContain("showFullAxisGrid");
    expect(drawerText).toContain("showCompactAxisStrip");
    expect(drawerText).toContain("player-drawer-axis-strip");
    expect(drawerText).toContain('data-testid="player-drawer-axis-strip"');
    expect(drawerText).toContain("player-drawer-axis-chip-hint");
    expect(drawerText).toContain("player-drawer-axis-chip-accent");
    expect(drawerText).toContain("player-drawer-header-metrics-band");
    expect(drawerText).toContain('data-testid="player-drawer-header-metrics-band"');
    expect(drawerText).toContain('data-testid="player-drawer-header-scout-compact"');
    expect(drawerText).toContain("player-drawer-flavor-de");
    expect(drawerText).toContain('data-testid="player-drawer-flavor-de"');
    expect(drawerText).toContain("player-drawer-stats-chart");
    expect(drawerText).toContain("player-drawer-season-snapshot");
    expect(drawerText).toContain("player-drawer-top-disciplines-layout");
    expect(drawerText).toContain("player-drawer-potential");
    expect(drawerText).toContain("player-drawer-training-history");
    expect(drawerText).toContain("Trainingshistorie");
    expect(drawerText).not.toContain("Legacy XP-Vorschau");
    expect(drawerText).not.toContain("<h3>Klassen-Training</h3>");
    expect(drawerText).not.toContain("Spendbare XP");
    expect(trainingControlsText).toContain("VeloIntensityRail");
    expect(trainingControlsText).toContain("TrainingAttributeForecastGrid");
    expect(trainingControlsText).not.toContain("VeloAttributeFocusTags");
    expect(trainingControlsText).toContain("buildStatForecastTooltip");
    expect(trainingSharedText).toContain("export function TrainingAttributeForecastGrid");
    expect(trainingSharedText).toContain("sortTrainingAttributeForecastByClassProfile");
    expect(trainingSharedText).toContain("training-v2-ceiling-mark");
    expect(chartText).toContain('data-testid="player-attribute-progress-chart"');
    expect(chartText).toContain('data-testid="player-attribute-progress-summary"');
    expect(chartText).toContain('data-testid="player-attribute-progress-str-line"');
    expect(chartText).toContain('data-testid="player-attribute-progress-pp-metric-pow"');
    expect(chartText).toContain('data-testid="player-attribute-progress-attribute-table"');
    expect(chartText).toContain("PLAYER_ATTRIBUTE_CHART_LABELS");
    expect(chartText).toContain("attributeHistoryRows");
    expect(drawerText).toContain("trainingHistoryRows");
    expect(drawerText).toContain("player-drawer-injury-banner");
    expect(drawerText).toContain("player-drawer-injury-history");
    expect(drawerText).toContain("Verletzungshistorie");
    expect(drawerText).toContain("player-drawer-injury-summary");
    expect(drawerText).toContain("injuriesCount");
    expect(drawerText).toContain("matchdaysMissed");
  });
});
