import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("legacy lineup velo ui contract", () => {
  it("shows role lanes and flow validation checklist", async () => {
    const fileText = await fs.readFile(
      path.join(process.cwd(), "app/foundation/legacy-lineup-lab/LegacyLineupLabClient.tsx"),
      "utf8",
    );
    const cssText = await fs.readFile(path.join(process.cwd(), "app/globals.css"), "utf8");

    // NOTE: `data-testid="legacy-lineup-flow-checklist"` and
    // "legacy-lineup-role-lanes"/"legacy-lineup-role-lane" are no longer
    // referenced by any .tsx file (only as dead rules in app/globals.css), and
    // no differently-named equivalent was found in LineupNewLook.tsx (the
    // component actually rendered now — see LegacyLineupLabClient.tsx, which
    // always returns <LineupNewLook> or <FormBoardPanel> regardless of
    // uiVariant). This looks like a real feature loss (see final report), so
    // these assertions are intentionally left unchanged/red.
    expect(fileText).toContain('data-testid="legacy-lineup-flow-checklist"');
    expect(fileText).toContain("legacy-lineup-role-lanes");
    expect(cssText).toContain(".legacy-lineup-flow-checklist");
    expect(cssText).toContain(".legacy-lineup-role-lane");
  });
});
