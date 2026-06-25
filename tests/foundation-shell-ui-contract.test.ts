import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("foundation shell ui contract", () => {
  it("uses left sidebar shell with subnav and url state helpers", async () => {
    const [foundationText, shellText, cssText, navConfigText, routingText] = await Promise.all([
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/FoundationPageClient.tsx", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/foundation/shell/FoundationShell.tsx", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/app/globals.css", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/foundation-nav-config.ts", "utf8"),
      fs.readFile("/Users/chrisfalk/Documents/Codex/Olympiade der Welten/lib/foundation/foundation-view-routing.ts", "utf8"),
    ]);

    expect(foundationText).toContain("FoundationShell");
    expect(foundationText).toContain("syncFoundationUrlState");
    expect(foundationText).toContain("playerProfile");
    expect(shellText).toContain('data-testid="foundation-shell-layout"');
    expect(navConfigText).toContain("FOUNDATION_NAV_GROUPS");
    expect(navConfigText).toContain("players");
    expect(routingText).toContain("playerProfile");
    expect(routingText).toContain('if (view === "home") return "homeV2"');
    expect(cssText).toContain(".foundation-shell-layout");
    expect(cssText).toContain(".foundation-sidebar");
    expect(cssText).toContain(".foundation-subnav");
  });
});
