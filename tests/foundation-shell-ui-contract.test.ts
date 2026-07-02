import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { readFoundationOrchestratorSource, readFoundationSurfaceSource } from "./foundation-orchestrator-source";

const root = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten";

async function readFoundationSurfaceSourceLocal() {
  return readFoundationSurfaceSource(root);
}

describe("foundation shell ui contract", () => {
  it("uses left sidebar shell with subnav and url state helpers", async () => {
    const [foundationText, shellText, sidebarText, cssText, navConfigText, routingText, playersTableText] = await Promise.all([
      readFoundationSurfaceSourceLocal(),
      fs.readFile(path.join(root, "app/foundation/shell/FoundationShell.tsx"), "utf8"),
      fs.readFile(path.join(root, "app/foundation/shell/FoundationSidebar.tsx"), "utf8"),
      fs.readFile(path.join(root, "app/globals.css"), "utf8"),
      fs.readFile(path.join(root, "lib/foundation/foundation-nav-config.ts"), "utf8"),
      fs.readFile(path.join(root, "lib/foundation/foundation-view-routing.ts"), "utf8"),
      fs.readFile(path.join(root, "app/foundation/players-table/FoundationPlayersTablePanel.tsx"), "utf8"),
    ]);

    expect(foundationText).toContain("FoundationShell");
    expect(playersTableText).toContain("FoundationViewMount");
    expect(foundationText).toContain("FoundationStateProvider");
    expect(foundationText).not.toContain('getViewClass("trainingCompact")');
    expect(foundationText).toContain("syncFoundationUrlState");
    expect(foundationText).toContain("playerProfile");
    expect(shellText).toContain('data-testid="foundation-shell-layout"');
    expect(shellText).toContain("FoundationActivityStrip");
    expect(shellText).toContain("activities={activities}");
    expect(foundationText).toContain("buildFoundationActivities");
    expect(foundationText).toContain("activities={foundationActivities}");
    expect(sidebarText).toContain("foundation-sidebar-drag-handle");
    expect(sidebarText).toContain("foundation-sidebar-season-context");
    expect(sidebarText).toContain('data-testid="foundation-season-context"');
    expect(sidebarText).toContain("is-attention");
    expect(sidebarText).toContain("loadFoundationSidebarOrder");
    expect(shellText).toContain("buildSeasonContextLabel");
    expect(shellText).toContain("seasonContextLabel={seasonContextLabel}");
    expect(foundationText).toContain("seasonLabel={canonicalSeasonLabel}");
    expect(foundationText).toContain("matchdayDisplayLabel={currentMatchdayDisplayLabel}");
    expect(foundationText).toContain("currentMatchday={gameState.season.currentMatchday}");
    expect(cssText).toContain(".foundation-sidebar-season-context");
    expect(navConfigText).toContain("FOUNDATION_NAV_GROUPS");
    expect(navConfigText).toContain('label: "Sponsoren"');
    expect(navConfigText).toContain("players");
    expect(routingText).toContain("playerProfile");
    expect(routingText).toContain('if (view === "home") return "homeV2"');
    expect(cssText).toContain(".foundation-shell-layout");
    expect(cssText).toContain(".foundation-activity-strip");
    expect(cssText).toContain(".foundation-activity-chip");
    expect(cssText).toContain(".foundation-sidebar");
    expect(cssText).toContain(".foundation-subnav");
  });
});
