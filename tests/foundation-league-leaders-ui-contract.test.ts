import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = "/Users/chrisfalk/Documents/Codex/Olympiade der Welten";

describe("foundation league leaders ui contract", () => {
  it("wires league leaders into the ranks view with card grid markup", async () => {
    const [shellRouterBodyText, scopeText, clientText, globalsText, moduleHelpersText] = await Promise.all([
      fs.readFile(path.join(root, "app/foundation/FoundationShellRouterBody.tsx"), "utf8"),
      fs.readFile(path.join(root, "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"), "utf8"),
      fs.readFile(path.join(root, "app/foundation/league-leaders-v2/LeagueLeadersClient.tsx"), "utf8"),
      fs.readFile(path.join(root, "app/globals.css"), "utf8"),
      fs.readFile(path.join(root, "lib/foundation/tabs/foundation-page-module-helpers.tsx"), "utf8"),
    ]);

    expect(shellRouterBodyText).toContain("<FoundationLeagueLeadersHost");
    expect(scopeText).toContain("buildLeagueLeaderBoards");
    expect(scopeText).toContain("foundationLeagueLeadersHostProps");
    expect(clientText).toContain('data-testid="foundation-league-leaders"');
    expect(clientText).toContain("league-leaders-grid");
    expect(clientText).toContain("is-own-team");
    expect(clientText).toContain("league-leaders-${category.id}");
    expect(clientText).toContain("data-testid={`league-leaders-card-${category.id}`}");
    expect(globalsText).toContain(".league-leaders-card.is-pow");
    expect(globalsText).toContain(".league-leaders-card:hover");
    expect(globalsText).toContain(".player-drawer-kpi-hero-card.is-interactive");
    expect(globalsText).toContain(".league-leaders-card.is-training");
    expect(moduleHelpersText).toContain('return "discipline-ranks";');
  });
});
