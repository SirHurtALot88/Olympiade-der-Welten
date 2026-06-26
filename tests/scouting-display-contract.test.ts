import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { buildScoutedDisciplineTiers } from "@/lib/market/transfermarkt-scouting";
import { buildProjectedClassPreview } from "@/lib/foundation/projected-class-preview";

describe("scouting display contract", () => {
  it("renders VeloScoutMetric in scouting center and home v2", async () => {
    const [scoutingText, homeText, metricText] = await Promise.all([
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/scouting-center-v2/ScoutingCenterV2Client.tsx",
        "utf8",
      ),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/home-v2/HomeV2Client.tsx", "utf8"),
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/components/foundation/velo-ui/VeloScoutMetric.tsx",
        "utf8",
      ),
    ]);

    expect(scoutingText).toContain("VeloScoutMetric");
    expect(scoutingText).toContain("scouting-top-disciplines");
    expect(scoutingText).toContain("FoundationSubNav");
    expect(homeText).toContain("VeloStatOrbitRow");
    expect(homeText).toContain("home-v2-signal-strip");
    expect(metricText).toContain('data-testid="velo-scout-metric"');
  });

  it("shows per-axis orbit chips with grade letters in scouting watchlist cards", async () => {
    const scoutingText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/scouting-center-v2/ScoutingCenterV2Client.tsx",
      "utf8",
    );
    expect(scoutingText).toContain("VeloStatOrbitRow");
    expect(scoutingText).toContain("showGrade");
    expect(scoutingText).toContain('testId: "scouting-watchlist-card"');
    expect(scoutingText).toContain('testId: "scouting-bookmarked-target-card"');
    expect(scoutingText).toContain("Aktiv gescoutet");
    expect(scoutingText).toContain("Nur gemerkt");
    expect(scoutingText).toContain('data-testid="scouting-potential-band"');
    expect(scoutingText).toContain('data-testid="scouting-ca-po-row"');
    expect(scoutingText).toContain('data-testid="scouting-potential-stars"');
    expect(scoutingText).toContain('data-testid="scouting-po-axis-stars"');
    expect(scoutingText).toContain("VeloStarRating");
  });

  it("scouting-center-v2-types extends watch target with CA/PO star fields", async () => {
    const typesText = await fs.readFile(
      "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/scouting-center-v2/scouting-center-v2-types.ts",
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
