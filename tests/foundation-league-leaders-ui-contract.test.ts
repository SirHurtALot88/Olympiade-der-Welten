import fs from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("foundation league leaders ui contract", () => {
  it("wires league leaders into the ranks view with card grid markup", async () => {
    const [shellRouterBodyText, scopeText, clientText, globalsText, moduleHelpersText] = await Promise.all([
      fs.readFile(path.join(root, "app/foundation/FoundationShellRouterBody.tsx"), "utf8"),
      fs.readFile(path.join(root, "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx"), "utf8"),
      // LeagueLeadersClient.tsx is now just a thin wrapper; the real markup
      // (and the "New Look" nl-leaders-* class names) lives in LeagueLeadersNewLook.tsx.
      fs.readFile(path.join(root, "app/foundation/league-leaders-v2/LeagueLeadersNewLook.tsx"), "utf8"),
      fs.readFile(path.join(root, "app/globals.css"), "utf8"),
      fs.readFile(path.join(root, "lib/foundation/tabs/foundation-page-module-helpers.tsx"), "utf8"),
    ]);

    expect(shellRouterBodyText).toContain("<FoundationLeagueLeadersHost");
    expect(scopeText).toContain("buildLeagueLeaderBoards");
    expect(scopeText).toContain("foundationLeagueLeadersHostProps");
    expect(clientText).toContain('data-testid="foundation-league-leaders"');
    // Class names were migrated to the "New Look" nl- prefix convention
    // (league-leaders-grid -> nl-leaders-grid, league-leaders-back-link -> nl-leaders-back),
    // consistent with the rest of the v2 redesign; data-testids stayed stable.
    expect(clientText).toContain("nl-leaders-grid");
    expect(clientText).toContain("is-own-team");
    expect(clientText).toContain("returnContext");
    expect(clientText).toContain("nl-leaders-back");
    expect(clientText).toContain("onReturnToPlayer");
    expect(clientText).toContain("data-testid={`league-leaders-card-${category.id}`}");
    expect(globalsText).toContain(".league-leaders-card.is-pow");
    expect(globalsText).toContain(".league-leaders-card:hover");
    expect(globalsText).toContain(".player-drawer-kpi-hero-card.is-interactive");
    expect(globalsText).toContain(".league-leaders-card.is-training");
    expect(moduleHelpersText).toContain('return "discipline-ranks";');
  });
});
