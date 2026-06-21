import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const foundationClientPath = path.join(process.cwd(), "app/foundation/FoundationPageClient.tsx");

describe("new game setup UI contract", () => {
  it("exposes the New Game wizard with preview/confirm controls", () => {
    const source = fs.readFileSync(foundationClientPath, "utf8");

    expect(source).toContain('data-testid="new-game-setup-wizard"');
    expect(source).toContain("Neues Spiel starten");
    expect(source).toContain("Setup pruefen");
    expect(source).toContain("Neues Spiel erstellen");
    expect(source).toContain("Online 4v4");
    expect(source).toContain("/api/new-game");
  });

  it("keeps Online 4v4 ownership preset visible in the client", () => {
    const source = fs.readFileSync(foundationClientPath, "utf8");

    expect(source).toContain('online_4v4');
    expect(source).toContain('["P-S", "D-P", "M-M", "V-W"]');
    expect(source).toContain('["M-S", "P-C", "C-S", "G-G"]');
  });

  it("lets the season briefing complete and continue the setup flow", () => {
    const source = fs.readFileSync(foundationClientPath, "utf8");

    expect(source).toContain("completeSeasonBriefingAndContinue");
    expect(source).toMatch(/onClick=\{completeSeasonBriefingAndContinue\}[\s\S]*?>\s*Erledigt\s*<\/button>/);
    expect(source).toContain('closeSeasonBriefing(false)');
  });
});
