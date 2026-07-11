import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { readFoundationOrchestratorSource, readFoundationSurfaceSource } from "./foundation-orchestrator-source";

const root = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten";

describe("foundation v2-only ui contract", () => {
  it("hides classic transfer market and history tabs from the main shell", async () => {
    const foundationText = await readFoundationOrchestratorSource(root);
    const transferText = await fs.readFile(`${root}/app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx`, "utf8");
    const routingText = await fs.readFile(`${root}/lib/foundation/foundation-view-routing.ts`, "utf8");

    expect(foundationText).not.toContain("marketBuyModalOpen");
    expect(foundationText).not.toContain("foundation-modal-backdrop");
    expect(foundationText).not.toContain('aria-label="Transfermarkt Ansicht"');
    expect(foundationText).not.toContain('aria-label="Transferhistorie Ansicht"');
    expect(foundationText).toContain('const isTransferMarketViewActive = activeView === "marketV2"');
    expect(foundationText).toContain('const isTransferHistoryViewActive = activeView === "historyV2"');
    expect(transferText).not.toContain("Klassischer Markt");
    expect(routingText).toContain('if (view === "history") return "historyV2"');
  });

  it("uses shell subnav for home and season without duplicate player profile tabs", async () => {
    const foundationText = await readFoundationOrchestratorSource(root);
    const playerProfileText = await fs.readFile(`${root}/app/foundation/player-profile/PlayerProfileClient.tsx`, "utf8");
    const homeText = await fs.readFile(`${root}/app/foundation/home-v2/HomeV2Client.tsx`, "utf8");
    const routingText = await fs.readFile(`${root}/lib/foundation/foundation-view-routing.ts`, "utf8");

    expect(foundationText).toContain('activeView === "homeV2"');
    expect(foundationText).toContain('activeView === "seasonV2"');
    expect(foundationText).toContain("seasonStandingsMode");
    expect(foundationText).toContain('activeView === "teams" && selectedTeam');
    expect(playerProfileText).not.toContain("FoundationSubNav");
    expect(foundationText).not.toContain("onOpenClassicHome={()");
    expect(foundationText).not.toContain("onOpenHomeV2={()");
    expect(foundationText).not.toContain('activeView === "home" ? (');
    expect(foundationText).not.toContain('data-testid="foundation-home"');
    expect(homeText).not.toContain("onOpenClassicHome");
    expect(routingText).toContain('if (view === "home") return "homeV2"');
  });

  it("uses classic teams v1 with league table, history and economy tiles", async () => {
    const foundationText = await readFoundationOrchestratorSource(root);
    const teamsPanelText = await fs.readFile(`${root}/app/foundation/teams-v2/FoundationTeamsDetailPanel.tsx`, "utf8");
    const teamsHostText = await fs.readFile(`${root}/app/foundation/teams-v2/FoundationTeamsViewHost.tsx`, "utf8");

    expect(foundationText).not.toContain("TeamsV2Client");
    expect(foundationText).not.toContain("teamsViewMode");
    expect(foundationText).not.toContain("V2 Übersicht");
    expect(teamsPanelText).toContain('id="teams-league-overview"');
    expect(teamsPanelText).toContain('selectedTeamDetailTab === "roster"');
    expect(teamsHostText).toContain("teamEconomyTiles");
    expect(teamsPanelText).toContain("teams-v2-focus-card");
    expect(teamsPanelText).toContain("TeamDrawerHistoryTable");
    expect(teamsPanelText).toContain("injuriesCount");
    expect(teamsPanelText).toContain("averageFatigue");
    expect(teamsPanelText).toContain("isSeasonDisciplineKey");
    expect(teamsPanelText).toContain('data-testid="team-board-objectives"');
    expect(foundationText).not.toMatch(/\{false\s*\?\s*\([\s\S]*foundation-inbox-panel/);
  });

  it("routes inbox through inboxV2 only with decisions and chronicle shell subnav", async () => {
    const [foundationText, commandPaletteText, navText, inboxHostText] = await Promise.all([
      readFoundationSurfaceSource(root),
      fs.readFile(
        `${root}/lib/foundation/tabs/use-foundation-cross-tab-command-palette.ts`,
        "utf8",
      ),
      fs.readFile(`${root}/lib/foundation/foundation-nav-config.ts`, "utf8"),
      fs.readFile(`${root}/app/foundation/inbox-v2/FoundationInboxV2Host.tsx`, "utf8"),
    ]);

    expect(navText).toContain('"inboxV2"');
    expect(navText).toContain("Offene Aufgaben & Warnungen");
    expect(foundationText).toContain('activeView === "inboxV2"');
    expect(foundationText).toContain("FoundationShellRouterInboxV2");
    expect(commandPaletteText).toContain('label: "Entscheidungen"');
    expect(commandPaletteText).toContain('label: "Chronik"');
    expect(inboxHostText).toContain("hideCategoryFilters");
    expect(foundationText).not.toContain('setFoundationView("inbox"');
  });

  it("uses player profile page variant with full drawer content", async () => {
    const playerProfileText = await fs.readFile(`${root}/app/foundation/player-profile/PlayerProfileClient.tsx`, "utf8");
    const drawerText = await fs.readFile(`${root}/app/foundation/PlayerDetailDrawer.tsx`, "utf8");

    expect(playerProfileText).toContain('variant="page"');
    expect(playerProfileText).toContain("PlayerDetailDrawer");
    expect(drawerText).toContain('variant?: "drawer" | "page"');
    expect(drawerText).toContain("player-drawer-page");
  });

  it("exposes shell subnav for lineup, scouting, and training compact", async () => {
    const foundationText = await readFoundationSurfaceSource(root);
    const lineupHostText = await fs.readFile(
      `${root}/app/foundation/legacy-lineup-lab/FoundationLineupShellHost.tsx`,
      "utf8",
    );

    expect(foundationText).toContain('activeView === "lineup"');
    expect(foundationText).toContain('{ id: "formBoard", label: "Formplan" }');
    expect(lineupHostText).toContain("shellControlledDraftBoardView");
    expect(foundationText).toContain('activeView === "scoutingCenterV2"');
    expect(foundationText).toContain('activeView === "trainingCompact"');
    expect(foundationText).toContain('{ id: "forecast", label: "Forecast" }');
  });
});
