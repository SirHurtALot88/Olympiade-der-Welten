import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("game inbox UI contract", () => {
  it("wires the derived inbox into Foundation navigation, Home and global next", () => {
    const crossTabGameFlowSource = readFileSync(
      join(root, "lib/foundation/tabs/use-foundation-cross-tab-game-flow.ts"),
      "utf8",
    );
    const commandPaletteSource = readFileSync(
      join(root, "lib/foundation/tabs/use-foundation-cross-tab-command-palette.ts"),
      "utf8",
    );
    const gameFlowSource = readFileSync(join(root, "lib/foundation/tabs/use-foundation-game-flow.ts"), "utf8");
    const source =
      readFileSync(join(root, "app/foundation/FoundationPageClient.tsx"), "utf8") +
      readFileSync(join(root, "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"), "utf8") +
      readFileSync(join(root, "app/foundation/FoundationShellRouterBody.tsx"), "utf8") +
      crossTabGameFlowSource +
      commandPaletteSource +
      gameFlowSource;
    const routingSource = readFileSync(join(root, "lib/foundation/foundation-view-routing.ts"), "utf8");
    const officeSource = readFileSync(join(root, "app/foundation/home-v2/ManagerOfficeClient.tsx"), "utf8");
    const pageTypesSource = readFileSync(join(root, "lib/foundation/tabs/foundation-page-types.ts"), "utf8");
    const pageModuleHelpersSource = readFileSync(join(root, "lib/foundation/tabs/foundation-page-module-helpers.tsx"), "utf8");

    expect(source).toContain("buildGameInboxItems");
    expect(source).toContain("filterInboxItemsByMode");
    expect(pageTypesSource).toContain('| "inboxV2"');
    const navSource = readFileSync(join(root, "lib/foundation/foundation-nav-config.ts"), "utf8");
    expect(navSource).toContain('{ id: "inboxV2", label: "Inbox"');
    expect(navSource).toContain("Offene Aufgaben & Warnungen");
    expect(source).toContain("FoundationShellRouterInboxV2");
    const inboxHostSource = readFileSync(join(root, "app/foundation/inbox-v2/FoundationInboxV2Host.tsx"), "utf8");
    expect(inboxHostSource).toContain("<InboxV2Client");
    expect(routingSource).toContain('if (view === "inbox") return "inboxV2"');
    expect(source).toContain("FoundationShellRouterHomeV2");
    expect(source).toContain("selectedHqGmStory");
    expect(officeSource).toContain('data-testid="foundation-hq"');
    expect(source).toContain("primaryInboxItem");
    expect(source).toContain("navigateToInboxItem");
    expect(source).toContain('section: "Spieler"');
    expect(source).toContain("openPlayerDrawerById(player.id");
    expect(source).toContain("openTeamDrawerById(team.teamId)");
    expect(source).toContain("Ansicht, Team, Spieler, Aktion oder Begriff suchen");
    expect(source).toContain('section: "Lexikon"');
    expect(source).toContain('data-testid="foundation-encyclopedia"');
    expect(source).toContain('window.addEventListener("foundation:open-game-term"');
    expect(source).toContain('command.section === "Lexikon" ? 1000 : 0');
    expect(officeSource).toContain('data-testid="foundation-hq-gm-story"');
    expect(source).toContain("resolveFoundationPanelScrollTarget");
    expect(source).toContain("FoundationSponsorsPanel");
    expect(readFileSync(join(root, "app/foundation/sponsors-v2/FoundationSponsorsPanel.tsx"), "utf8")).toContain("team-sponsor-choice");
    expect(pageModuleHelpersSource).toContain("team-board-objectives");
    expect(source).toContain("marketFocusPlayerId");
    expect(source).toContain("exactLabelMatch");
    expect(source).toContain("handleHumanLineupSaved");
    expect(source).toContain("reloadLiveSeasonState");
    expect(source).toContain('item.itemId.startsWith("lineup_missing:")');
    expect(source).toContain("activeViewHandlesOwnSpace");
    expect(source).toContain('gameFlowActionStep.stepId === "advance_to_next_matchday"');
    expect(source).toContain("runCockpitMatchdayAdvance(true)");
    expect(
      readFileSync(join(root, "components/foundation/FoundationTableUi.tsx"), "utf8"),
    ).toContain("Alle anzeigen");
    expect(source).toContain("ColumnVisibilityManager");
    expect(source).toContain('label: "Entscheidungen"');
    expect(source).toContain('label: "Chronik"');
    expect(source).toContain("activeTeamDecisionInboxItems");
    expect(source).toContain("filterInboxItemsByMode");
    expect(
      readFileSync(join(root, "app/foundation/home-v2/FoundationHomeV2Host.tsx"), "utf8"),
    ).toContain("inboxCriticalCount");
    expect(readFileSync(join(root, "app/foundation/home-v2/HomeV2Client.tsx"), "utf8")).toContain("Alle Aufgaben");
    expect(readFileSync(join(root, "app/foundation/inbox-v2/InboxV2Client.tsx"), "utf8")).toContain('data-inbox-mode={mode}');
    expect(readFileSync(join(root, "app/foundation/home-v2/ManagerOfficeClient.tsx"), "utf8")).toContain("Entscheidungen öffnen");
    expect(inboxHostSource).toContain("applyInboxQuickAction");
    expect(
      readFileSync(join(root, "lib/foundation/tabs/use-inbox-v2-derivations.ts"), "utf8"),
    ).toContain("mapInboxQuickActionsToChoices");
    expect(source).toContain("seasonReadinessChecklist");
  });

  it("keeps the searchable game encyclopedia wired to tooltips", () => {
    const foundationSource =
      readFileSync(join(root, "app/foundation/FoundationPageClient.tsx"), "utf8") +
      readFileSync(join(root, "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"), "utf8");
    const termSource = readFileSync(join(root, "components/ui/GameTerm.tsx"), "utf8");
    const encyclopediaSource = readFileSync(join(root, "lib/ui/game-encyclopedia.ts"), "utf8");

    expect(encyclopediaSource).toContain("GAME_ENCYCLOPEDIA_ENTRIES");
    expect(encyclopediaSource).toContain('term: "OVR"');
    expect(encyclopediaSource).toContain('term: "MVS"');
    expect(encyclopediaSource).toContain('term: "PPs"');
    expect(termSource).toContain('foundation:open-game-term');
    expect(foundationSource).toContain("openEncyclopediaEntry");
  });

  it("persists inbox done and dismissed status into the local save", () => {
    const source =
      readFileSync(join(root, "app/foundation/FoundationPageClient.tsx"), "utf8") +
      readFileSync(join(root, "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"), "utf8");

    expect(source).toContain("updateInboxItemStatus");
    expect(source).toContain("persistLocalGameStateImmediately(nextGameState)");
    expect(source).toContain('gameInboxItems: nextItems');
  });
});
