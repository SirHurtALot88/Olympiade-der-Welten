import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("game inbox UI contract", () => {
  it("wires the derived inbox into Foundation navigation, Home and global next", () => {
    const source = readFileSync(join(root, "app/foundation/FoundationPageClient.tsx"), "utf8");

    expect(source).toContain('import { buildGameInboxItems, filterGameInboxItems, getPrimaryInboxTask }');
    expect(source).toContain('| "inbox"');
    expect(source).toContain('{ id: "inbox", label: "Inbox"');
    expect(source).toContain('data-testid="foundation-inbox"');
    expect(source).toContain('data-testid="home-task-list"');
    expect(source).toContain('data-testid="home-story-cards"');
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
    expect(source).toContain('data-testid="foundation-hq-gm-story"');
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

  it("keeps the inbox read-only in V1", () => {
    const source = readFileSync(join(root, "app/foundation/FoundationPageClient.tsx"), "utf8");

    expect(source).not.toContain("dismissInboxItem");
    expect(source).not.toContain("completeInboxItem");
    expect(source).not.toContain("/api/inbox");
  });
});
