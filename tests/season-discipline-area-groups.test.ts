import { describe, expect, it } from "vitest";

import {
  buildPlayerHistoryDisciplineValues,
  buildTeamHistoryDisciplineValuesFromRecord,
  buildTeamHistoryDisciplineValuesFromSnapshot,
  SEASON_DISCIPLINE_AREA_GROUPS,
} from "@/lib/season/season-discipline-area-groups";

describe("season-discipline-area-groups", () => {
  it("maps discipline breakdown ids to season discipline keys", () => {
    const values = buildPlayerHistoryDisciplineValues([
      { disciplineId: "speed-schach", totalContribution: 6.25 },
      { disciplineId: "tennis", totalContribution: 4.5 },
      { disciplineId: "tdm", totalContribution: 2.1 },
    ]);

    expect(values.schach).toBe(6.3);
    expect(values.tennis).toBe(4.5);
    expect(values.tdm).toBe(2.1);
  });

  it("exposes five disciplines per axis group", () => {
    for (const group of SEASON_DISCIPLINE_AREA_GROUPS) {
      expect(group.keys).toHaveLength(5);
    }
  });

  it("aggregates team discipline values from archived player performances", () => {
    const values = buildTeamHistoryDisciplineValuesFromSnapshot(
      {
        playerPerformances: [
          {
            teamId: "C-C",
            disciplineBreakdown: [
              { disciplineId: "tennis", totalContribution: 4.5 },
              { disciplineId: "schach", totalContribution: 2.2 },
            ],
          },
          {
            teamId: "C-C",
            disciplineBreakdown: [{ disciplineId: "tennis", totalContribution: 1.5 }],
          },
          {
            teamId: "W-W",
            disciplineBreakdown: [{ disciplineId: "tennis", totalContribution: 9.9 }],
          },
        ],
      },
      "C-C",
    );

    expect(values.tennis).toBe(6);
    expect(values.schach).toBe(2.2);
    expect(values.tdm).toBeUndefined();
  });

  it("maps team discipline records to normalized keys", () => {
    const values = buildTeamHistoryDisciplineValuesFromRecord({
      tdm: 12.34,
      bonuspunkte: 99,
      hockey: 3,
    });

    expect(values.tdm).toBe(12.3);
    expect(values.hockey).toBe(3);
    expect(values.bonuspunkte).toBeUndefined();
  });
});
