import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const scopePath = join(root, "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");

describe("foundation shell router body scope contract", () => {
  it("registers one browser history popstate handler and one keyboard back hook", () => {
    const source = readFileSync(scopePath, "utf8");

    expect(source.match(/function handlePopState\(\)/g)?.length ?? 0).toBe(1);
    expect(source.match(/useFoundationKeyboardNavigation\(\{/g)?.length ?? 0).toBe(1);
    expect(source).toContain("setRoomContext(readFoundationRoomContextFromLocation());");
  });

  it("reloads market and preview feeds when AI preseason polling observes a finished run", () => {
    const source = readFileSync(scopePath, "utf8");

    expect(source).toContain("aiPreseasonCompanionReloadRunIdRef");
    expect(source).toContain("await reloadAfterMarketRosterApply();");
    expect(source).toMatch(
      /const pollAiPreseasonRun = async \(\) => \{[\s\S]*await reloadAfterMarketRosterApply\(\);[\s\S]*\};/,
    );
  });
});
