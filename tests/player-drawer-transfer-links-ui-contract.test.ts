import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("player drawer transfer links ui contract", () => {
  it("wires clickable team links in transfer history rows", async () => {
    const [drawerText, serviceText] = await Promise.all([
      fs.readFile(path.join(process.cwd(), "app/foundation/PlayerDetailDrawer.tsx"), "utf8"),
      fs.readFile(path.join(process.cwd(), "lib/foundation/player-detail-drawer.ts"), "utf8"),
    ]);

    expect(drawerText).toContain("PlayerDrawerTransferHistoryTable");
    expect(drawerText).toContain("onOpenTeam");
    expect(drawerText).toContain('className="table-link-button"');
    expect(drawerText).toContain("entry.fromTeamId");
    expect(drawerText).toContain("entry.toTeamId");
    expect(serviceText).toContain("fromTeamId:");
    expect(serviceText).toContain("toTeamId:");
    expect(serviceText).toContain("playerId:");
  });
});
