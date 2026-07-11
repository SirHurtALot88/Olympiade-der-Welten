import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildScoutedDisciplineTiers } from "@/lib/market/transfermarkt-scouting";
import { buildProjectedClassPreview } from "@/lib/foundation/projected-class-preview";

const root = process.cwd();

describe("scouting display contract", () => {
  it("renders VeloScoutMetric in scouting report and keeps recommendations tab", async () => {
    const [scoutingText, reportText, metricText, managerOfficeText] = await Promise.all([
      fs.readFile(path.join(root, "app/foundation/scouting-center-v2/ScoutingCenterV2Client.tsx"), "utf8"),
      fs.readFile(path.join(root, "app/foundation/scouting-center-v2/ScoutingReportPanel.tsx"), "utf8"),
      fs.readFile(path.join(root, "components/foundation/velo-ui/VeloScoutMetric.tsx"), "utf8"),
      fs.readFile(path.join(root, "app/foundation/home-v2/ManagerOfficeClient.tsx"), "utf8"),
    ]);

    expect(scoutingText).toContain('data-testid="scouting-recommendations"');
    expect(scoutingText).toContain("FoundationSubNav");
    expect(scoutingText).not.toContain("scouting-top-disciplines");
    expect(reportText).toContain("VeloScoutMetric");
    expect(reportText).toContain('data-testid="scouting-report-disciplines"');
    expect(managerOfficeText).toContain("VeloStatOrbitRow");
    expect(metricText).toContain('data-testid="velo-scout-metric"');
  });

  it("renders the scouting priority queue as a drag-and-drop reorderable wishlist", async () => {
    const [scoutingText, queueText] = await Promise.all([
      fs.readFile(path.join(root, "app/foundation/scouting-center-v2/ScoutingCenterV2Client.tsx"), "utf8"),
      fs.readFile(path.join(root, "app/foundation/scouting-center-v2/ScoutingPriorityQueue.tsx"), "utf8"),
    ]);
    expect(scoutingText).toContain("ScoutingPriorityQueue");
    expect(scoutingText).toContain("Scouting Report");
    expect(queueText).toContain('data-testid="scouting-priority-queue"');
    expect(queueText).toContain("scouting-queue-focus-row");
    expect(queueText).toContain("draggable");
    expect(queueText).toContain("onDrop");
    expect(queueText).toContain("onReorder");
  });

  it("shows fog-of-war gated top-6 impact, POW/SPE/MEN/SOC and traits in the scouting report panel", async () => {
    const reportText = await fs.readFile(
      path.join(root, "app/foundation/scouting-center-v2/ScoutingReportPanel.tsx"),
      "utf8",
    );
    expect(reportText).toContain("VeloStatOrbitRow");
    expect(reportText).toContain("showAxisOrbit");
    expect(reportText).toContain("VeloStarRating");
    expect(reportText).toContain("VeloPotentialStars");
    expect(reportText).toContain("formatScoutedImpactDelta");
    expect(reportText).toContain('data-testid="scouting-report-panel"');
    expect(reportText).toContain('data-testid="scouting-report-top6-impact"');
    expect(reportText).toContain("impactIsExact");
    expect(reportText).toContain("disciplineImpact");
    expect(reportText).toContain("traits.visiblePositive");
  });

  it("scouting-center-v2-types extends watch target with CA/PO star fields", async () => {
    const typesText = await fs.readFile(
      path.join(root, "app/foundation/scouting-center-v2/scouting-center-v2-types.ts"),
      "utf8",
    );
    expect(typesText).toContain("pow?");
    expect(typesText).toContain("caOverall?");
    expect(typesText).toContain("poDisplay?");
    expect(typesText).toContain("potentialScore?");
    expect(typesText).toContain("potentialBand?");
  });

  it("keeps scouting noise wide enough at low levels", () => {
    const tiers = buildScoutedDisciplineTiers({
      saveId: "test-save",
      playerId: "player-noise-test",
      scoutingLevel: 1,
      disciplines: [{ disciplineId: "pow", disciplineName: "POW", score: 75 }],
      topN: 3,
    });

    const entry = tiers[0];
    expect(entry).toBeTruthy();
    if (!entry) return;
    expect(Math.abs(entry.displayedScore - 75)).toBeGreaterThan(3);
  });

  it("projects top classes without mutating current class mid-season preview", () => {
    const preview = buildProjectedClassPreview(
      {
        power: 80,
        health: 70,
        stamina: 72,
        intelligence: 65,
        awareness: 66,
        determination: 68,
        speed: 74,
        dexterity: 70,
        charisma: 60,
        will: 62,
        spirit: 58,
        torment: 78,
      },
      "Berserker",
    );

    expect(preview.currentClassName).toBe("Berserker");
    expect(preview.projectedTop3.length).toBe(3);
  });
});
