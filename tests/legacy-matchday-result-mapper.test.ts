import { describe, expect, it } from "vitest";

import { mapLegacyMatchdayResolvePreviewToResultPayload } from "@/lib/resolve/legacy-matchday-result-mapper";
import type { LegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-types";

function createPreview(): LegacyMatchdayResolvePreview {
  return {
    saveId: "save-initial",
    seasonId: "season-1",
    matchdayId: "matchday-1",
    warnings: ["One team is underfilled."],
    missingScores: [],
    missingLineups: [{ teamId: "B-B", teamName: "Beta Beasts" }],
    teamResults: [
      {
        teamId: "A-A",
        teamName: "Alpha Alliance",
        d1DisciplineId: "mini-dm",
        d1Score: 40,
        d2DisciplineId: "fechten",
        d2Score: 70,
        totalScore: 110,
        rank: 1,
        warnings: [],
        missingLineup: false,
        missingScores: [],
      },
      {
        teamId: "B-B",
        teamName: "Beta Beasts",
        d1DisciplineId: "mini-dm",
        d1Score: 0,
        d2DisciplineId: "fechten",
        d2Score: 0,
        totalScore: 0,
        rank: 2,
        warnings: ["No existing legacy lineup draft was found for this team and matchday."],
        missingLineup: true,
        missingScores: [],
      },
    ],
    disciplinePreviews: [
      {
        disciplineId: "mini-dm",
        disciplineName: "Mini DM",
        disciplineSide: "d1",
        teamResults: [
          {
            teamId: "A-A",
            teamName: "Alpha Alliance",
            disciplineId: "mini-dm",
            disciplineSide: "d1",
            score: 40,
            rank: 1,
            warnings: [],
            missingLineup: false,
          },
          {
            teamId: "B-B",
            teamName: "Beta Beasts",
            disciplineId: "mini-dm",
            disciplineSide: "d1",
            score: 0,
            rank: 2,
            warnings: ["Missing lineup for this discipline side."],
            missingLineup: true,
          },
        ],
        topPlayers: [
          {
            matchdayId: "matchday-1",
            disciplineId: "mini-dm",
            teamId: "A-A",
            playerId: "player-1",
            activePlayerId: "active-1",
            playerName: "Arkon",
            slotIndex: 1,
            baseValue: 22,
            finalPlayerScore: 22,
            scoreContribution: 0.55,
            rankInTeam: 1,
            rankInDiscipline: 1,
            isTop10: true,
            isMvpCandidate: true,
            storyWeight: 0.55,
          },
        ],
        highlightCandidates: [
          {
            matchdayId: "matchday-1",
            disciplineId: "mini-dm",
            highlightType: "best_player_discipline",
            teamId: "A-A",
            playerId: "player-1",
            importanceScore: 22,
            shortSummary: "Top player in Mini DM",
            payload: { playerName: "Arkon" },
          },
        ],
      },
      {
        disciplineId: "fechten",
        disciplineName: "Fechten",
        disciplineSide: "d2",
        teamResults: [
          {
            teamId: "A-A",
            teamName: "Alpha Alliance",
            disciplineId: "fechten",
            disciplineSide: "d2",
            score: 70,
            rank: 1,
            warnings: [],
            missingLineup: false,
          },
          {
            teamId: "B-B",
            teamName: "Beta Beasts",
            disciplineId: "fechten",
            disciplineSide: "d2",
            score: 0,
            rank: 2,
            warnings: ["Missing lineup for this discipline side."],
            missingLineup: true,
          },
        ],
        topPlayers: [
          {
            matchdayId: "matchday-1",
            disciplineId: "fechten",
            teamId: "A-A",
            playerId: "player-2",
            activePlayerId: "active-2",
            playerName: "Belric",
            slotIndex: 1,
            baseValue: 30,
            finalPlayerScore: 30,
            scoreContribution: 0.43,
            rankInTeam: 1,
            rankInDiscipline: 1,
            isTop10: true,
            isMvpCandidate: true,
            storyWeight: 0.43,
          },
        ],
        highlightCandidates: [
          {
            matchdayId: "matchday-1",
            disciplineId: "fechten",
            highlightType: "strongest_team_score",
            teamId: "A-A",
            importanceScore: 70,
            shortSummary: "Strongest team score in Fechten",
            payload: { score: 70 },
          },
        ],
      },
    ],
  };
}

describe("legacy matchday result mapper", () => {
  it("creates the expected payload structure", () => {
    const payload = mapLegacyMatchdayResolvePreviewToResultPayload({
      preview: createPreview(),
      sourceVersion: "resolve-preview-v1",
      readinessByTeamId: {
        "A-A": { readinessStatus: "ready", shortReason: "Draft is valid." },
        "B-B": { readinessStatus: "underfilled_roster", shortReason: "Only 6 active players." },
      },
    });

    expect(payload.matchdayResultPayload.matchdayId).toBe("matchday-1");
    expect(payload.matchdayResultPayload.teamsTotal).toBe(2);
    expect(payload.disciplineResultPayloads).toHaveLength(4);
    expect(payload.playerPerformancePayloads).toHaveLength(2);
    expect(payload.highlightPayloads).toHaveLength(2);
    expect(payload.auditPayload.action).toBe("prepare_apply_payload");
  });

  it("keeps missing and underfilled teams in the payload", () => {
    const payload = mapLegacyMatchdayResolvePreviewToResultPayload({
      preview: createPreview(),
      sourceVersion: "resolve-preview-v1",
      readinessByTeamId: {
        "A-A": { readinessStatus: "ready" },
        "B-B": { readinessStatus: "underfilled_roster" },
      },
    });

    expect(payload.matchdayResultPayload.teamsUnderfilled).toBe(1);
    expect(payload.disciplineResultPayloads.filter((entry) => entry.teamId === "B-B")).toHaveLength(2);
    expect(payload.disciplineResultPayloads.find((entry) => entry.teamId === "B-B")?.readinessStatus).toBe(
      "underfilled_roster",
    );
  });

  it("copies top players into performance payloads", () => {
    const payload = mapLegacyMatchdayResolvePreviewToResultPayload({
      preview: createPreview(),
      sourceVersion: "resolve-preview-v1",
    });

    expect(payload.playerPerformancePayloads.map((entry) => entry.playerId)).toEqual(["player-1", "player-2"]);
    expect(payload.playerPerformancePayloads[0]?.activePlayerId).toBe("active-1");
  });

  it("copies highlight candidates into highlight payloads", () => {
    const payload = mapLegacyMatchdayResolvePreviewToResultPayload({
      preview: createPreview(),
      sourceVersion: "resolve-preview-v1",
    });

    expect(payload.highlightPayloads.map((entry) => entry.highlightType)).toEqual([
      "best_player_discipline",
      "strongest_team_score",
    ]);
  });

  it("falls back to missing_lineup without a readiness map", () => {
    const payload = mapLegacyMatchdayResolvePreviewToResultPayload({
      preview: createPreview(),
      sourceVersion: "resolve-preview-v1",
    });

    expect(payload.matchdayResultPayload.teamsMissingLineup).toBe(1);
    expect(payload.matchdayResultPayload.teamsReady).toBe(1);
  });

  it("stays a pure mapper without prisma client access", async () => {
    const moduleText = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        "/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/resolve/legacy-matchday-result-mapper.ts",
        "utf8",
      ),
    );

    expect(moduleText).not.toContain("PrismaClient");
    expect(moduleText).not.toContain("createMany");
    expect(moduleText).not.toContain("upsert(");
  });
});
