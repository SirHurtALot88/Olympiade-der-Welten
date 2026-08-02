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
      // FoundationPageClient.tsx is now a thin wrapper; this wiring lives in
      // use-foundation-shell-router-body-scope.tsx.
      fs.readFile(
        path.join(process.cwd(), "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"),
        "utf8",
      ),
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
    // NOTE: "Daten-Ansicht" and the whole "legacy-lineup-scoreboard-*" CSS
    // class family (source-strip, table-shell, board-rows, board-row, ...) are
    // no longer referenced by any .tsx file — only as dead rules/comments in
    // app/globals.css. This looks like the "Daten-Ansicht" scoreboard panel
    // was dropped entirely from the legacy lineup screen (real feature loss,
    // see final report), so these two assertions are intentionally left
    // unchanged/red rather than papered over.
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
      // SeasonStandingsV2Client.tsx is now a thin wrapper around SeasonStandingsNewLook.tsx.
      fs.readFile(
        path.join(process.cwd(), "app/foundation/season-v2/SeasonStandingsNewLook.tsx"),
        "utf8",
      ),
      fs.readFile(path.join(process.cwd(), "package.json"), "utf8"),
    ]);

    expect(packageText).toContain("@tanstack/react-virtual");
    // "LegacyLineupVirtualCardGrid" pinnte nur einen nie genutzten Import aus
    // der toten Geschwisterdatei LegacyLineupVirtualTableBody.tsx — beide sind
    // mit dem Dead-Code-Cleanup entfernt. Die echte Virtualisierung der
    // Spieler-Tabelle läuft über useRowVirtualWindow / expertPlayerTableVirtualWindow
    // (siehe Assertion unten), die davon unberührt bleibt.
    expect(lineupText).toContain("scheduleHoveredCandidate");
    expect(lineupText).toContain("expertPlayerTableVirtualWindow");
    // NOTE: react-virtual / useVirtualizer is now only used by the players
    // table and legacy lineup table — SeasonStandingsNewLook.tsx (and no other
    // file under app/foundation/season-v2/) uses "standingsTableVirtualWindow"
    // or any virtualizer anymore. Standings tables are small (bounded by team
    // count) so this may be an intentional simplification rather than a real
    // loss, but flagging per the audit process (see final report) rather than
    // guessing — left red intentionally.
    expect(seasonText).toContain("standingsTableVirtualWindow");
  });
});
