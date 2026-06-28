import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("game inbox UI contract", () => {
  it("wires the derived inbox into Foundation navigation, Home and global next", () => {
    const source = readFileSync(join(root, "app/foundation/FoundationPageClient.tsx"), "utf8");
    const routingSource = readFileSync(join(root, "lib/foundation/foundation-view-routing.ts"), "utf8");
    const officeSource = readFileSync(join(root, "app/foundation/home-v2/ManagerOfficeClient.tsx"), "utf8");

    expect(source).toContain('import { buildGameInboxItems, filterGameInboxItems, getPrimaryInboxTask }');
    expect(source).toContain('| "inboxV2"');
    const navSource = readFileSync(join(root, "lib/foundation/foundation-nav-config.ts"), "utf8");
    expect(navSource).toContain('{ id: "inboxV2", label: "Inbox"');
    expect(source).toContain("<InboxV2Client");
    expect(routingSource).toContain('if (view === "inbox") return "inboxV2"');
    expect(source).toContain("<FoundationHomeV2Panel");
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
    expect(source).toContain("team-board-objectives");
    expect(source).toContain("marketFocusPlayerId");
    expect(source).toContain("exactLabelMatch");
    expect(source).toContain("handleHumanLineupSaved");
    expect(source).toContain("reloadLiveSeasonState");
    expect(source).toContain('item.itemId.startsWith("lineup_missing:")');
    expect(source).toContain("activeViewHandlesOwnSpace");
    expect(source).toContain('gameFlowActionStep.stepId === "advance_to_next_matchday"');
    expect(source).toContain("runCockpitMatchdayAdvance(true)");
    expect(source).toContain("Alle anzeigen");
  });

  it("keeps the searchable game encyclopedia wired to tooltips", () => {
    const foundationSource = readFileSync(join(root, "app/foundation/FoundationPageClient.tsx"), "utf8");
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
    const source = readFileSync(join(root, "app/foundation/FoundationPageClient.tsx"), "utf8");

    expect(source).toContain("updateInboxItemStatus");
    expect(source).toContain("persistLocalGameStateImmediately(nextGameState)");
    expect(source).toContain('gameInboxItems: nextItems');
  });
});
