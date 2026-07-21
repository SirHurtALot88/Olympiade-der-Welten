import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { resolveFirstOpenFormPickCell } from "@/lib/foundation/resolve-first-open-form-cell";

describe("gameplay flow scan contract", () => {
  it("keeps a single form-card write path and flow deep-link into formplan", async () => {
    const [lineupText, foundationText, formBoardText] = await Promise.all([
      fs.readFile(
        path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
        "utf8",
      ),
      fs.readFile(path.join(process.cwd(), "app/foundation/FoundationPageClient.tsx"), "utf8"),
      fs.readFile(
        path.join(process.cwd(), "app/foundation/legacy-lineup-lab/FormBoardPanel.tsx"),
        "utf8",
      ),
    ]);

    expect(lineupText).not.toMatch(/updateModifier\([^)]*,\s*"primaryFormCardId"/);
    expect(lineupText).not.toMatch(/updateModifier\([^)]*,\s*"secondaryFormCardId"/);
    expect(lineupText).toContain("resolveFirstOpenFormPickCell");
    expect(lineupText).toContain("pendingFormBoardFocusRef");
    expect(lineupText).toContain("Formplan synchronisiert");
    expect(lineupText).toContain("Daten-Ansicht");
    expect(lineupText).toContain("legacy-lineup-scoreboard-board-rows");
    expect(foundationText).toContain("getFormCardFlowStatus");
    expect(foundationText).toContain("formCardBlocker");
    expect(foundationText).toContain('targetPanel === "form-board"');
    expect(formBoardText).toContain("data-form-board-cell-id");
    expect(formBoardText).toContain("Plan → Entwurf");
  });

  it("resolves the first open form cell on the current matchday first", () => {
    const cell = resolveFirstOpenFormPickCell({
      schedule: [
        {
          matchdayId: "md-2",
          matchdayIndex: 2,
          discipline1: { disciplineId: "d1", category: "pow" },
          discipline2: null,
        },
        {
          matchdayId: "md-1",
          matchdayIndex: 1,
          discipline1: { disciplineId: "d1", category: "pow" },
          discipline2: { disciplineId: "d2", category: "spe" },
        },
      ],
      formCardPlanByKey: new Map([
        ["md-2:d1", { matchdayId: "md-2", disciplineSide: "d1", primaryFormCardId: "card-1" } as never],
      ]),
      currentMatchdayId: "md-1",
      getFormCardColorForCategory: () => "red",
    });

    expect(cell).toMatchObject({
      matchdayId: "md-1",
      disciplineSide: "d1",
      slot: "primary",
    });
  });

  it("wires prep performance markers for lineup, season and arena", async () => {
    const [lineupText, seasonText, packageText] = await Promise.all([
      fs.readFile(
        path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
        "utf8",
      ),
      fs.readFile(
        path.join(process.cwd(), "app/foundation/season-v2/SeasonStandingsV2Client.tsx"),
        "utf8",
      ),
      fs.readFile(path.join(process.cwd(), "package.json"), "utf8"),
    ]);

    expect(packageText).toContain("@tanstack/react-virtual");
    expect(lineupText).toContain("LegacyLineupVirtualCardGrid");
    expect(lineupText).toContain("scheduleHoveredCandidate");
    expect(lineupText).toContain("expertPlayerTableVirtualWindow");
    expect(seasonText).toContain("standingsTableVirtualWindow");
  });
});
