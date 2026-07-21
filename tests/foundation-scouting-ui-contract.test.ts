import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const scoutingPath = path.join(root, "app/foundation/scouting-center-v2/ScoutingCenterV2Client.tsx");
const scoutingQueuePath = path.join(root, "app/foundation/scouting-center-v2/ScoutingPriorityQueue.tsx");
const scoutingReportPath = path.join(root, "app/foundation/scouting-center-v2/ScoutingReportPanel.tsx");
const legacyLineupPath = path.join(root, "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx");
const globalsPath = path.join(root, "app/globals.css");

describe("foundation scouting and workflow portrait ui contract", () => {
  it("renders the scouting priority queue and report with portraits and scouting context stats", async () => {
    const [scoutingText, queueText, reportText, cssText] = await Promise.all([
      fs.readFile(scoutingPath, "utf8"),
      fs.readFile(scoutingQueuePath, "utf8"),
      fs.readFile(scoutingReportPath, "utf8"),
      fs.readFile(globalsPath, "utf8"),
    ]);

    expect(scoutingText).toContain("ScoutingPriorityQueue");
    expect(scoutingText).toContain("ScoutingReportPanel");
    expect(queueText).toContain("getPlayerPortraitBrowserUrl");
    expect(queueText).toContain("isFocusTarget");
    expect(queueText).toContain("isFullyScouted");
    expect(reportText).toContain("getPlayerPortraitBrowserUrl");
    expect(reportText).toContain("caDisplay");
    expect(reportText).toContain("formatScoutedImpactDelta");
    expect(reportText).toContain("VeloPotentialStars");
    expect(reportText).toContain('data-testid="scouting-report-disciplines"');
    expect(cssText).toContain(".scouting-queue-row");
    expect(cssText).toContain(".scouting-report-panel");
    expect(cssText).toContain(".scouting-recommendations-section");
  });

  it("uses compact lineup portrait cards in the legacy matchday pool", async () => {
    const lineupText = await fs.readFile(legacyLineupPath, "utf8");

    expect(lineupText).toContain("FoundationPlayerPortraitCard");
    expect(lineupText).toContain('context="lineup"');
    expect(lineupText).toContain('density="compact"');
    expect(lineupText).toContain("legacy-matchday-player-card");
    expect(lineupText).toContain("slotProjection");
    expect(lineupText).toContain("interactive={false}");
  });

});
