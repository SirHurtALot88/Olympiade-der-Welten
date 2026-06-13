import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("game inbox UI contract", () => {
  it("wires the derived inbox into Foundation navigation, Home and global next", () => {
    const source = readFileSync(join(root, "app/foundation/FoundationPageClient.tsx"), "utf8");

    expect(source).toContain('import { buildGameInboxItems, filterGameInboxItems, getPrimaryInboxTask }');
    expect(source).toContain('| "inbox"');
    expect(source).toContain('{ id: "inbox", label: "Inbox" }');
    expect(source).toContain('data-testid="foundation-inbox"');
    expect(source).toContain('data-testid="home-task-list"');
    expect(source).toContain('data-testid="home-story-cards"');
    expect(source).toContain("primaryInboxItem");
    expect(source).toContain("navigateToInboxItem");
    expect(source).toContain("Alle anzeigen");
  });

  it("keeps the inbox read-only in V1", () => {
    const source = readFileSync(join(root, "app/foundation/FoundationPageClient.tsx"), "utf8");

    expect(source).not.toContain("dismissInboxItem");
    expect(source).not.toContain("completeInboxItem");
    expect(source).not.toContain("/api/inbox");
  });
});
